const net = require('node:net');
const { spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 3000);
const HOST = '127.0.0.1';
const PROJECT_ROOT = process.cwd().replace(/\\/g, '/').toLowerCase();
const MAX_PORT_SCAN = 20;

function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: HOST });
    let settled = false;

    const finish = (busy) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(busy);
    };

    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(true));
    socket.once('error', (error) => {
      if (error && (error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH')) {
        finish(false);
        return;
      }
      finish(true);
    });
    socket.setTimeout(1200);
  });
}

async function main() {
  if (process.platform === 'win32') {
    const restartedFromSingleton = await tryRestartSameProjectNextDevSingleton();
    if (restartedFromSingleton) {
      // Give Windows a tiny grace period after taskkill.
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  let targetPort = PORT;
  const busy = await isPortBusy(targetPort);
  if (busy) {
    const restarted = await tryRestartExistingProjectServer(targetPort);
    if (!restarted) {
      targetPort = await findNextAvailablePort(targetPort + 1);
      console.log(`[dev-safe] Port ${PORT} busy, starting on http://localhost:${targetPort}`);
    }
  }

  console.log(`[dev-safe] Starting single Next.js dev server on http://localhost:${targetPort}`);
  const child = spawn('npx', ['next', 'dev', '--port', String(targetPort)], {
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
      return;
    }
    process.exit(code ?? 0);
  });
}

async function findNextAvailablePort(startPort) {
  for (let port = startPort; port < startPort + MAX_PORT_SCAN; port++) {
    // eslint-disable-next-line no-await-in-loop
    const busy = await isPortBusy(port);
    if (!busy) return port;
  }
  throw new Error(`Could not find an available port in range ${startPort}-${startPort + MAX_PORT_SCAN - 1}`);
}

function isLikelySameProjectDevProcess(commandLine, processName) {
  const normalizedCmd = String(commandLine || '').replace(/\\/g, '/').toLowerCase();
  const normalizedName = String(processName || '').toLowerCase();
  const isNodeLike = normalizedName.includes('node') || normalizedCmd.includes('node');
  const isNextDev =
    normalizedCmd.includes('next dev') ||
    normalizedCmd.includes('scripts/dev-safe.js') ||
    normalizedCmd.includes('next/dist/server/lib/start-server.js');
  const isProject = normalizedCmd.includes(PROJECT_ROOT);
  return isNodeLike && isNextDev && isProject;
}

async function listPortOwnersWindows(port) {
  const psScript = `
    $conns = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { '[]'; exit 0 }
    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    $rows = foreach ($pid in $pids) {
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $pid" -ErrorAction SilentlyContinue
      if ($proc) {
        [PSCustomObject]@{
          pid = [int]$pid
          name = [string]$proc.Name
          commandLine = [string]$proc.CommandLine
        }
      }
    }
    if (-not $rows) { '[]'; exit 0 }
    $rows | ConvertTo-Json -Compress
  `;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psScript], {
    windowsHide: true,
  });
  const raw = String(stdout || '').trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function killProcessWindows(pid) {
  await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
}

async function waitUntilPortFree(port, timeoutMs = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const busy = await isPortBusy(port);
    if (!busy) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function tryRestartExistingProjectServer(port) {
  if (process.platform !== 'win32') return false;
  let owners = [];
  try {
    owners = await listPortOwnersWindows(port);
  } catch {
    return false;
  }
  const sameProjectOwners = owners.filter((owner) =>
    isLikelySameProjectDevProcess(owner.commandLine, owner.name)
  );
  if (sameProjectOwners.length === 0) return false;

  console.log(`[dev-safe] Restarting existing dev server on port ${port}...`);
  for (const owner of sameProjectOwners) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await killProcessWindows(owner.pid);
    } catch {
      return false;
    }
  }
  return waitUntilPortFree(port);
}

async function listSameProjectNextDevPidsWindows() {
  const escapedProject = PROJECT_ROOT.replace(/'/g, "''");
  const psScript = `
    $project = '${escapedProject}'
    $rows = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
      Where-Object {
        $cmd = [string]$_.CommandLine
        if (-not $cmd) { return $false }
        $norm = $cmd.Replace('\\','/').ToLower()
        return $norm.Contains($project) -and (
          $norm.Contains('next dev') -or
          $norm.Contains('scripts/dev-safe.js') -or
          $norm.Contains('next/dist/server/lib/start-server.js')
        )
      } |
      Select-Object @{Name='pid';Expression={[int]$_.ProcessId}}
    if (-not $rows) { '[]'; exit 0 }
    $rows | ConvertTo-Json -Compress
  `;
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psScript], {
    windowsHide: true,
  });
  const raw = String(stdout || '').trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr
    .map((x) => Number(x.pid))
    .filter((pid) => Number.isFinite(pid) && pid > 0 && pid !== process.pid);
}

async function tryRestartSameProjectNextDevSingleton() {
  let pids = [];
  try {
    pids = await listSameProjectNextDevPidsWindows();
  } catch {
    return false;
  }
  if (pids.length === 0) return false;
  console.log('[dev-safe] Restarting existing dev server on port 3000...');
  for (const pid of pids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await killProcessWindows(pid);
    } catch {
      return false;
    }
  }
  return true;
}

main().catch((error) => {
  console.error('[dev-safe] Failed to start dev server:', error);
  process.exit(1);
});

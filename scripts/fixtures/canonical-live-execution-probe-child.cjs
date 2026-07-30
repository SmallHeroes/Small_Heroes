'use strict';

const crypto = require('node:crypto');

const PROTOCOL = 'canonical-live-execution-probe/v1';

function parseArgs(tokens) {
  if (tokens.length !== 6) {
    throw new Error('probe_arguments_invalid');
  }
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (
      !['--probe-protocol', '--probe-path', '--scenario'].includes(flag) ||
      values.has(flag) ||
      typeof value !== 'string'
    ) {
      throw new Error('probe_arguments_invalid');
    }
    values.set(flag, value);
  }
  return values;
}

const values = parseArgs(process.argv.slice(2));
if (values.get('--probe-protocol') !== PROTOCOL) {
  throw new Error('probe_protocol_invalid');
}
const scenario = values.get('--scenario');
if (!['nonzero', 'signal', 'success'].includes(scenario)) {
  throw new Error('probe_scenario_invalid');
}
if (scenario === 'nonzero') {
  process.exit(23);
}
if (scenario === 'signal') {
  process.kill(process.pid, 'SIGTERM');
} else {
  const probePath = values.get('--probe-path');
  const probeBytes = Buffer.from(probePath, 'utf8');
  process.stdout.write(
    `${JSON.stringify({
      version: PROTOCOL,
      status: 'ok',
      argvCount: process.argv.slice(2).length,
      probePathUtf8Bytes: probeBytes.length,
      probePathSha256: crypto
        .createHash('sha256')
        .update(probeBytes)
        .digest('hex'),
      environmentNames: Object.keys(process.env).sort(),
      credentialPresent: Object.keys(process.env).some(
        (name) => name.toUpperCase() === 'OPENAI_API_KEY',
      ),
    })}\n`,
  );
}

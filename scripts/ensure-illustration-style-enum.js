const { spawnSync } = require('node:child_process');

const sql = `
ALTER TYPE "IllustrationStyle" ADD VALUE IF NOT EXISTS 'pencil_watercolor';
ALTER TYPE "IllustrationStyle" ADD VALUE IF NOT EXISTS 'realistic_illustrated';
ALTER TYPE "IllustrationStyle" ADD VALUE IF NOT EXISTS 'whimsical_comic_fantasy';
`;

function main() {
  const child = spawnSync(
    'npx',
    ['prisma', 'db', 'execute', '--stdin', '--schema', 'backend/schema.prisma'],
    {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true,
      env: process.env,
    }
  );

  if (child.status !== 0) {
    process.exit(child.status ?? 1);
  }
}

main();

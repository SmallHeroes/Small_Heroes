/**
 * READ-ONLY survey: the universe of children with RENDERED pages on the connected DB, to size a DIVERSE
 * identity-calibration set. No writes, no renders. Reports each distinct child (by name) with gender/age,
 * page count, and whether a canonical anchor resolves (the reference the calibration needs).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();
import './shims/register-server-only.cjs';

const norm = (n: string | null | undefined): string => (n ?? '').trim();

async function main() {
  const { prisma } = await import('@/lib/prisma');
  const { getApprovedChildCanonicalAnchor } = await import('@/lib/generation-pipeline/character-anchor-store');

  const orders = await prisma.order.findMany({
    where: { book: { pages: { some: { imageAsset: { is: { id: { not: undefined } } } } } } },
    select: {
      id: true,
      childName: true,
      childGender: true,
      childAge: true,
      childImageUrl: true,
      generationJob: { select: { pipelineCache: true } },
      book: { select: { pages: { select: { imageAsset: { select: { url: true } } } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  interface Row {
    orderId: string;
    name: string;
    gender: string;
    age: number | null;
    pages: number;
    anchor: boolean;
    photo: boolean;
  }
  const rows: Row[] = [];
  for (const o of orders) {
    const pages = (o.book?.pages ?? []).filter((p) => p.imageAsset?.url).length;
    if (pages === 0) continue;
    const cache = (o.generationJob?.pipelineCache ?? {}) as never;
    let anchor = false;
    try {
      anchor = Boolean(getApprovedChildCanonicalAnchor(cache)?.url);
    } catch {
      anchor = false;
    }
    rows.push({
      orderId: o.id,
      name: norm(o.childName),
      gender: norm(o.childGender) || '?',
      age: o.childAge ?? null,
      pages,
      anchor,
      photo: Boolean(o.childImageUrl),
    });
  }

  // Group by distinct child name.
  const byChild = new Map<string, Row[]>();
  for (const r of rows) byChild.set(r.name, [...(byChild.get(r.name) ?? []), r]);

  console.log(`[survey] orders with rendered pages: ${rows.length}; distinct child NAMES: ${byChild.size}`);
  console.log('[survey] per distinct child (name | gender | age | #orders | totalPages | #withAnchor):');
  const usable: string[] = [];
  for (const [name, rs] of [...byChild.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const withAnchor = rs.filter((r) => r.anchor).length;
    const ages = [...new Set(rs.map((r) => r.age).filter((a) => a != null))].join('/');
    const gender = [...new Set(rs.map((r) => r.gender))].join('/');
    const totalPages = rs.reduce((s, r) => s + r.pages, 0);
    console.log(`  - "${name}" | ${gender} | age ${ages || '?'} | ${rs.length} order(s) | ${totalPages} pages | ${withAnchor} w/anchor`);
    if (withAnchor > 0) usable.push(name);
  }
  console.log(`[survey] children usable for calibration (have an anchor): ${usable.length} → ${usable.join(', ')}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

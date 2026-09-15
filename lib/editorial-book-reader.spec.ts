import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { randomUUID, createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
const { load, build } = require('../scripts/editorial-book-reader.cjs');
const roots: string[] = [];
const hash = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = path.resolve(__dirname, '../outputs/reader-test-' + randomUUID()); roots.push(root); fs.mkdirSync(root);
  const pages = [0, 1, 2].map(pageNumber => {
    const imageName = `page-${String(pageNumber).padStart(2, '0')}.png`, bytes = Buffer.from('test image ' + pageNumber);
    fs.writeFileSync(path.join(root, imageName), bytes);
    return { pageNumber, imageName, imageSha: hash(bytes), text: pageNumber ? 'שלום\nעוד שורה' : '</script><script>alert(1)</script>' };
  });
  const manifest = { productionReady: false, pages };
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest)); return { root, manifest };
}
describe('isolated artifact reader', () => {
  it('builds syntactically valid script and escapes manuscript HTML', () => {
    const { root } = fixture(); build(root);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    expect(() => new vm.Script(script)).not.toThrow();
    expect(script).toContain('\\u003c/script>'); expect(script).toContain('textContent=p.text');
    expect(script).toContain('#page-(\\d+)');
  });
  it('rejects altered image bytes', () => {
    const { root } = fixture(); fs.appendFileSync(path.join(root, 'page-01.png'), 'changed'); expect(() => load(root)).toThrow('reader_image_hash');
  });
  it('rejects traversal image name before reading it', () => {
    const { root, manifest } = fixture(); manifest.pages[1].imageName = '../outside.png'; fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
    expect(() => load(root)).toThrow('reader_sequence');
  });
  it('refuses production-ready manifest instead of inferring release authority', () => {
    const { root, manifest } = fixture(); manifest.productionReady = true; fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
    expect(() => load(root)).toThrow('reader_draft_required');
  });
  it('refuses production and hosted environment entry', () => {
    const { root } = fixture(); vi.stubEnv('NODE_ENV', 'production');
    expect(() => load(root)).toThrow('local_only');
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('VERCEL', '1');
    expect(() => load(root)).toThrow('local_only');
  });
  it('rejects audio with different narration text despite intact media bytes', () => {
    const { root, manifest } = fixture(); const bytes = Buffer.from('test audio');
    fs.writeFileSync(path.join(root, 'page-01.mp3'), bytes);
    Object.assign(manifest.pages[1], {audio:{fileName:'page-01.mp3', sha:hash(bytes), textSha:hash('different text')}});
    fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
    expect(() => load(root)).toThrow('reader_audio_binding');
  });
  it('does not assign predecessor diagnostic pass to changed image bytes', () => {
    const { root } = fixture(); const file=path.join(root,'qa.json');
    fs.writeFileSync(file, JSON.stringify({results:[{pageNumber:1,disposition:'passed',review:{candidateSha:'old-image'}}]}));
    build(root,file); const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    expect(html).toContain('unassessed_changed_image');
    expect(html).toContain('predecessorReview');
  });
});

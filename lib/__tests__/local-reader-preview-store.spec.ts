import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadLocalReaderAsset, loadLocalReaderPreview } from '../local-reader-preview-store';
import { GET } from '../../app/api/dev/local-reader/route';

let scratch: string, dir: string, manifest: any;
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const audio = Buffer.from('synthetic-not-real-audio');
const image = Buffer.from('synthetic-not-real-image');
beforeEach(() => {
  scratch = mkdtempSync(path.join(os.tmpdir(), 'local-reader-test-'));
  dir = path.join(scratch, 'outputs', 'local-reader-previews', 'synthetic-book');
  mkdirSync(dir, { recursive: true });
  manifest = { version: 'local-narrated-reader/v1', id: 'synthetic-book', title: 'כותרת', childName: 'דוגמה',
    sourceManifestSha256: 'a'.repeat(64), sourceQa: 'incomplete', productAccepted: false, productionQualified: false,
    voice: { id: 'mom', label: 'אמא', provider: 'elevenlabs', model: 'eleven_v3' },
    pages: [0, 1].map(pageNumber => ({ pageNumber, text: pageNumber ? 'מקור מדויק' : 'כותרת',
      imageSha256: hash(image), audioSha256: hash(audio) })) };
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  for (const i of [0, 1]) { writeFileSync(path.join(dir, `page-${i}.mp3`), audio); writeFileSync(path.join(dir, `page-${i}.png`), image); }
  vi.spyOn(process, 'cwd').mockReturnValue(scratch);
  vi.stubEnv('NODE_ENV', 'development');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); rmSync(scratch, { recursive: true, force: true }); });
const request = (asset = 'page-1.mp3', headers?: HeadersInit) => new Request(
  `http://127.0.0.1/api/dev/local-reader?book=synthetic-book&asset=${encodeURIComponent(asset)}`, { headers });

describe('real local store and HTTP route, synthetic bytes only', () => {
  it('image-only manifest serves PNG but refuses an existing unclaimed MP3 file',async()=>{
    manifest.version='local-image-reader/v1';manifest.voice=null;
    for(const p of manifest.pages)p.audioSha256=null;
    writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest));
    expect((await GET(request('page-1.png'))).status).toBe(200);
    expect((await GET(request('page-1.mp3'))).status).toBe(404);
    await expect(loadLocalReaderAsset('synthetic-book','page-1.mp3')).rejects.toThrow('local_reader_asset');
    vi.stubEnv('NODE_ENV','production');expect((await GET(request('page-1.png'))).status).toBe(404);
  });
  it('loads exact frozen text and serves every bound asset', async () => {
    expect((await loadLocalReaderPreview('synthetic-book')).pages[1].text).toBe('מקור מדויק');
    expect((await loadLocalReaderAsset('synthetic-book', 'page-0.png')).bytes).toEqual(image);
    const r = await GET(request()); expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('audio/mpeg'); expect(r.headers.get('accept-ranges')).toBe('bytes');
    expect(Buffer.from(await r.arrayBuffer())).toEqual(audio);
  });
  it('serves real clipped206 bytes and unsatisfiable416', async () => {
    const r = await GET(request('page-1.mp3', { Range: 'bytes=2-5' }));
    expect(r.status).toBe(206); expect(r.headers.get('content-range')).toBe(`bytes 2-5/${audio.length}`);
    expect(Buffer.from(await r.arrayBuffer())).toEqual(audio.subarray(2, 6));
    expect((await GET(request('page-1.mp3', { Range: 'bytes=999-' }))).status).toBe(416);
  });
  it('production refuses both loader and route even if preview exists', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(loadLocalReaderPreview('synthetic-book')).rejects.toThrow('local_reader_dev_only');
    expect((await GET(request())).status).toBe(404);
  });
  it('tampered bytes do not serve under an old hash', async () => {
    writeFileSync(path.join(dir, 'page-1.mp3'), 'different');
    await expect(loadLocalReaderAsset('synthetic-book', 'page-1.mp3')).rejects.toThrow('local_reader_asset_hash');
    expect((await GET(request())).status).toBe(404);
  });
  it('wrong manifest identity and traversal cannot expose other files', async () => {
    manifest.id = 'another-book'; writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    await expect(loadLocalReaderPreview('synthetic-book')).rejects.toThrow('local_reader_id_binding');
    expect((await GET(request('../manifest.json'))).status).toBe(404);
    await expect(loadLocalReaderPreview('../elsewhere')).rejects.toThrow('local_reader_id');
  });
});

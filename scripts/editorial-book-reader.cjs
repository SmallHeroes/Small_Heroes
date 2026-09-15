/* Local artifact reader only. No Next route, order, production assets or provider. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
function load(rootArg) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV) throw Error('local_only');
  const outputs = fs.realpathSync(path.resolve(__dirname, '../outputs'));
  const root = fs.realpathSync(rootArg);
  if (path.dirname(root) !== outputs) throw Error('reader_root_scope');
  const read = name => { const file = fs.realpathSync(path.join(root, name)); if (path.dirname(file) !== root) throw Error('reader_file_scope'); return fs.readFileSync(file); };
  const m = JSON.parse(read('manifest.json').toString('utf8'));
  if (m.productionReady !== false || !Array.isArray(m.pages) || m.pages.length < 3 || m.pages.length > 25) throw Error('reader_draft_required');
  const media = new Map();
  m.pages.forEach((p, i) => {
    if (p.pageNumber !== i || typeof p.text !== 'string' || p.imageName !== `page-${String(i).padStart(2, '0')}.png`) throw Error('reader_sequence');
    if (hash(read(p.imageName)) !== p.imageSha) throw Error('reader_image_hash');
    media.set('/' + p.imageName, { sha: p.imageSha, type: 'image/png' });
    if (p.audio) {
      if (p.audio.fileName !== `page-${String(i).padStart(2, '0')}.mp3` || p.audio.textSha !== hash(p.text) || hash(read(p.audio.fileName)) !== p.audio.sha) throw Error('reader_audio_binding');
      media.set('/' + p.audio.fileName, { sha: p.audio.sha, type: 'audio/mpeg' });
    }
  });
  return { root, read, m, media };
}
function build(rootArg, qaFile) {
  const { root, m } = load(rootArg);
  const qa = qaFile ? JSON.parse(fs.readFileSync(qaFile, 'utf8')) : null;
  if (qa && Array.isArray(qa.results)) qa.results = qa.results.map(q => {
    const p = m.pages[q.pageNumber];
    if (!p || (q.review && q.review.candidateSha !== p.imageSha)) return { pageNumber: q.pageNumber, disposition: 'unassessed_changed_image', predecessorReview: q };
    return q;
  });
  const data = JSON.stringify({ ...m, diagnosticQa: qa }).replace(/</g, '\\u003c');
  const html = String.raw`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ספר עם קריינות — טיוטה לשיפוט</title>
<style>*{box-sizing:border-box}body{margin:0;background:#eae3d6;color:#29372d;font-family:Arial,sans-serif}header{max-width:1450px;margin:auto;padding:15px 24px;display:flex;gap:14px;align-items:center;justify-content:space-between}h1{font-size:22px;margin:0}.badge{font-size:12px;background:#fff4d9;padding:6px 10px;border-radius:20px;color:#755b21}.book{max-width:1450px;margin:0 auto 20px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(330px,.9fr);background:#fffaf0;box-shadow:0 12px 50px #42351d20;border-radius:14px;overflow:hidden;min-height:80vh}.art{background:#e3decb;display:flex;align-items:center;justify-content:center;min-height:0}.art img{display:block;width:100%;height:82vh;object-fit:contain}.reading{padding:24px clamp(22px,3vw,50px);display:flex;flex-direction:column;justify-content:center;min-width:0}.eyebrow{color:#7b856e;font-size:13px;margin-bottom:12px}#text{white-space:pre-line;line-height:1.8;font-size:clamp(18px,1.45vw,23px);margin:0}#audio{width:100%;margin-top:22px}nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:22px}button,select{font:inherit;background:#fffaf0;border:1px solid #b7b9a4;border-radius:10px;padding:10px 15px;color:#2c4938;cursor:pointer}button:hover{background:#e3eddf}button:disabled{opacity:.35;cursor:default}label{font-size:13px;margin-top:12px}details{margin-top:16px;font-size:12px;color:#7c6138;line-height:1.6}#findings{white-space:pre-line;direction:ltr;text-align:left}footer{font-size:12px;text-align:center;color:#6c725e;padding:5px 16px 20px}@media(max-width:760px){header{padding:12px;flex-wrap:wrap}h1{font-size:18px}.book{display:block;margin:0 10px 12px;min-height:0}.art img{height:53vh}.reading{padding:22px}#text{font-size:20px;line-height:1.85}.badge{font-size:11px}}@media(prefers-reduced-motion:no-preference){.art img{animation:appear .3s}@keyframes appear{from{opacity:.7}to{opacity:1}}}</style>
<header><h1 id="title"></h1><span class="badge">טיוטה מלאה לשיפוט · לא מאושר להפצה</span></header><main class="book"><div class="art"><img id="picture" alt=""></div><section class="reading"><div class="eyebrow" id="number"></div><p id="text"></p><audio id="audio" controls preload="metadata"></audio><label id="autoLabel"><input type="checkbox" id="auto"> המשך לעמוד הבא בסיום הקריינות</label><nav><button id="previous">הקודם</button><select id="pages" aria-label="בחירת עמוד"></select><button id="next">הבא</button></nav><details><summary>מצב בדיקה של העמוד</summary><div id="findings"></div></details></section></main><footer>קריינות AI בעברית · איורי LOW · בדיקות אוטומטיות הן אבחון, לא אישור מוצר. הספר הקודם לא השתנה.</footer>
<script>const book=${data};const $=id=>document.getElementById(id);let current=0;const audio=$('audio');$('title').textContent=book.title||book.pages[0].text;book.pages.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=i?'עמוד '+i:'כריכה';$('pages').append(o)});function show(i,play=false){current=Math.max(0,Math.min(book.pages.length-1,i));const p=book.pages[current];audio.pause();$('picture').src=p.imageName;$('picture').alt=current?'איור לעמוד '+current:'כריכת הספר';$('number').textContent=current?'עמוד '+current+' מתוך '+(book.pages.length-1):'כריכה';$('text').textContent=p.text;$('pages').value=current;$('previous').disabled=current===0;$('next').disabled=current===book.pages.length-1;audio.hidden=!p.audio;$('autoLabel').hidden=!p.audio;if(p.audio){audio.src=p.audio.fileName;if(play)audio.play().catch(()=>{})}else audio.removeAttribute('src');const q=book.diagnosticQa?.results?.find(x=>x.pageNumber===current);$('findings').textContent=q?('Diagnostic result: '+q.disposition+'\n'+(q.review?.checks||[]).filter(c=>c.verdict!=='pass').map(c=>c.category+': '+c.verdict+' — '+c.observation).join('\n')+(q.error?'\n'+q.error:'')):'בדיקה אוטומטית טרם הושלמה. אין אישור מוצר או ציון דמיון מספרי.';history.replaceState(null,'','#page-'+current)}$('previous').onclick=()=>show(current-1);$('next').onclick=()=>show(current+1);$('pages').onchange=e=>show(Number(e.target.value));audio.onended=()=>{if($('auto').checked&&current<book.pages.length-1)show(current+1,true)};document.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(e.target.tagName))return;if(e.key==='ArrowLeft'){e.preventDefault();show(current+1)}if(e.key==='ArrowRight'){e.preventDefault();show(current-1)}});show(Number(location.hash.match(/^#page-(\d+)$/)?.[1]||0));</script></html>`;
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log(JSON.stringify({ status: 'reader_built', pages: m.pages.length, audio: m.pages.filter(p => p.audio).length, root }));
}
function serve(rootArg, port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('reader_port');
  const { read, media } = load(rootArg);
  const server = http.createServer((req, res) => {
    const host = `127.0.0.1:${port}`;
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== `http://${host}`) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(403).end(); return; }
    const route = req.url?.split('?')[0];
    if (route !== '/' && route !== '/index.html' && !media.has(route)) { res.writeHead(404).end(); return; }
    try {
      const file = route === '/' || route === '/index.html' ? 'index.html' : route.slice(1);
      const bytes = read(file), info = media.get(route);
      if (info && hash(bytes) !== info.sha) throw Error('reader_asset_changed');
      res.writeHead(200, { 'Content-Type': info?.type || 'text/html; charset=utf-8', 'Content-Length': bytes.length, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; frame-ancestors 'none'" });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(409).end(); }
  });
  server.listen(port, '127.0.0.1', () => console.log(`reader_ready http://127.0.0.1:${port}`));
  return server;
}
module.exports = { load, build, serve };
if (require.main === module) {
  const [mode, root, extra] = process.argv.slice(2);
  if (mode === 'build') build(root, extra); else if (mode === 'serve') serve(root, Number(extra)); else throw Error('reader_mode');
}

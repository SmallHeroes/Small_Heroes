/**
 * Read-only continuity report of a SAVED reviewed-audition book (engine continuity repair, stage A, 2026-10-29). No provider, no key and
 * no engine behaviour: it reads the saved storyboard, page records, render and review wires and sheet records, and writes ONE new report
 * file (exclusive create). It never edits a saved record; their hashes bind canonicalJson.
 *
 * Per page:
 * - the render and review reference sets, and whether the previous page reached either;
 * - the landmark scope of the render prose vs the review's plannedVisible;
 * - reference status, the review's findings by requirement, and relative-scale findings.
 * Per book:
 * - sheet statuses and entity part mentions (one entity's design naming another, e.g. a body part made of a separate prop);
 * - a counterfactual regrouping of critical findings under a DECLARED ambiguity rule, recorded in the report: kind-ambiguous landmark
 *   uniqueness plus any requirement ids the caller names.
 * Every id comes from the book's own storyboard. Nothing here is a re-judgement or a visual verdict.
 *   npx tsx scripts/personal-audition-continuity-report.ts <bookDir> <out.json> [--ambiguous <requirementId>]...
 */
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const AUDITION_CONTINUITY_REPORT_VERSION = 'audition-continuity-report/v1' as const;
const CRITICAL = new Set(['story', 'identity', 'continuity']);
const STORYBOARD_FILES = ['owned_storyboard_draft.json', 'storyboard_draft.json'];

const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
function readJson(file: string): any {
  if (!existsSync(file)) return fail('continuity_report_missing');
  const s = lstatSync(file);
  if (!s.isFile() || s.isSymbolicLink() || s.size > 64_000_000) fail('continuity_report_file');
  return JSON.parse(readFileSync(file, 'utf8'));
}
const optionalJson = (file: string) => existsSync(file) ? readJson(file) : null;
/** The render prompt of a saved render wire: its prompt field, else its longest string. */
function renderPrompt(wire: any): string {
  if (typeof wire?.body?.prompt === 'string') return wire.body.prompt;
  let best = '';
  const walk = (v: unknown) => { if (typeof v === 'string') { if (v.length > best.length) best = v; } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(wire?.body);
  return best;
}
const unique = <T>(xs: T[]) => [...new Set(xs)];
/** The review wire nests its context as an escaped JSON string; these read only fixed context keys from it. */
/** The SET of image names the review context names (sorted: field order in the context is not meaningful). */
const escapedNames = (text: string) => unique([...text.matchAll(/\\"imageName\\":\\"([^"\\]+)\\"/g)].map(m => m[1])).sort();
function escapedPredecessor(text: string) {
  const m = text.match(/\\"predecessor\\":(null|\{[^}]*\})/);
  if (!m) return { present: false, imageName: null };
  if (m[1] === 'null') return { present: true, imageName: null };
  return { present: true, imageName: (m[1].match(/\\"imageName\\":\\"([^"\\]+)\\"/) ?? [])[1] ?? null };
}
function escapedReferenceStatus(text: string) {
  const role = (r: string) => (text.match(new RegExp(`\\\\"referenceStatus\\\\":\\{.*?\\\\"${r}\\\\":\\{\\\\"status\\\\":\\\\"(\\w+)\\\\"`)) ?? [])[1] ?? null;
  return { entities: role('entities'), locations: role('locations') };
}
const escapedPlannedVisible = (text: string, id: string) => {
  const m = text.match(new RegExp(`\\\\"id\\\\":\\\\"${id.replace(/[^a-z0-9_]/gi, '')}\\\\",\\\\"design\\\\":\\\\"[^"]*?\\\\",\\\\"plannedVisible\\\\":(true|false)`));
  return m ? m[1] === 'true' : null;
};
const listAfter = (line: string | null) => line ? line.replace(/^[^:]*:\s*/, '').replace(/[.\s]+$/, '').split(/\s*,\s*/).filter(Boolean) : [];

export type ContinuityReportOptions = { ambiguousRequirements?: readonly string[] };

export function auditionContinuityReport(bookDir: string, options: ContinuityReportOptions = {}) {
  const book = path.resolve(bookDir), layout = readJson(path.join(book, 'book-layout.json'));
  if (typeof layout?.storyboardDir !== 'string' || /[\\/]|\.\./.test(layout.storyboardDir)) fail('continuity_report_layout');
  const storyboardFile = STORYBOARD_FILES.map(n => path.join(book, layout.storyboardDir, n)).find(f => existsSync(f)) ?? fail('continuity_report_storyboard');
  const draft = readJson(storyboardFile), continuity = draft?.plan?.continuity;
  if (!continuity || !Array.isArray(continuity.pages) || !Array.isArray(continuity.entities)) fail('continuity_report_storyboard');
  const entities: { id: string; kind: string; invariants?: { attribute: string; value: string }[] }[] = continuity.entities;
  const landmarks = entities.filter(e => e.kind === 'landmark').map(e => e.id);
  // An entity whose written design names another entity (e.g. a tail "made of an orange block" beside a separate orange block prop).
  const partMentions = entities.flatMap(e => {
    const text = (e.invariants ?? []).map(i => i.value).join(' ');
    return entities.filter(f => f.id !== e.id && text.toLowerCase().includes(f.id.split('_').join(' ').toLowerCase()))
      .map(f => ({ entity: e.id, mentions: f.id, text }));
  });
  const ambiguousExtra = [...(options.ambiguousRequirements ?? [])];
  const ambiguous = (f: { requirement: string; verdict: string }) =>
    (f.requirement.startsWith('landmark_unique:') && f.verdict === 'uncertain') || ambiguousExtra.includes(f.requirement);
  const stages = path.join(book, 'paid-stages');
  const pages = continuity.pages.map((planned: any) => {
    const n: number = planned.pageNumber, record = readJson(path.join(book, `page_${n}.json`));
    const findings = ((record?.chosen?.assessment?.findings ?? []) as any[]).map(f => ({ requirement: String(f.requirement), category: String(f.category),
      verdict: String(f.verdict), impact: String(f.impact), derived: !!f.derived }));
    const attempts = ((record?.attempts ?? []) as any[]).map(a => {
      const render = optionalJson(path.join(stages, `page_${n}_${a.attempt}.wire.json`)), qa = optionalJson(path.join(stages, `page_${n}_${a.attempt}_qa.wire.json`));
      const prompt = render ? renderPrompt(render) : '', qaText = qa ? JSON.stringify(qa) : '';
      const uniqueLine = (prompt.match(/UNIQUE LANDMARKS \(one each, never duplicated\):[^\n.]*/) ?? [])[0] ?? null;
      const plannedVisible = Object.fromEntries(landmarks.map(id => [id, qa ? escapedPlannedVisible(qaText, id) : null]));
      const renderLandmarks = listAfter(uniqueLine);
      const renderReferences = ((render?.references ?? []) as any[]).map(r => String(r?.imageName ?? ''));
      return { attempt: Number(a.attempt), renderWire: !!render, reviewWire: !!qa,
        render: { references: renderReferences, previousPageImage: renderReferences.some(r => /^page_\d+_\d+\.png$/.test(r)),
          contextPredecessor: (prompt.match(/"predecessor":(null|\{[^}]*\})/) ?? [])[1] ?? null,
          uniqueLandmarksLine: uniqueLine, notYetLine: (prompt.match(/NOT YET IN THE STORY[^\n]*/) ?? [])[0] ?? null,
          mentionsPlannedVisible: /plannedVisible/.test(prompt),
          partMentionsInRender: partMentions.map(p => ({ entity: p.entity, mentions: p.mentions, inRender: prompt.includes(p.text) })) },
        review: { references: qa ? escapedNames(qaText) : [], predecessor: qa ? escapedPredecessor(qaText) : null,
          referenceStatus: qa ? escapedReferenceStatus(qaText) : null, plannedVisible },
        // Landmarks the render prose lists as unique although the review says they are not planned visible in this frame.
        unscopedRenderLandmarks: renderLandmarks.filter(id => plannedVisible[id] === false) };
    });
    const critical = findings.filter(f => CRITICAL.has(f.impact)), remaining = critical.filter(f => !ambiguous(f));
    return { page: n, locations: planned.visibleLocationIds ?? [], status: record?.status ?? null,
      identityScore: record?.chosen?.identity?.resemblanceScore ?? null, attempts, findings,
      relativeScale: findings.filter(f => f.category === 'relative_scale'),
      counterfactual: { criticalFindings: critical.length, ambiguousCritical: critical.length - remaining.length, remainingCritical: remaining.length,
        remaining: remaining.map(f => `${f.requirement} [${f.verdict}/${f.impact}${f.derived ? '/derived' : ''}]`) } };
  });
  const byRequirement: Record<string, { page: number; verdict: string; impact: string }[]> = {};
  for (const p of pages) for (const f of p.findings) (byRequirement[f.requirement] ??= []).push({ page: p.page, verdict: f.verdict, impact: f.impact });
  const sheets = Object.fromEntries(['entities', 'locations'].map(role => {
    const s = optionalJson(path.join(book, `sheet_${role}.json`));
    return [role, s ? { status: s.status ?? null, attempts: (s.attempts ?? []).length, chosen: s.chosen?.candidate?.imageName ?? null,
      knownFlaws: ((s.chosen?.assessment?.findings ?? []) as any[]).filter(f => f.impact !== 'detail').map(f => `${f.requirement}: ${f.note}`) } : null];
  }));
  return { version: AUDITION_CONTINUITY_REPORT_VERSION, scope: 'saved records only; no re-judgement, no visual verdict, no provider call',
    book: { dir: book, storyboard: path.relative(book, storyboardFile), pages: pages.length, landmarks,
      companionStandingHeightInChildHeights: continuity.companionStandingHeightInChildHeights ?? null,
      entities: entities.map(e => ({ id: e.id, kind: e.kind, invariants: e.invariants ?? [] })),
      locations: ((draft.plan.locations ?? []) as any[]).map(l => ({ id: String(l.id), design: String(l.design ?? '') })) },
    sheets, partMentions, pages, byRequirement,
    counterfactual: { rule: { landmarkUniqueUncertain: true, declaredAmbiguous: ambiguousExtra, criticalImpacts: [...CRITICAL] },
      pagesThatWouldStillHold: pages.filter((p: any) => p.counterfactual.remainingCritical > 0).map((p: any) => p.page),
      pagesHeldOnlyByAmbiguousRules: pages.filter((p: any) => p.counterfactual.criticalFindings > 0 && p.counterfactual.remainingCritical === 0).map((p: any) => p.page) } };
}

/** Writes the report once (exclusive create), never inside the saved book. */
export function writeAuditionContinuityReport(bookDir: string, outFile: string, options: ContinuityReportOptions = {}) {
  const book = path.resolve(bookDir), out = path.resolve(outFile), rel = path.relative(book, out);
  const outside = rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);
  if (!path.isAbsolute(outFile) || !outside) fail('continuity_report_output');
  const report = auditionContinuityReport(book, options);
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}

export function auditionContinuityReportMain(argv: string[]) {
  const [bookDir, outFile, ...rest] = argv, ambiguousRequirements: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] !== '--ambiguous' || !rest[i + 1]) return fail('continuity_report_args');
    ambiguousRequirements.push(rest[++i]);
  }
  if (!bookDir || !outFile) return fail('continuity_report_args');
  const r = writeAuditionContinuityReport(bookDir, outFile, { ambiguousRequirements });
  console.log(JSON.stringify({ out: path.resolve(outFile), pages: r.book.pages, stillHold: r.counterfactual.pagesThatWouldStillHold }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  try { auditionContinuityReportMain(process.argv.slice(2)); }
  catch (error) { console.error((error as { code?: string })?.code ?? (error as Error)?.message ?? error); process.exitCode = 1; }
}

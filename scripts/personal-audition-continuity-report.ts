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
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
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
const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
/**
 * The review context of a saved QA wire, decoded: the one input_text whose JSON payload carries an object `context` (the judge envelope
 * {candidateSha, contextSha, context, imageRoles}). None or several → null (unsupported, never guessed).
 */
function reviewContext(wire: any): Record<string, any> | null {
  const found: Record<string, any>[] = [];
  for (const m of Array.isArray(wire?.input) ? wire.input : []) for (const c of Array.isArray(m?.content) ? m.content : []) {
    if (c?.type !== 'input_text' || typeof c.text !== 'string') continue;
    let payload: unknown;
    try { payload = JSON.parse(c.text); } catch { continue; }
    if (isObject(payload) && isObject(payload.context)) found.push(payload.context);
  }
  return found.length === 1 ? found[0] : null;
}
/** Fields read from the decoded context only. Absent (unknown) stays null; a known empty or null value is reported as such. */
function reviewFields(context: Record<string, any> | null, landmarks: readonly string[]) {
  if (!context) return { contextFound: false, references: null, predecessor: null, referenceStatus: null,
    plannedVisible: Object.fromEntries(landmarks.map(id => [id, null])) as Record<string, boolean | null> };
  const predecessor = !('predecessor' in context) ? { present: false, imageName: null }
    : { present: true, imageName: isObject(context.predecessor) && typeof context.predecessor.imageName === 'string' ? context.predecessor.imageName : null };
  // The SET of images the judge received: its references plus the separately supplied predecessor (sorted: order is not meaningful).
  const references = Array.isArray(context.references)
    ? unique([...context.references.map((r: any) => r?.imageName).filter((n: unknown): n is string => typeof n === 'string'),
      ...(predecessor.imageName ? [predecessor.imageName] : [])]).sort()
    : null;
  const status = (role: string) => isObject(context.referenceStatus) && typeof context.referenceStatus[role]?.status === 'string' ? context.referenceStatus[role].status : null;
  const listed: any[] = Array.isArray(context.checks?.uniqueLandmarks) ? context.checks.uniqueLandmarks : [];
  const plannedVisible = Object.fromEntries(landmarks.map(id => {
    const l = listed.find(x => x?.id === id);
    return [id, typeof l?.plannedVisible === 'boolean' ? l.plannedVisible : null];
  })) as Record<string, boolean | null>;
  return { contextFound: true, references, predecessor,
    referenceStatus: isObject(context.referenceStatus) ? { entities: status('entities'), locations: status('locations') } : null, plannedVisible };
}
/** Physical paths (junctions and symlinks resolved), compared case-insensitively on Windows. */
const physical = (p: string) => { try { return realpathSync.native(p); } catch { return realpathSync(p); } };
const comparable = (p: string) => process.platform === 'win32' ? p.toLowerCase() : p;
function within(dir: string, target: string) {
  const rel = path.relative(comparable(dir), comparable(target));
  return rel === '' || !(rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
}
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
  // An invariant of one entity that names another entity (e.g. a tail "made of an orange block" beside a separate orange block prop).
  // Per invariant, so the render check below looks for exactly the text that names it. A text heuristic, never an instance verdict.
  const partMentions = entities.flatMap(e => (e.invariants ?? []).flatMap(inv =>
    entities.filter(f => f.id !== e.id && String(inv.value).toLowerCase().includes(f.id.split('_').join(' ').toLowerCase()))
      .map(f => ({ entity: e.id, mentions: f.id, attribute: inv.attribute, text: String(inv.value) }))));
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
      const prompt = render ? renderPrompt(render) : '', review = qa ? reviewFields(reviewContext(qa), landmarks) : null;
      const uniqueLine = (prompt.match(/UNIQUE LANDMARKS \(one each, never duplicated\):[^\n.]*/) ?? [])[0] ?? null;
      const plannedVisible = review?.plannedVisible ?? Object.fromEntries(landmarks.map(id => [id, null]));
      const renderLandmarks = listAfter(uniqueLine);
      const renderReferences = ((render?.references ?? []) as any[]).map(r => String(r?.imageName ?? ''));
      return { attempt: Number(a.attempt), renderWire: !!render, reviewWire: !!qa,
        render: { references: renderReferences, previousPageImage: renderReferences.some(r => /^page_\d+_\d+\.png$/.test(r)),
          contextPredecessor: (prompt.match(/"predecessor":(null|\{[^}]*\})/) ?? [])[1] ?? null,
          uniqueLandmarksLine: uniqueLine, notYetLine: (prompt.match(/NOT YET IN THE STORY[^\n]*/) ?? [])[0] ?? null,
          mentionsPlannedVisible: /plannedVisible/.test(prompt),
          partMentionsInRender: partMentions.map(p => ({ entity: p.entity, mentions: p.mentions, attribute: p.attribute, inRender: prompt.includes(p.text) })) },
        review: review ? { contextFound: review.contextFound, references: review.references, predecessor: review.predecessor,
          referenceStatus: review.referenceStatus, plannedVisible } : null,
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

/**
 * Writes the report once (exclusive create), never inside the saved book. Checked both as written and PHYSICALLY: the book and the
 * output's existing parent are resolved through junctions and symlinks, so an alias that points into the book is refused too.
 */
export function writeAuditionContinuityReport(bookDir: string, outFile: string, options: ContinuityReportOptions = {}) {
  if (!path.isAbsolute(outFile)) return fail('continuity_report_output');
  const book = path.resolve(bookDir), out = path.resolve(outFile), parent = path.dirname(out);
  // The physical comparison also covers every lexical case (a path written inside the book resolves inside it too).
  if (!existsSync(parent) || within(physical(book), path.join(physical(parent), path.basename(out)))) fail('continuity_report_output');
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

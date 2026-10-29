import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { acceptPersonalBookRequest } from '../request-acceptance';
import { resolvePersonalWizardOptions } from '../options';
import { enqueueMomentumBook, prepareMomentumRequest, type MomentumWizardConfig } from '../momentum-book-bridge';
import { MOMENTUM_BOOK_TRIAL, assertRequestBinding, requestBindingUnchanged, trialConfigSchema, type TrialConfig } from '../../../scripts/personal-book-e2e-trial';

// R17 R4 F1 (2026-10-29): a momentum request is admitted only from its exact Wizard receipt, whose hashes the grant-bound config holds.
const ROOT = process.cwd(), sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
const request = {
  kind: 'personal_book_request', version: 'reviewed-personal-book-request/v3', draftId: 'd_bindingtest0001', draftRevision: 1,
  child: { name: 'עידו', age: 6, address: 'boy', residence: 'כפר סבא', nameSource: 'typed', ageSource: 'typed', addressSource: 'typed', residenceSource: 'typed' },
  facts: [{ id: 'f_bindingtest001', kind: 'interest', value: 'לסדר קוביות בצורות מצחיקות', source: 'typed' }], noDifficulty: true,
  storyPlace: { value: 'בחדר המשחקים בבית', source: 'typed' }, companion: { id: 'elephant_momo' }, intent: { kind: 'just_for_fun' }, avoid: [],
  appearance: { photo: 'none' }, bookOptions: { lengthId: 'short', voiceId: 'dad_v2' } };

/** A scratch run: the real route writes the intake; the binding and config are written as the operator writes them. */
function receipt() {
  const run = mkdtempSync(path.join(tmpdir(), 'request-binding-')), wizardFile = path.join(run, 'wizard-config.json');
  const wizard: MomentumWizardConfig = { version: 'local-momentum-wizard-config/v1', cycle: MOMENTUM_BOOK_TRIAL.id, seed: 'binding-test-seed',
    intakeFile: path.join(run, 'wizard-intake.json'), runDirectory: run, bookDir: path.join(run, 'book') };
  writeFileSync(wizardFile, JSON.stringify(wizard, null, 2) + '\n');
  const accepted = acceptPersonalBookRequest(request, resolvePersonalWizardOptions(ROOT));
  if (!accepted.ok) throw new Error('fixture_request');
  enqueueMomentumBook(wizard, { request: accepted.canonical, requestId: accepted.requestId }, ROOT);
  const { prepared } = prepareMomentumRequest(accepted.canonical, wizard, ROOT);
  const profileSha = 'e'.repeat(64), bindingFile = path.join(run, 'INTAKE-BINDING.json');
  writeFileSync(bindingFile, JSON.stringify({ intakeFile: wizard.intakeFile, intakeSha256: sha(wizard.intakeFile), requestId: prepared.accepted.requestId,
    voiceId: 'dad_v2', wizardConfigSha256: sha(wizardFile), profileSha256: profileSha }, null, 2) + '\n');
  const config = { version: 'book-e2e-trial-config/v1', cycle: MOMENTUM_BOOK_TRIAL.id, ownerFile: path.join(run, 'owner.txt'), ownerSha: 'a'.repeat(64),
    bookDir: wizard.bookDir, profileFile: path.join(run, 'profile.json'), profileSha, executable: path.join(run, 'claude.exe'), executableSha256: 'c'.repeat(64),
    keyFile: path.join(run, 'never.env'), operatorFile: path.join(run, 'operator.cjs'), operatorSha: 'd'.repeat(64),
    requestBinding: { version: 'wizard-request-binding/v1', intakeFile: wizard.intakeFile, intakeSha256: sha(wizard.intakeFile), bindingFile,
      bindingSha256: sha(bindingFile), wizardConfigFile: wizardFile, wizardConfigSha256: sha(wizardFile) } } as TrialConfig;
  const edit = (file: string, change: (v: any) => void, spacing = 2) => { const v = JSON.parse(readFileSync(file, 'utf8')); change(v); writeFileSync(file, JSON.stringify(v, null, spacing) + '\n'); };
  /** An attacker who also rewrites the binding and the config's expected hashes to the new bytes (a self-consistent but different config). */
  const resealed = () => { edit(bindingFile, b => { b.intakeSha256 = sha(wizard.intakeFile); });
    return { ...config, requestBinding: { ...(config as any).requestBinding, intakeSha256: sha(wizard.intakeFile), bindingSha256: sha(bindingFile) } } as TrialConfig; };
  return { run, wizard, wizardFile, bindingFile, config, prepared, edit, resealed, done: () => rmSync(run, { recursive: true, force: true }) };
}

describe('momentum request binding: the exact Wizard receipt is sealed by the grant-bound config', () => {
  it('admits the exact receipts and returns the descriptor the plan records', () => {
    const r = receipt();
    try {
      expect(assertRequestBinding(r.config, r.prepared)).toEqual({ ...(r.config as any).requestBinding, requestId: r.prepared.accepted.requestId,
        optionsFingerprint: r.prepared.accepted.optionsFingerprint });
      expect(() => requestBindingUnchanged(r.config)).not.toThrow();
    } finally { r.done(); }
  });
  it('the config schema requires the binding for momentum only', () => {
    const r = receipt();
    try {
      expect(trialConfigSchema.safeParse(r.config).success).toBe(true);
      const { requestBinding: _b, ...unbound } = r.config as any;
      expect(trialConfigSchema.safeParse(unbound).success).toBe(false);
      expect(trialConfigSchema.safeParse({ ...r.config, requestBinding: { ...(r.config as any).requestBinding, version: 'v0' } }).success).toBe(false);
      expect(trialConfigSchema.safeParse({ ...unbound, cycle: 'owner-portrait-book-20261024/v1' }).success).toBe(true);
    } finally { r.done(); }
  });
  it('refuses the R4 mutant: intake metadata drift with a fully rehashed local binding, under the same config', () => {
    const r = receipt();
    try {
      r.edit(r.wizard.intakeFile, i => { i.optionsFingerprint = '0'.repeat(64); });
      r.edit(r.bindingFile, b => { b.intakeSha256 = sha(r.wizard.intakeFile); });
      expect(() => assertRequestBinding(r.config, r.prepared)).toThrow('trial_request_binding');
    } finally { r.done(); }
  });
  it('refuses a self-consistently resealed config whose receipt contradicts the accepted request', () => {
    for (const [label, change] of [
      ['options fingerprint', (i: any) => { i.optionsFingerprint = '0'.repeat(64); }],
      ['voice', (i: any) => { i.voiceId = 'mom'; }],
      ['consent', (i: any) => { i.consent = 'fictional_new_full_book_trial'; }],
      ['canonical child', (i: any) => { i.request.child.age = 7; }],
      ['request id', (i: any) => { i.requestId = 'f'.repeat(64); }],
      ['wizard config digest', (i: any) => { i.configDigest = 'f'.repeat(64); }],
    ] as const) {
      const r = receipt();
      try { r.edit(r.wizard.intakeFile, change); expect(() => assertRequestBinding(r.resealed(), r.prepared), label).toThrow('trial_request_binding'); }
      finally { r.done(); }
    }
  });
  it('refuses a receipt whose intake AND binding agree on a voice the accepted request did not choose', () => {
    const r = receipt();
    try {
      r.edit(r.wizard.intakeFile, i => { i.voiceId = 'mom'; }); r.edit(r.bindingFile, b => { b.voiceId = 'mom'; });
      expect(() => assertRequestBinding(r.resealed(), r.prepared)).toThrow('trial_request_binding');
    } finally { r.done(); }
  });
  it('is an exact byte seal: harmless reserialization, a binding-only change, a Wizard config change or a missing binding all refuse', () => {
    const cases: Array<[string, (r: ReturnType<typeof receipt>) => void]> = [
      ['intake reserialized', r => r.edit(r.wizard.intakeFile, () => {}, 0)],
      ['binding reserialized', r => r.edit(r.bindingFile, () => {}, 0)],
      ['binding profile hash', r => r.edit(r.bindingFile, b => { b.profileSha256 = 'f'.repeat(64); })],
      ['wizard config reserialized', r => r.edit(r.wizardFile, () => {}, 0)],
      ['binding missing', r => rmSync(r.bindingFile)],
    ];
    for (const [label, change] of cases) {
      const r = receipt();
      try { change(r); expect(() => assertRequestBinding(r.config, r.prepared), label).toThrow('trial_request_binding');
        expect(() => requestBindingUnchanged(r.config), label).toThrow('trial_request_binding'); }
      finally { r.done(); }
    }
  });
  it('refuses a receipt bound to another profile or book even when every file is exact', () => {
    const r = receipt();
    try {
      expect(() => assertRequestBinding({ ...r.config, profileSha: 'f'.repeat(64) } as TrialConfig, r.prepared)).toThrow('trial_request_binding');
      expect(() => assertRequestBinding({ ...r.config, bookDir: path.join(r.run, 'other-book') } as TrialConfig, r.prepared)).toThrow('trial_request_binding');
      expect(() => assertRequestBinding({ ...r.config, cycle: 'owner-portrait-book-20261024/v1' } as TrialConfig, r.prepared)).toThrow('trial_request_binding');
    } finally { r.done(); }
  });
  it('a later in-flight change refuses at the next guard', () => {
    const r = receipt();
    try {
      expect(() => requestBindingUnchanged(r.config)).not.toThrow();
      writeFileSync(r.wizard.intakeFile, readFileSync(r.wizard.intakeFile, 'utf8') + ' ');
      expect(() => requestBindingUnchanged(r.config)).toThrow('trial_request_binding');
    } finally { r.done(); }
  });
  it('the runner checks the seal while planning and inside its paid-input guard', () => {
    const src = readFileSync(path.join(ROOT, 'scripts/personal-book-e2e-trial.ts'), 'utf8');
    expect(src).toContain('const requestBinding=momentum?assertRequestBinding(config,context.prepared):null;');
    expect(src).toContain('...(requestBinding?{requestBinding}:{})');
    expect(src).toContain("if(momentum)requestBindingUnchanged(config);");
  });
});

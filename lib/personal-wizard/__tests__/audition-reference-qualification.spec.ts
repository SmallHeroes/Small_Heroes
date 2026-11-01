import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REFERENCE_QUALIFICATION_VERSION } from '../simple-book-reviewed-audition';
import { trialAuditionContracts } from '../../../scripts/personal-book-e2e-trial';

const TRIAL = path.resolve(__dirname, '../../../scripts/personal-book-e2e-trial.ts');

describe('reference-qualification/v1 binding in the book trial', () => {
  it('maps only an exact grant declaration: absent is no contract, anything else refuses', () => {
    expect(trialAuditionContracts({})).toEqual({});
    expect(trialAuditionContracts({ freshCohort: 'audition-fresh-cohort/v1', structuralAnatomy: true })).toEqual({});
    expect(trialAuditionContracts({ referenceQualification: REFERENCE_QUALIFICATION_VERSION })).toEqual({ referenceQualification: REFERENCE_QUALIFICATION_VERSION });
    for (const bad of [true, 'reference-qualification/v2', null, 1]) expect(() => trialAuditionContracts({ referenceQualification: bad })).toThrow('trial_visual_contract');
  });

  it('the native wrapper receives grant visual authority only after grant/plan binding; legacy cycles stay unmarked by default', () => {
    const source = readFileSync(TRIAL, 'utf8'), body = source.slice(source.indexOf('export async function executeBookTrial'));
    expect(source.match(/illustrateReviewedAudition\(/g)).toHaveLength(1);
    const at = body.indexOf('runTrialAudition('), call = body.slice(at, body.indexOf('progress:e=>', at));
    expect(call).toContain('visual:grant.visual');
    const wrapper = source.slice(source.indexOf('export async function runTrialAudition'), source.indexOf('export function trialBookVisualQualification'));
    expect(wrapper).toContain('bound=trialAuditionContracts(visual)'); expect(wrapper).toContain('...bound');
    expect(body.indexOf("if(!same(grant,plan))fail('trial_plan_changed');")).toBeGreaterThan(0);
    expect(body.indexOf("if(!same(grant,plan))fail('trial_plan_changed');")).toBeLessThan(at);
    const plan = source.slice(source.indexOf('function planTrialInputs'), source.indexOf('export function planBookTrial'));
    expect(plan).toContain('visual:{...(config.engineContinuity?');
    expect(plan).toContain('}:{freshCohort:AUDITION_FRESH_COHORT_VERSION})');
  });
});

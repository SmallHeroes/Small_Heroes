import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalHash } from '@/lib/canonical-json';
import { canonicalContentAddressedJsonBytes } from '../canonicalContentAddressedJson';
import { validateSemanticCorrectionForCurrentConsumer } from '../semanticCorrectionConsumerValidation';
import { readCurrentQaWizardConsumerRepositoryAuthority, qaWizardCandidateBridgeManifestIsValid,
  loadQaWizardCandidateBridgeManifest } from '../qaWizardCandidateBridge';
import { recordSemanticCorrectionApproval, loadApprovedSemanticCorrection, prepareSemanticCorrectionBridge,
  loadSemanticCorrectionBridge, type RecordSemanticCorrectionApprovalRequest } from '../semanticCorrectionApprovalBridge';
import { buildSemanticCorrectionReviewPacket } from '../semanticCorrectionPreview';
import { buildProductionReconciliationDraftFromSourceSnapshot } from '../reconciliationLifecycle';
import { p1SemanticRecoveryFixture, P1_REQUEST } from './fixtures/semantic-recovery-p1-fixture';

vi.mock('../semanticCorrectionConsumerValidation', async original => ({
  ...await original<typeof import('../semanticCorrectionConsumerValidation')>(), validateSemanticCorrectionForCurrentConsumer: vi.fn(),
}));
vi.mock('../qaWizardCandidateBridge', async original => ({
  ...await original<typeof import('../qaWizardCandidateBridge')>(), readCurrentQaWizardConsumerRepositoryAuthority: vi.fn(),
}));
const validate=vi.mocked(validateSemanticCorrectionForCurrentConsumer);
const current=vi.mocked(readCurrentQaWizardConsumerRepositoryAuthority);
let root:string;
let request:RecordSemanticCorrectionApprovalRequest;
let validated:Awaited<ReturnType<typeof validateSemanticCorrectionForCurrentConsumer>>;
const rel=(file:string)=>path.relative(process.cwd(),file).replace(/\\/g,'/');
const abs=(file:string)=>path.join(process.cwd(),file);
function rewrite(file:string, change:(value:any)=>void, rehash=false) {
  const value=JSON.parse(fs.readFileSync(abs(file),'utf8'));change(value);
  if(rehash){const {digest:_d,digestAlgorithm:_a,...payload}=value;value.digest=canonicalHash(payload);
    file=rel(path.join(path.dirname(abs(file)),`${value.digest}.json`));}
  fs.writeFileSync(abs(file),canonicalContentAddressedJsonBytes(value));return {file,value};
}
async function approve(){return recordSemanticCorrectionApproval({...request,write:true});}
async function bridge(){const approved=await approve();return prepareSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),
  approvalPath:approved.artifact.path,expectedApprovalDigest:approved.approval.digest,outputDir:request.outputDir,write:true});}
beforeEach(()=>{
  vi.clearAllMocks();
  fs.mkdirSync(path.join(process.cwd(),'outputs'),{recursive:true});
  root=fs.mkdtempSync(path.join(process.cwd(),'outputs/semantic-approval-test-'));
  const fixture=p1SemanticRecoveryFixture();
  const packet=buildSemanticCorrectionReviewPacket(fixture.context,fixture.plan);
  const git={repositoryRealPath:fs.realpathSync(process.cwd()),branchRef:'refs/heads/codex/test',head:'a'.repeat(40),
    upstreamRef:'refs/remotes/origin/codex/test',upstreamHead:'a'.repeat(40),ahead:0,behind:0,trackedChanges:0,untrackedChanges:0} as const;
  current.mockReturnValue(git);
  validated={packet,historical:{...fixture.context},proof:{digest:'b'.repeat(64),currentConsumer:git,historicalProofDigest:'c'.repeat(64)}} as unknown as typeof validated;
  validate.mockResolvedValue(validated);
  request={validation:{consumerRepoRoot:process.cwd(),reviewPacketPath:'outputs/packet.json',historical:{...P1_REQUEST,
    candidatePath:'unused',authoringRequestPath:'unused',authoringReceiptPath:'unused',authoringReadinessPath:'unused',
    freshReadinessPath:'unused',supervisorExecutionRequestPath:'unused',supervisorExecutionResultPath:'unused'}},
    expectedReviewPacketDigest:packet.digest,approvedBy:'Guy',approvedAt:'2026-09-09T06:20:00.000Z',outputDir:rel(path.join(root,'new-output'))};
});
afterEach(()=>{vi.restoreAllMocks();if(root)fs.rmSync(root,{recursive:true,force:true});});

describe('exact semantic approval and changed-coverage pending bridge',()=>{
  it('previews approval with no directory or artifact write',async()=>{
    const result=await recordSemanticCorrectionApproval(request);
    expect(result.artifact.created).toBe(false);expect(fs.existsSync(abs(request.outputDir))).toBe(false);
    expect(result.approval).toMatchObject({decision:'approved',approvedBy:'Guy',authorityScope:'exact_semantic_correction_approval_only'});
    expect(result.approval.doesNotAuthorize).toContain('image_render');
    expect(result.approval.subject.original.coverageDigest).not.toBe(result.approval.subject.effective.coverageDigest);
  });
  it('persists one immutable approval, replays identically and reloads using fresh validation',async()=>{
    const first=await approve();const second=await approve();
    expect(first.artifact.created).toBe(true);expect(second.artifact.created).toBe(false);expect(second.approval).toEqual(first.approval);
    validate.mockClear();
    const loaded=await loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:first.artifact.path,expectedApprovalDigest:first.approval.digest});
    expect(loaded.approval).toEqual(first.approval);expect(validate).toHaveBeenCalledExactlyOnceWith(request.validation);
  });
  it('routes effective template AND coverage into the real pending reconciliation projection',async()=>{
    const before=canonicalContentAddressedJsonBytes(validated.packet);
    const result=await bridge();const effective=validated.packet.correction.effective;
    expect(canonicalContentAddressedJsonBytes(validated.packet)).toBe(before);
    expect(canonicalHash(result.manifest.effective.template)).toBe(result.manifest.effective.templateDigest);
    expect(canonicalHash(result.manifest.effective.coverage)).toBe(result.manifest.effective.coverageDigest);
    expect(result.manifest).toMatchObject({version:'qa-wizard-candidate-bridge-manifest/v6',stage:'reconciliation_pending',productionContext:null});
    expect(result.manifest.effective.coverageDigest).toBe(effective.coverageDigest);
    expect(result.manifest.reconciliation).toEqual(buildProductionReconciliationDraftFromSourceSnapshot({
      snapshot:validated.historical.snapshot,template:effective.template,actionSemanticCoverage:effective.coverage}));
    expect(result.manifest.reconciliation.reconciliation.review.status).toBe('pending');
    expect(result.manifest.doesNotAuthorize).toContain('blueprint_authoring');
    const loaded=await loadSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),manifestPath:result.artifact.path,expectedManifestDigest:result.manifest.digest});
    expect(loaded.manifest).toEqual(result.manifest);
    expect(qaWizardCandidateBridgeManifestIsValid(result.manifest)).toBe(false);
    expect(()=>loadQaWizardCandidateBridgeManifest({repoRoot:process.cwd(),manifestPath:result.artifact.path})).toThrow();
  });
  it('previews pending bridge without creating its output root',async()=>{
    const approval=await approve();const outputDir=rel(path.join(root,'bridge-preview'));
    const result=await prepareSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),approvalPath:approval.artifact.path,
      expectedApprovalDigest:approval.approval.digest,outputDir});
    expect(result.artifact.created).toBe(false);expect(fs.existsSync(abs(outputDir))).toBe(false);
  });
  it('rejects an expected packet mismatch before creating output',async()=>{
    await expect(recordSemanticCorrectionApproval({...request,expectedReviewPacketDigest:'d'.repeat(64),write:true})).rejects.toThrow('expected_packet_mismatch');
    expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  });
  it.each([{approvedBy:'Claude'},{approvedAt:'2026-09-09'},{approvedAt:'bad'},{write:'true'},
    {expectedReviewPacketDigest:'bad'},{proof:{}},{bridgeManifest:{}},{outputDir:'../escape'},
    {outputDir:'outputs/a/../b'},{outputDir:'outputs\\escape'},{outputDir:'story-bank/new'}])('rejects invalid input %j',async change=>{
    await expect(recordSemanticCorrectionApproval({...request,write:true,...change} as any)).rejects.toThrow();
    expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  });
  it('pins the original caller arguments across async validation',async()=>{
    validate.mockImplementationOnce(async()=>{request.approvedAt='2020-01-01T00:00:00.000Z';request.validation.reviewPacketPath='changed';return validated;});
    const result=await recordSemanticCorrectionApproval(request);
    expect(result.approval.approvedAt).toBe('2026-09-09T06:20:00.000Z');
    expect(result.approval.validationRequest.reviewPacketPath).toBe('outputs/packet.json');
  });
  it('rejects current Git movement immediately before persistence',async()=>{
    current.mockReturnValue({...validated.proof.currentConsumer,head:'e'.repeat(40),upstreamHead:'e'.repeat(40)});
    await expect(approve()).rejects.toThrow('consumer_changed_before_publish');expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  });
  it('rejects stale current validation before any output',async()=>{
    validate.mockRejectedValue(new Error('current_dirty'));
    await expect(approve()).rejects.toThrow('current_dirty');expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  });
  it.each(['subject','decision','scope','extra'] as const)('rejects rehashed approval %s substitution',async kind=>{
    const original=await approve();
    const changed=rewrite(original.artifact.path,value=>{
      if(kind==='subject')value.subject.effective.coverageDigest='f'.repeat(64);
      if(kind==='decision')value.decision='pending';
      if(kind==='scope')value.doesNotAuthorize=[];
      if(kind==='extra')value.productionContext={approved:true};
    },true);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:changed.file,expectedApprovalDigest:changed.value.digest})).rejects.toThrow('approval_reconstruction_mismatch');
  });
  it('rejects a digest-swapped approval even if its rehash is self-consistent',async()=>{
    const original=await approve();const changed=rewrite(original.artifact.path,v=>v.approvedAt='2026-09-10T00:00:00.000Z',true);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:changed.file,expectedApprovalDigest:original.approval.digest})).rejects.toThrow('artifact_not_canonical');
  });
  it('rejects approval bytes changed during async validation',async()=>{
    const original=await approve();validate.mockImplementationOnce(async()=>{
      fs.appendFileSync(abs(original.artifact.path),' ');return validated;
    });
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:original.artifact.path,expectedApprovalDigest:original.approval.digest})).rejects.toThrow();
  });
  it.each(['1970-01-01T00:00:00.000Z','2999-12-31T23:59:59.999Z'])('treats canonical operator time %s as metadata, never a replacement for the pinned decision',async approvedAt=>{
    const original=await approve();
    const changed=await recordSemanticCorrectionApproval({...request,approvedAt,write:true});
    expect(changed.approval.approvedAt).toBe(approvedAt);
    expect(changed.approval.subject).toEqual(original.approval.subject);
    expect(changed.approval.digest).not.toBe(original.approval.digest);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:changed.artifact.path,
      expectedApprovalDigest:original.approval.digest})).rejects.toThrow('artifact_not_canonical');
    const loaded=await loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:changed.artifact.path,
      expectedApprovalDigest:changed.approval.digest});
    expect(loaded.approval).toEqual(changed.approval);
    expect(loaded.approval.authorityScope).toBe('exact_semantic_correction_approval_only');
    expect(loaded.approval.doesNotAuthorize).toContain('image_render');
  });
  it.each(['coverage','reconciliation','approval','scope','current'] as const)('rejects rehashed manifest %s substitution',async kind=>{
    const result=await bridge();const changed=rewrite(result.artifact.path,v=>{
      if(kind==='coverage')v.effective.coverageDigest='f'.repeat(64);
      if(kind==='reconciliation')v.reconciliation.reconciliation.review.status='approved';
      if(kind==='approval')v.approval.digest='f'.repeat(64);
      if(kind==='scope')v.productionContext={approved:true};
      if(kind==='current')v.currentValidation.currentConsumer.head='f'.repeat(40);
    },true);
    await expect(loadSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),manifestPath:changed.file,expectedManifestDigest:changed.value.digest})).rejects.toThrow();
  });
  it('keeps content approval reusable but rejects an old pending bridge after current validation changes',async()=>{
    const result=await bridge();const updated={...validated,proof:{...validated.proof,digest:'e'.repeat(64)}};
    validate.mockResolvedValue(updated);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:result.manifest.approval.path,expectedApprovalDigest:result.manifest.approval.digest})).resolves.toBeDefined();
    await expect(loadSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),manifestPath:result.artifact.path,expectedManifestDigest:result.manifest.digest})).rejects.toThrow('manifest_reconstruction_mismatch');
  });
  it('refuses a colliding approval rather than overwriting it',async()=>{
    const first=await approve();const before=fs.readFileSync(abs(first.artifact.path),'utf8')+' ';
    fs.writeFileSync(abs(first.artifact.path),before);await expect(approve()).rejects.toThrow();
    expect(fs.readFileSync(abs(first.artifact.path),'utf8')).toBe(before);
  });
  it('rejects a linked approval file',async()=>{
    const first=await approve();const alias=path.join(root,'hardlink.json');fs.linkSync(abs(first.artifact.path),alias);
    await expect(loadApprovedSemanticCorrection({consumerRepoRoot:process.cwd(),approvalPath:first.artifact.path,expectedApprovalDigest:first.approval.digest})).rejects.toThrow();
  });
  it('rejects noncanonical bytes introduced during store preparation, without replacing those bytes',async()=>{
    const preview=await recordSemanticCorrectionApproval(request);
    const mkdir=fs.mkdirSync;let changed=false;
    vi.spyOn(fs,'mkdirSync').mockImplementation(((file:fs.PathLike,...args:unknown[])=>{
      const result=(mkdir as Function)(file,...args);
      if(!changed && String(file).endsWith('semantic-correction-approvals')){
        changed=true;fs.writeFileSync(abs(preview.artifact.path),JSON.stringify(preview.approval));
      }
      return result;
    }) as typeof fs.mkdirSync);
    await expect(approve()).rejects.toThrow('artifact_not_canonical');
    expect(fs.readFileSync(abs(preview.artifact.path),'utf8')).toBe(JSON.stringify(preview.approval));
  });
  it('rejects a manifest changed during async approval reload',async()=>{
    const result=await bridge();validate.mockImplementationOnce(async()=>{
      fs.appendFileSync(abs(result.artifact.path),' ');return validated;
    });
    await expect(loadSemanticCorrectionBridge({consumerRepoRoot:process.cwd(),manifestPath:result.artifact.path,expectedManifestDigest:result.manifest.digest})).rejects.toThrow();
  });
  it('rejects an aliased output category without creating approval files',async()=>{
    const target=path.join(root,'target');fs.mkdirSync(target);fs.mkdirSync(abs(request.outputDir));
    fs.symlinkSync(target,path.join(abs(request.outputDir),'semantic-correction-approvals'),'junction');
    await expect(approve()).rejects.toThrow('category_alias');expect(fs.readdirSync(target)).toEqual([]);
  });
  it('real CLI rejects unknown/repeated flags and a dirty current request with sanitized output',()=>{
    const file=path.join(root,'request.json');fs.writeFileSync(file,JSON.stringify({operation:'approve',arguments:{...request,write:true}}));
    const cli=['node_modules/tsx/dist/cli.mjs','--require','./scripts/shims/register-server-only.cjs',
      '--require','./lib/set-identity-board/__tests__/fixtures/deny-network.cjs','scripts/semantic-correction-approval-bridge.ts'];
    for(const flags of [['--request',file],['--request',file,'--write'],['--request',file,'--request',file]]){
      const run=spawnSync(process.execPath,[...cli,...flags],{encoding:'utf8',windowsHide:true,timeout:15000});
      expect(run.error).toBeUndefined();expect(run.status).toBe(1);expect(JSON.parse(run.stdout)).toEqual({status:'rejected',providerCalls:0});
    }
    expect(fs.existsSync(abs(request.outputDir))).toBe(false);
  },20000);
});

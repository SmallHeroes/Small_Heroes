import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { previewSha } from '../local-story-preview';
import { comparisonModels } from '../visual-qa-comparison';
import { frozenPromptSha, loadFrozenBenchmark, runFrozenBenchmark } from '../../scripts/lib/frozen-qa-benchmark';

let root:string, local:string, output:string, bytes:Buffer;
beforeEach(async()=>{
  root=fs.mkdtempSync(path.join(os.tmpdir(),'sh-frozen-qa-')); local=path.join(root,'inputs'); output=path.join(root,'outputs');
  fs.mkdirSync(local);fs.mkdirSync(output);
  bytes=await sharp({create:{width:64,height:64,channels:3,background:'#fab'}}).png().toBuffer();
  fs.writeFileSync(path.join(local,'sample.png'),bytes);
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();fs.rmSync(root,{recursive:true,force:true});});
const config=()=>({version:'frozen-qa-benchmark/v1',id:'test',promptSha:frozenPromptSha(),cases:[{id:'case-a',root:'local',file:'sample.png',sha:previewSha(bytes),cohort:'expansion',family:'test-family',label:{expected:'pass',authority:'provisional',basis:'label-sentinel'}}]});
const roots=()=>({local,archive:local});
const args=()=>({raw:config(),roots:roots(),outputParent:output,key:'secret-sentinel'});
const good={anatomy:{verdict:'pass',explanation:'coherent',findings:[]},otherFindings:[]};
const prediction=()=>new Response(JSON.stringify({id:'prediction123',model:comparisonModels.qwen.name,version:'hidden',status:'succeeded',output:JSON.stringify(good)}));

describe('frozen visual QA benchmark',()=>{
  it('binds proposals to a persisted detector report and exercises finding verification transport',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    const findings=[{id:'f-0',location:'hand',evidence:'Alleged fusion.'}];
    const reportBytes=Buffer.from(JSON.stringify({results:[{sha:previewSha(bytes),observed:'defect',review:{anatomy:{findings:findings.map(({id,...f})=>f)}}}]}));
    fs.writeFileSync(path.join(local,'detector.json'),reportBytes);
    const raw={...config(),severityPolicy:'verify-findings',promptSha:frozenPromptSha(false,'verify-findings'),cases:[{...config().cases[0],findingReview:{sourceReportFile:'detector.json',sourceReportSha:previewSha(reportBytes),findings}}]};
    const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'prediction123',model:comparisonModels.qwen.name,version:'hidden',status:'succeeded',output:JSON.stringify({assessments:[{findingId:'f-0',classification:'unsupported',evidence:'Normal contact.'}]})})));
    expect((await runFrozenBenchmark({...args(),raw,fetcher:mock as typeof fetch})).results[0].observed).toBe('pass');
    const body=JSON.parse(mock.mock.calls[0][1].body);expect(body.input.prompt).toContain('Alleged fusion.');expect(body.input.prompt).not.toContain('detector.json');
    const changed=JSON.parse(JSON.stringify(raw));changed.cases[0].findingReview.findings[0].evidence='Different claim';
    expect(()=>loadFrozenBenchmark(changed,roots())).toThrow('benchmark_finding_source_binding');
    fs.writeFileSync(path.join(local,'detector.json'),'changed');expect(()=>loadFrozenBenchmark(raw,roots())).toThrow('benchmark_report_changed');
  });
  it('uses severe-only parsing through the real transport and binds policy changes',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    const raw={...config(),severityPolicy:'severe-only',promptSha:frozenPromptSha(false,true)};
    const reply={anatomy:{verdict:'pass',explanation:'No severe defect.',findings:[]},nonBlockingObservations:[{location:'fingers',evidence:'Simplified grip.'}]};
    const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'prediction123',model:comparisonModels.qwen.name,version:'hidden',status:'succeeded',output:JSON.stringify(reply)})));
    const report=await runFrozenBenchmark({...args(),raw,fetcher:mock as typeof fetch});
    expect(report.results[0]).toMatchObject({observed:'pass',review:{nonBlockingObservations:reply.nonBlockingObservations},renderAuthorized:false});
    expect(JSON.parse(mock.mock.calls[0][1].body).input.system_prompt).toContain('OBVIOUS, SEVERE');
    await expect(runFrozenBenchmark({...args(),fetcher:mock as typeof fetch})).rejects.toThrow('preview_input_changed_new_run_required');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('sends full image plus exact crop with distinct roles and preserves full-only policy',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    const raw={...config(),viewMode:'full-and-details',promptSha:frozenPromptSha(true),cases:[{...config().cases[0],detailBox:{left:8,top:8,width:32,height:32}}]};
    const mock=vi.fn().mockImplementation(async()=>prediction());
    await runFrozenBenchmark({...args(),raw,fetcher:mock as typeof fetch});
    const sent=JSON.parse(mock.mock.calls[0][1].body).input;
    const detail=await sharp(bytes).extract(raw.cases[0].detailBox).png().toBuffer();
    expect(sent.image).toEqual([`data:image/png;base64,${bytes.toString('base64')}`,`data:image/png;base64,${detail.toString('base64')}`]);
    expect(sent.prompt).toContain('SAME target, not examples');expect(sent.prompt).not.toContain('label-sentinel');
    expect(fs.readFileSync(path.join(output,'qa-validation-test','case-a-detail.png'))).toEqual(detail);
    expect(fs.readFileSync(path.join(local,'sample.png'))).toEqual(bytes);
    const forbidden=vi.fn().mockRejectedValue(Error('no network'));
    await runFrozenBenchmark({...args(),raw,fetcher:forbidden as typeof fetch});expect(forbidden).not.toHaveBeenCalled();
    expect(frozenPromptSha()).not.toBe(frozenPromptSha(true));
  });
  it('rejects missing, unexpected and out-of-image detail boxes before provider calls',async()=>{
    const mock=vi.fn();
    const raw={...config(),viewMode:'full-and-details',promptSha:frozenPromptSha(true)};
    expect(()=>loadFrozenBenchmark(raw,roots())).toThrow('benchmark_detail_mode');
    const box={left:0,top:0,width:100,height:100};
    expect(()=>loadFrozenBenchmark({...config(),cases:[{...config().cases[0],detailBox:box}]},roots())).toThrow('benchmark_detail_mode');
    await expect(runFrozenBenchmark({...args(),raw:{...raw,cases:[{...raw.cases[0],detailBox:box}]},fetcher:mock as typeof fetch})).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();expect(fs.readdirSync(output)).toEqual([]);
  });
  it('preflights exact bytes without changing them',()=>{
    expect(loadFrozenBenchmark(config(),roots()).targets[0].bytes).toEqual(bytes);
    expect(fs.readFileSync(path.join(local,'sample.png'))).toEqual(bytes);
  });
  it.each(['../sample.png','/sample.png','folder/../sample.png','sample.env'])('rejects unsafe file %s',file=>{
    const raw=config();raw.cases[0].file=file;expect(()=>loadFrozenBenchmark(raw,roots())).toThrow('benchmark_path_invalid');
  });
  it('rejects a symlink escape even for an allowed PNG filename',()=>{
    const outside=path.join(root,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'sample.png'),bytes);
    fs.symlinkSync(outside,path.join(local,'linked'),'junction');
    const raw=config();raw.cases[0].file='linked/sample.png';expect(()=>loadFrozenBenchmark(raw,roots())).toThrow('benchmark_path_escape');
  });
  it('rejects bad hashes and non-PNG contents before creating an output run',async()=>{
    const raw=config(), mock=vi.fn();raw.cases[0].sha='0'.repeat(64);
    await expect(runFrozenBenchmark({...args(),raw,fetcher:mock as typeof fetch})).rejects.toThrow('benchmark_image_changed');
    fs.writeFileSync(path.join(local,'sample.png'),'not a png');raw.cases[0].sha=previewSha('not a png');
    expect(()=>loadFrozenBenchmark(raw,roots())).toThrow('benchmark_image_changed');
    expect(mock).not.toHaveBeenCalled();expect(fs.readdirSync(output)).toEqual([]);
  });
  it('prevents prompt, call-limit, duplicated-case and inconsistent-label overrides',()=>{
    const raw=config();raw.promptSha='0'.repeat(64);expect(()=>loadFrozenBenchmark(raw,roots())).toThrow('benchmark_prompt_changed');
    const duplicate=config();duplicate.cases.push({...duplicate.cases[0],id:'case-b'});expect(()=>loadFrozenBenchmark(duplicate,roots())).toThrow('benchmark_duplicate_case');
    expect(()=>loadFrozenBenchmark({...config(),maxCalls:50},roots())).toThrow();
    expect(()=>loadFrozenBenchmark({...config(),cases:Array(13).fill(config().cases[0])},roots())).toThrow();
    const bad=config();bad.cases[0].label.authority='unlabelled';expect(()=>loadFrozenBenchmark(bad,roots())).toThrow('benchmark_label_inconsistent');
  });
  it('rejects production execution',()=>{vi.stubEnv('NODE_ENV','production');expect(()=>loadFrozenBenchmark(config(),roots())).toThrow('benchmark_local_only');});
  it('uses the real transport, hides labels, replays without POST and binds the whole manifest',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    const mock=vi.fn().mockImplementation(async()=>prediction());
    const report=await runFrozenBenchmark({...args(),fetcher:mock as typeof fetch});
    expect(report).toMatchObject({generalAccuracyProven:false,renderAuthorized:false,cohorts:[{cohort:'replication'},{cohort:'expansion',provisional:{matched:1}}]});
    expect(mock).toHaveBeenCalledTimes(1);
    const body=mock.mock.calls[0][1].body;
    for(const s of ['sample.png','label-sentinel','case-a','provisional','expected']) expect(body).not.toContain(s);
    expect(mock.mock.calls[0][0]).toBe('https://api.replicate.com/v1/models/qwen/qwen3-7-plus/predictions');
    const forbidden=vi.fn().mockRejectedValue(Error('network forbidden'));
    expect(await runFrozenBenchmark({...args(),fetcher:forbidden as typeof fetch})).toEqual(report);
    expect(forbidden).not.toHaveBeenCalled();
    const changed=config();changed.cases[0].label.expected='defect';
    await expect(runFrozenBenchmark({...args(),raw:changed,fetcher:forbidden as typeof fetch})).rejects.toThrow('preview_input_changed_new_run_required');
  });
  it('keeps a lost dispatch UNKNOWN with no automatic resubmission',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    const failed=vi.fn().mockRejectedValue(Error('transport'));
    const first=await runFrozenBenchmark({...args(),fetcher:failed as typeof fetch});
    expect(first.results[0].observed).toBe('unknown');
    expect(await runFrozenBenchmark({...args(),fetcher:failed as typeof fetch})).toEqual(first);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(output,'qa-validation-test','run.lock'))).toBe(false);
  });
  it('refuses an occupied run lock without removing it',async()=>{
    vi.spyOn(console,'log').mockImplementation(()=>{});
    await runFrozenBenchmark({...args(),fetcher:vi.fn().mockImplementation(async()=>prediction()) as typeof fetch});
    const lock=path.join(output,'qa-validation-test','run.lock');fs.writeFileSync(lock,'other writer');
    const mock=vi.fn();await expect(runFrozenBenchmark({...args(),fetcher:mock as typeof fetch})).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();expect(fs.readFileSync(lock,'utf8')).toBe('other writer');
  });
});

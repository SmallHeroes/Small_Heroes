"""M19 cumulative owner recovery, no actual Git index/commit or provider action."""
from pathlib import Path
import hashlib, importlib.util, json, subprocess, sys
sys.dont_write_bytecode = True
W=Path('C:/GNart/Work/sh-engine-site-launch')
Q=Path(__file__).resolve().parent
FOLDER='_review/engine-site-launch/m19-r5-corrections'
P=W/FOLDER
BASE='36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd'
BRANCH='codex/engine-site-launch-20261104'
def read(f): return json.loads(Path(f).read_text('utf-8-sig'))
def sha(f): return hashlib.sha256(Path(f).read_bytes()).hexdigest()
def ps(v): return "'"+str(v).replace("'","''")+"'"
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module
def recovery(paths):
    prior=load('m18_recovery',W/'_review/engine-site-launch/m18-r4-corrections/freeze_package.py')
    prior.W=W;prior.FOLDER=FOLDER;prior.BASE=BASE;prior.BRANCH=BRANCH
    return prior.recovery(paths).replace('M18','M19')
def main():
    assert not (P/'READY.json').exists()
    gate=read(Q/'final-full.exit.json'); types=read(Q/'TYPESCRIPT-RESULT-final.json'); preservation=read(Q/'PRESERVATION-END.json'); linux=read(Q/'LINUX-NATIVE-CLEANUP-RESULT.json')
    assert gate['code']==0 and gate['result']['failed']==0 and gate['result']['pending']==0
    assert all(row['code']==0 for row in types) and not preservation['unexpectedMismatches']
    assert read(Q/'linux-native-cleanup.exit.json')['code']==0 and linux['oldExtractionRemoved'] and linux['survivingPeerTamperRefusedBeforeRemoval']
    P.mkdir(parents=True,exist_ok=False)
    (P/'DECISION-GATE.md').write_text((Q/'DECISION-GATE.md').read_text('utf-8'),'utf-8')
    (P/'REPORT.md').write_text((Q/'REPORT-DRAFT.md').read_text('utf-8'),'utf-8')
    (P/'CLAUDE-REGATE.md').write_text((Q/'CLAUDE-REGATE-DRAFT.md').read_text('utf-8'),'utf-8')
    files=['INTAKE-VERIFIED.json','PRESERVATION-END.json','final-full.exit.json','TYPESCRIPT-RESULT-final.json','LINUX-NATIVE-CLEANUP-RESULT.json','linux-native-cleanup.exit.json','R17-HISTORICAL-PRESERVATION.json']
    validation={'localRequiredGatesSatisfied':True,'independentQA':'PENDING_MANUAL_CLAUDE','providerCalls':0,'newExpenseMicroUsd':0,'focused':gate['result'],'typescript':types,'linuxNativeCleanup':linux,'newFullBuild':False,'fullBuildBaseline':'M18 Linux full build/native media proof retained as inherited baseline only. No fresh M19 Windows/Linux build or Vercel adapter claim. Packaging configs/dependencies/assets unchanged.','npmCheck':'Historical non-green/report-only, no blind repeat. The full relevant pinned gate is new.','evidenceRoot':str(Q),'artifacts':[{'path':str(Q/f),'sha256':sha(Q/f)}for f in files]}
    (P/'VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n','utf-8')
    (P/'freeze_package.py').write_text(Path(__file__).read_text('utf-8'),'utf-8')
    git=lambda *args:subprocess.check_output(['git','-c','safe.directory='+str(W),'-C',str(W),*args],text=True).splitlines()
    previous=read(W/'_review/engine-site-launch/m18-r4-corrections/SCOPE.json');metadata=['DECISION-GATE.md','REPORT.md','CLAUDE-REGATE.md','VALIDATION.json','SCOPE.json','freeze_package.py']
    paths=sorted(set(previous+git('diff','--name-only')+git('ls-files','--others','--exclude-standard','--','app','lib','backend','scripts','config')+[FOLDER+'/'+f for f in metadata]))
    (P/'SCOPE.json').write_text(json.dumps(paths,indent=2)+'\n','utf-8')
    helper=load('owner_package',W/'_review/engine-site-launch/recovery_package.py')
    prior=read(W/'_review/engine-site-launch/m18-r4-corrections/PINS.json');tests=prior['tests']+['lib/engine-site/__tests__/r5-payment-notices.spec.ts']
    pins=helper.freeze(FOLDER,paths,tests,'fix(engine-site): preserve non-primary paid mismatch notices\n\nCumulative M15-M19, USD0 R5-1 correction and bounded classifier/cache/runbook fixes.\nKeep payment/refund authority, exact primary cleanup, fixed rules and historical evidence.\nManual independent Claude re-gate pending; no push, deployment or paid action.')
    (P/'RECOVER.ps1').write_text(recovery(paths),'utf-8')
    pins.update(recoverySha256=sha(P/'RECOVER.ps1'),commitMessageSha256=sha(P/'COMMIT-MESSAGE.txt'),singleMilestone='M15_THROUGH_M19_CUMULATIVE',independentQA='PENDING_MANUAL_CLAUDE',evidenceRoot=str(Q),externalProofFiles=prior['externalProofFiles'])
    (P/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n','utf-8')
    print(json.dumps({'paths':len(paths),'pinsSha256':sha(P/'PINS.json'),'patchSha256':pins['patchSha256']}))
if __name__=='__main__':main()

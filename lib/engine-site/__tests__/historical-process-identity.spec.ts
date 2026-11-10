import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mocked=vi.hoisted(()=>({exec:vi.fn()}));
vi.mock('node:child_process',()=>({execFileSync:mocked.exec}));
import {assertLocalHistoricalProcessGone} from '../local-trial-startup-recovery';
const ended='2026-11-09T21:14:05.000Z';
beforeEach(()=>{mocked.exec.mockReset();});afterEach(()=>vi.restoreAllMocks());
function probe(code?:string,birth='2026-11-10T07:46:06.000Z'){vi.spyOn(process,'kill').mockImplementation(()=>{if(code)throw Object.assign(Error('synthetic process probe'),{code});return true;});mocked.exec.mockReturnValue(birth);}
describe('historical PID identity under Windows permission errors',()=>{
 it('ESRCH remains gone without a CIM command',()=>{probe('ESRCH');expect(()=>assertLocalHistoricalProcessGone(4304,ended)).not.toThrow();expect(mocked.exec).not.toHaveBeenCalled();});
 it('red regression: EPERM for a provably newer protected process uses read-only CIM and passes',()=>{probe('EPERM');expect(()=>assertLocalHistoricalProcessGone(4304,ended)).not.toThrow();expect(mocked.exec).toHaveBeenCalledOnce();expect(mocked.exec.mock.calls[0][1].join(' ')).toContain('ProcessId = 4304');});
 it.each(['2026-11-09T20:00:00.000Z',ended,'','invalid'])('EPERM never means historical death when CIM birth is %j',birth=>{probe('EPERM',birth);expect(()=>assertLocalHistoricalProcessGone(4304,ended)).toThrow('process_alive');});
 it('a denied CIM lookup remains a refusal',()=>{probe('EPERM');mocked.exec.mockImplementation(()=>{throw Error('synthetic_access_denied');});expect(()=>assertLocalHistoricalProcessGone(4304,ended)).toThrow('synthetic_access_denied');});
 it('unrelated kill errors are not swallowed',()=>{probe('EACCES');expect(()=>assertLocalHistoricalProcessGone(4304,ended)).toThrow('synthetic process probe');expect(mocked.exec).not.toHaveBeenCalled();});
 it('ordinary PID reuse and disappearance retain the legacy behavior',()=>{probe();expect(()=>assertLocalHistoricalProcessGone(4304,ended)).not.toThrow();mocked.exec.mockReturnValue('');expect(()=>assertLocalHistoricalProcessGone(4304,ended)).not.toThrow();});
 it.each([0,-1,NaN,1.5,'4304'])('invalid PID %j is refused before inspection',pid=>{expect(()=>assertLocalHistoricalProcessGone(pid,ended)).toThrow('local_startup_process');expect(mocked.exec).not.toHaveBeenCalled();});
});

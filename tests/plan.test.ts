import {describe,it,expect} from 'vitest';
import {compileEditorialPlan} from '../packages/edl/plan';
import {fixture,words} from './fixture';
import {validateEdl} from '../packages/edl';
const plan=()=>({segments:[{first_word:'0',last_word:'31'}],overlays:fixture().structure.hook.text_overlay_options,tension_note:'Conflito presente na fala.',payoff_note:'Conclusão presente na fala.',scores:fixture().scores});
describe('Editorial plan compiler',()=>{
 it('derives timing and captions from original words, with deterministic visual cadence',()=>{const edl=compileEditorialPlan(plan(),words,'viral','test');expect(edl.duration_out).toBe(16);expect(edl.captions.words).toEqual(words);edl.integrity_review='verified';const validated=validateEdl(edl,words,[],['zoom_punch'],true);expect(validated.qa.passed).toBe(true);expect(validated.effects.length).toBeGreaterThan(0);});
 it('rejects invented and duplicated words',()=>{expect(()=>compileEditorialPlan({...plan(),segments:[{first_word:'fake',last_word:'31'}]},words,'viral','test')).toThrow();expect(()=>compileEditorialPlan({...plan(),segments:[{first_word:'0',last_word:'20'},{first_word:'15',last_word:'31'}]},words,'viral','test')).toThrow();});
 it('remaps reordered source spans without estimated timestamps',()=>{const edl=compileEditorialPlan({...plan(),segments:[{first_word:'24',last_word:'31'},{first_word:'0',last_word:'23'}]},words,'viral','test');expect(edl.structure.hook.technique).toBe('cold_open');expect(edl.duration_out).toBe(16);expect(edl.captions.words[8]).toMatchObject({id:'0',t0:4,t1:4.5});});
});

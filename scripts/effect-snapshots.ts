import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill} from '@remotion/renderer';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {fixture,words} from '../tests/fixture';
import {validateEdl} from '../packages/edl';
import {effectCatalog} from '../packages/composition/effects/catalog';
const checking=process.argv.includes('--check');
const temp=await mkdtemp(join(tmpdir(),'clipforge-frames-'));
const serveUrl=await bundle({entryPoint:resolve('packages/composition/root.tsx')});
await mkdir('docs/evidence/effects',{recursive:true});
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','storage/sources/fixture.mp4','-frames:v','1','storage/sources/fixture-image.png']);
const base=process.env.APP_URL||'http://127.0.0.1:3000';
const assets=[{id:'test-image',type:'sticker',license:'Synthetic generated test image',path:base+'/api/media/sources/fixture-image.png'},{id:'test-video',type:'brand',license:'Synthetic generated test video',path:base+'/api/media/sources/fixture.mp4'}];
const report=[];
try{
 for(const effect of effectCatalog){
  let e=fixture();e.effects=[{type:effect.id,t0:0,t1:1,params:effect.id.startsWith('broll_')?{asset_id:effect.id==='broll_video'?'test-video':'test-image'}:effect.defaults,reason:'Visual regression reference.'}];
  e=validateEdl(e,words,assets,effectCatalog.map(e=>e.id),true);
  const inputProps={edl:e,sourceUrl:base+'/api/media/sources/fixture.mp4',sourceMeta:{width:1280,height:720},assets};
  const composition=await selectComposition({serveUrl,id:'ShortComposition',inputProps});composition.width=270;composition.height=480;
  const baseline='docs/evidence/effects/'+effect.id+'.png';const output=checking?join(temp,effect.id+'.png'):baseline;
  await renderStill({serveUrl,composition,inputProps,frame:5,imageFormat:'png',output});
  if(checking)execFileSync('.venv/bin/python',['scripts/compare-frames.py',baseline,output]);
  report.push({id:effect.id,status:checking?'matched':'rendered',frame:5});
 }
 await writeFile('docs/evidence/effects/'+(checking?'check':'report')+'.json',JSON.stringify(report,null,2));
 console.log('Visual frames '+(checking?'matched':'generated')+': '+report.length);
}finally{await rm(temp,{recursive:true,force:true});}

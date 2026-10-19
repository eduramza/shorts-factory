import {readFile} from 'node:fs/promises';
import {fixture} from '../tests/fixture';
import {renderClip} from '../apps/render-worker/src/render';
const run=JSON.parse(await readFile('storage/evidence/youtube-nq5NKs5DDlE/run.json','utf8'));
const e=fixture();e.clip_id='technical-source-check';e.captions.words=[];e.structure.hook.text_overlay_options=['Teste técnico de render','Fonte real autorizada','Sem seleção editorial'];e.integrity_review='review';e.qa={passed:false,violations:[{code:'technical_only',message:'Amostra técnica de codec e render. Não é corte selecionado por IA.',auto_fixed:false}]};
const started=Date.now();const proxy=process.argv.includes('--proxy');
const result=await renderClip(e,proxy?'projects/'+run.projectId+'/proxy.mp4':run.source,[],'evidence/youtube-nq5NKs5DDlE/technical-preview'+(proxy?'-proxy':'')+'.mp4','draft',()=>{},()=>false,{voice:'projects/'+run.projectId+'/voice.wav',clean:'projects/'+run.projectId+'/voice-clean.wav'});
console.log(JSON.stringify({path:result.path,size:result.size,technicalOnly:true,elapsedSeconds:(Date.now()-started)/1000}));

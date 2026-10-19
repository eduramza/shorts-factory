import {open,stat,mkdir,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {config} from '../packages/edl/config';
const path=process.argv[2];
if(!path||!process.argv.includes('--rights-confirmed'))throw new Error('Usage: node --import tsx scripts/ingest-video.ts FILE --rights-confirmed');
const base=process.env.APP_URL||'http://127.0.0.1:3000';
async function call(path:string,body:unknown,method='POST',raw=false){const response=await fetch(base+'/api/'+path,{method,headers:raw?{}:{'Content-Type':'application/json'},body:raw?body as Uint8Array<ArrayBuffer>:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));return result;}
const info=await stat(path);if(info.size>config.maxUploadBytes)throw new Error('Video exceeds upload limit.');
const upload=await call('uploads',{name:basename(path),size:info.size,type:'video/mp4'});
const file=await open(path,'r');
try{for(let index=0,offset=0;offset<info.size;index++,offset+=config.chunkBytes){const size=Math.min(config.chunkBytes,info.size-offset);const bytes=Buffer.alloc(size);await file.read(bytes,0,size,offset);await call('uploads/'+upload.id+'/'+index,new Uint8Array(bytes),'PUT',true);console.log('Uploaded '+Math.round((offset+size)/info.size*100)+'%');}}finally{await file.close();}
const source=await call('uploads/'+upload.id+'/complete',{});
const project=await call('projects',{title:'Validação real · Ei Nerd · Doutor Destino',source:source.source,rights:true,mode:'viral',count:5,language:'pt',context:'Teste real autorizado pelo usuário em 19/10/2026. Fonte: https://www.youtube.com/watch?v=nq5NKs5DDlE . Tema: cultura pop, teorias sobre Doutor Destino. Preservar distinção entre especulação e fato. Excluir publicidade, saudações e chamadas para inscrição.'});
await mkdir('storage/evidence/youtube-nq5NKs5DDlE',{recursive:true});
await writeFile('storage/evidence/youtube-nq5NKs5DDlE/run.json',JSON.stringify({projectId:project.id,source:source.source,originalPath:path,rightsConfirmedAt:new Date().toISOString(),sourceUrl:'https://www.youtube.com/watch?v=nq5NKs5DDlE',requestedClips:5},null,2));
console.log(JSON.stringify(project));

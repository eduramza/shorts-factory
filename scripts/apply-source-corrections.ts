import {readFile,writeFile} from 'node:fs/promises';
const projectId=process.argv[2];if(!projectId)throw new Error('Provide project ID.');
const base=process.env.APP_URL||'http://127.0.0.1:3000';
const transcript=JSON.parse(await readFile('storage/projects/'+projectId+'/transcript.json','utf8'));
const corrections=transcript.words.filter((w:{text:string})=>/\btcheno\b/i.test(w.text)).map((w:{id:string;text:string})=>({id:w.id,expected:w.text,replacement:w.text.replace(/tcheno/i,'Destino'),reason:'Nome próprio confirmado pelo título e contexto da fonte: Doutor Destino. Correção ortográfica; sem alterar timestamps.'}));
const response=await fetch(base+'/api/projects/'+projectId+'/transcript/corrections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corrections)});const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));
await writeFile('storage/evidence/youtube-nq5NKs5DDlE/transcript-corrections.json',JSON.stringify(corrections,null,2));
console.log(JSON.stringify(result));

import {readFile,writeFile} from 'node:fs/promises';
import {selectClips} from '../packages/core/llm';
const transcript=JSON.parse(await readFile('storage/evidence/speech-transcript.json','utf8'));
const result=await selectClips('provider-edl-smoke',transcript.words,'viral',1,[],'Fala sintética em português para testar o contrato completo. Não invente fatos.');
await writeFile('storage/evidence/provider-edl-smoke.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({clips:result.length,qa:result.map(e=>e.qa),duration:result.map(e=>e.duration_out)}));

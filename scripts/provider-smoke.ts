import {z} from 'zod';
import {structured} from '../packages/core/llm';
import {llmSettings} from '../packages/core/llm-provider';
const result=await structured('Responda em português. Retorne somente JSON válido, sem conteúdo adicional.','Responda exatamente com {"ok":true}.',z.object({ok:z.literal(true)}),'provider-smoke');
console.log(JSON.stringify({provider:llmSettings().provider,model:llmSettings().model,...result}));

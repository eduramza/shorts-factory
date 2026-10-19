import Anthropic from '@anthropic-ai/sdk';
export type ChatMessage={role:'user'|'assistant';content:string};
export type LlmResponse={text:string;raw:unknown;provider:string;model:string};
export function llmSettings(){const provider=process.env.LLM_PROVIDER||'anthropic';return {provider,model:process.env.LLM_MODEL||(provider==='anthropic'?'claude-sonnet-5-5':'qwen3.8-flash'),configured:!!(provider==='anthropic'?process.env.ANTHROPIC_API_KEY:process.env.QWEN_API_KEY||process.env.LLM_API_KEY),enabled:process.env.LLM_ENABLED!=='false'};}
export async function requestLlm(system:string,messages:ChatMessage[],options:{maxTokens?:number;signal?:AbortSignal}={}):Promise<LlmResponse>{
 const settings=llmSettings();if(!settings.enabled)throw new Error('IA externa desativada nas configurações do servidor.');
 if(!settings.configured)throw new Error('Configure a chave do provedor '+settings.provider+' no .env para selecionar os cortes.');
 if(settings.provider==='anthropic'){
  const result=await new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY}).messages.create({model:settings.model,max_tokens:options.maxTokens||24000,system,messages},{signal:options.signal});
  return {text:result.content.filter(b=>b.type==='text').map(b=>b.text).join(''),raw:result,provider:settings.provider,model:settings.model};
 }
 if(settings.provider!=='openai-compatible')throw new Error('Provedor LLM não suportado.');
 const key=process.env.QWEN_API_KEY||process.env.LLM_API_KEY!;
 const base=process.env.LLM_BASE_URL;if(!base)throw new Error('Configure LLM_BASE_URL no .env.');
 const url=new URL(base.replace(/\/$/,'')+'/chat/completions');
 if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('O provedor externo deve usar HTTPS.');
 const response=await fetch(url,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:settings.model,messages:[{role:'system',content:system},...messages],max_tokens:options.maxTokens||24000,response_format:{type:'json_object'},enable_thinking:false}),signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(300000)]):AbortSignal.timeout(300000)});
 const raw=await response.json() as {choices?:{message:{content?:string};finish_reason?:string}[];error?:{message?:string};usage?:unknown};
 if(!response.ok)throw new Error('Provedor LLM HTTP '+response.status+': '+String(raw.error?.message||'Falha na chamada.').replaceAll(key,'[REDACTED]'));
 const text=raw.choices?.[0]?.message.content;if(!text)throw new Error('Provedor LLM retornou uma resposta vazia.');
 return {text,raw,provider:settings.provider,model:settings.model};
}

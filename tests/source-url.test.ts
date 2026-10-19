import {describe,it,expect} from 'vitest';
import {canonicalYoutubeUrl} from '../packages/core/source-url';
import {correctTranscript} from '../packages/edl/transcript';
import {words} from './fixture';
describe('Authorized source and transcript review',()=>{
 it('canonicalizes one YouTube video and removes playlist tracking',()=>{expect(canonicalYoutubeUrl('https://youtu.be/nq5NKs5DDlE?list=bad')).toBe('https://www.youtube.com/watch?v=nq5NKs5DDlE');expect(canonicalYoutubeUrl('https://www.youtube.com/watch?v=nq5NKs5DDlE&list=other')).toBe('https://www.youtube.com/watch?v=nq5NKs5DDlE');});
 it('rejects credentials, private endpoints and arbitrary domains',()=>{for(const url of ['http://www.youtube.com/watch?v=nq5NKs5DDlE','https://127.0.0.1/watch?v=nq5NKs5DDlE','https://user:secret@youtube.com/watch?v=nq5NKs5DDlE','https://youtube.com.attacker.invalid/watch?v=nq5NKs5DDlE','https://www.youtube.com:8443/watch?v=nq5NKs5DDlE'])expect(()=>canonicalYoutubeUrl(url)).toThrow();});
 it('preserves timestamps and the original array during word corrections',()=>{const original=structuredClone(words);original[0].text='Tcheno';const result=correctTranscript(original,[{id:'0',expected:'Tcheno',replacement:'Destino',reason:'Nome próprio confirmado no contexto.'}]);expect(result[0]).toEqual({...original[0],text:'Destino'});expect(original[0].text).toBe('Tcheno');});
 it('rejects stale corrections and numerical fact changes',()=>{expect(()=>correctTranscript(words,[{id:'0',expected:'old',replacement:'new',reason:'test'}])).toThrow();const input=structuredClone(words);input[0].text='50';expect(()=>correctTranscript(input,[{id:'0',expected:'50',replacement:'500',reason:'test'}])).toThrow();});
});

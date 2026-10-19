import {z} from 'zod';
import type {Word} from './index';
export const correctionSchema=z.object({id:z.string(),expected:z.string(),replacement:z.string().trim().min(1).refine(value=>!/[\s]/.test(value),'Corrija uma palavra por vez.'),reason:z.string().min(1)});
export type TranscriptCorrection=z.infer<typeof correctionSchema>;
export function correctTranscript(words:Word[],corrections:TranscriptCorrection[]){
 const next=structuredClone(words);
 for(const change of corrections){const word=next.find(w=>w.id===change.id);if(!word||word.text!==change.expected)throw new Error('A transcrição mudou. Recarregue antes de corrigir.');if((/\d/.test(word.text)||/\d/.test(change.replacement))&&word.text!==change.replacement)throw new Error('Esta revisão não pode alterar números da fala.');word.text=change.replacement;}
 return next;
}

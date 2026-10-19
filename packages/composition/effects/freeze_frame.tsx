import {z} from 'zod';
import {Noop} from './visuals';
import type {EffectDefinition} from './types';
export const effect:EffectDefinition={id:'freeze_frame',nome:'Congelar imagem',categoria:'Câmera',schema:z.object({}),defaults:{},render:Noop,camera:true,descricao_para_IA:'Congela apenas a imagem por um intervalo curto; a fala continua sincronizada na timeline.'};

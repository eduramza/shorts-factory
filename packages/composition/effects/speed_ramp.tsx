import {z} from 'zod';
import {Noop} from './visuals';
import type {EffectDefinition} from './types';
export const effect:EffectDefinition={id:'speed_ramp',nome:'Rampa de velocidade',categoria:'Câmera',schema:z.object({from:z.number().min(.5).max(2),to:z.number().min(.5).max(2)}),defaults:{from:.8,to:1.2},render:Noop,camera:true,descricao_para_IA:'Compila quatro níveis de velocidade em segmentos alinhados a palavras; a duração final é recalculada. Use com moderação para preservar sentido.'};

import type { ComponentType } from "react";
import type { z } from "zod";
export type EffectProps = {
  progress: number;
  params: Record<string, unknown>;
  width: number;
  height: number;
};
export type EffectDefinition = {
  id: string;
  nome: string;
  categoria: string;
  schema: z.ZodType;
  defaults: Record<string, unknown>;
  render: ComponentType<EffectProps>;
  descricao_para_IA: string;
  camera?: boolean;
};

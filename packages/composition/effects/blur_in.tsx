import { z } from "zod";
import { Noop } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "blur_in",
  nome: "Entrada com blur",
  categoria: "Transição",
  schema: z.object({}).passthrough(),
  defaults: {},
  render: Noop,
  camera: true,
  descricao_para_IA:
    "Entrada com blur: use apenas para reforçar narrativa ou cadência visual.",
};

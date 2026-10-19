import { z } from "zod";
import { Noop } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "whip_pan",
  nome: "Whip pan",
  categoria: "Transição",
  schema: z.object({}).passthrough(),
  defaults: {},
  render: Noop,
  camera: true,
  descricao_para_IA:
    "Whip pan: use apenas para reforçar narrativa ou cadência visual.",
};

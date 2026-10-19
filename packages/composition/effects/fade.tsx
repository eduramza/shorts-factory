import { z } from "zod";
import { Fade } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "fade",
  nome: "Fade",
  categoria: "Transição",
  schema: z.object({}).passthrough(),
  defaults: {},
  render: Fade,
  camera: false,
  descricao_para_IA:
    "Fade: use apenas para reforçar narrativa ou cadência visual.",
};

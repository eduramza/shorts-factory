import { z } from "zod";
import { Glitch } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "glitch",
  nome: "Glitch",
  categoria: "Transição",
  schema: z.object({}).passthrough(),
  defaults: {},
  render: Glitch,
  camera: false,
  descricao_para_IA:
    "Glitch: use apenas para reforçar narrativa ou cadência visual.",
};

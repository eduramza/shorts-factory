import { z } from "zod";
import { Highlight } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "arrow",
  nome: "Seta",
  categoria: "Visual",
  schema: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
    .passthrough(),
  defaults: { x: 0.5, y: 0.5, shape: "arrow" },
  render: Highlight,
  camera: false,
  descricao_para_IA:
    "Seta: use apenas para reforçar narrativa ou cadência visual.",
};

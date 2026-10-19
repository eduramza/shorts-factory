import { z } from "zod";
import { Noop } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "pan_suave",
  nome: "Pan suave",
  categoria: "Câmera",
  schema: z
    .object({ distance: z.number().min(0).max(0.1).default(0.03) })
    .passthrough(),
  defaults: { distance: 0.03 },
  render: Noop,
  camera: true,
  descricao_para_IA:
    "Pan suave: use apenas para reforçar narrativa ou cadência visual.",
};

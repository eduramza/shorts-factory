import { z } from "zod";
import { Noop } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "shake",
  nome: "Tremor breve",
  categoria: "Câmera",
  schema: z
    .object({ intensity: z.number().min(0).max(20).default(5) })
    .passthrough(),
  defaults: { intensity: 5 },
  render: Noop,
  camera: true,
  descricao_para_IA:
    "Tremor breve: use apenas para reforçar narrativa ou cadência visual.",
};

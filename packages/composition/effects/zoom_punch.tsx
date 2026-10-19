import { z } from "zod";
import { Noop } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "zoom_punch",
  nome: "Zoom de impacto",
  categoria: "Câmera",
  schema: z
    .object({ scale: z.number().min(1.05).max(1.15).default(1.08) })
    .passthrough(),
  defaults: { scale: 1.08 },
  render: Noop,
  camera: true,
  descricao_para_IA:
    "Zoom de impacto: use apenas para reforçar narrativa ou cadência visual.",
};

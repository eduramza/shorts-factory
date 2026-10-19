import { z } from "zod";
import { Overlay } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "emphasis_word",
  nome: "Ênfase",
  categoria: "Texto",
  schema: z.object({ text: z.string().max(40) }).passthrough(),
  defaults: { text: "Destaque" },
  render: Overlay,
  camera: false,
  descricao_para_IA:
    "Ênfase: use apenas para reforçar narrativa ou cadência visual.",
};

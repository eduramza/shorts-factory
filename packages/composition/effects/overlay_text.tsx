import { z } from "zod";
import { Overlay } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "overlay_text",
  nome: "Texto na tela",
  categoria: "Texto",
  schema: z
    .object({
      text: z.string().max(100),
      animation: z.enum(["pop", "slide", "typewriter"]).default("pop"),
      color: z.string().default("white"),
    })
    .passthrough(),
  defaults: { text: "Texto", animation: "pop", color: "white" },
  render: Overlay,
  camera: false,
  descricao_para_IA:
    "Texto na tela: use apenas para reforçar narrativa ou cadência visual.",
};

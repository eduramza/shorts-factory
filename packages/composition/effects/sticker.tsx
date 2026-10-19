import { z } from "zod";
import { Sticker } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "sticker",
  nome: "Sticker",
  categoria: "Visual",
  schema: z.object({ text: z.string().max(20) }).passthrough(),
  defaults: { text: "→" },
  render: Sticker,
  camera: false,
  descricao_para_IA:
    "Sticker: use apenas para reforçar narrativa ou cadência visual.",
};

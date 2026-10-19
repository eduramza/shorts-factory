import { z } from "zod";
import { Countdown } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "countdown",
  nome: "Contagem",
  categoria: "Visual",
  schema: z.object({ seconds: z.number().min(1).max(10) }).passthrough(),
  defaults: { seconds: 3 },
  render: Countdown,
  camera: false,
  descricao_para_IA:
    "Contagem: use apenas para reforçar narrativa ou cadência visual.",
};

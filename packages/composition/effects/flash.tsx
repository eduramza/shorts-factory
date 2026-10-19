import { z } from "zod";
import { Flash } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "flash",
  nome: "Flash",
  categoria: "Transição",
  schema: z.object({ color: z.string().default("white") }).passthrough(),
  defaults: { color: "white" },
  render: Flash,
  camera: false,
  descricao_para_IA:
    "Flash: use apenas para reforçar narrativa ou cadência visual.",
};

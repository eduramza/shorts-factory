import { z } from "zod";
import { Progress } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "progress_bar",
  nome: "Barra de progresso",
  categoria: "Visual",
  schema: z.object({ color: z.string().default("#b7fc70") }).passthrough(),
  defaults: { color: "#b7fc70" },
  render: Progress,
  camera: false,
  descricao_para_IA:
    "Barra de progresso: use apenas para reforçar narrativa ou cadência visual.",
};

import { z } from "zod";
import { Broll } from "./visuals";
import type { EffectDefinition } from "./types";
export const effect: EffectDefinition = {
  id: "broll_image",
  nome: "B-roll imagem",
  categoria: "Visual",
  schema: z.object({ asset_id: z.string() }),
  defaults: { asset_id: "" },
  render: Broll,
  descricao_para_IA:
    "Mostra apoio visual de asset licenciado do catálogo por 1–2 s.",
};

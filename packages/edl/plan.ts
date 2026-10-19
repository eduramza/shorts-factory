import { z } from "zod";
import { edlSchema, validateEdl, type EDL, type Word } from "./index";
export const editorialPlanSchema = z.object({
  segments: z
    .array(z.object({ first_word: z.string(), last_word: z.string() }))
    .min(1)
    .max(8),
  overlays: edlSchema.shape.structure.shape.hook.shape.text_overlay_options,
  tension_note: z.string().min(1),
  payoff_note: z.string().min(1),
  scores: edlSchema.shape.scores,
});
export type EditorialPlan = z.infer<typeof editorialPlanSchema>;
export function compileEditorialPlan(
  plan: EditorialPlan,
  words: Word[],
  mode: EDL["mode"],
  clipId: string,
) {
  let cursor = 0;
  const used = new Set<string>();
  const captions: Word[] = [];
  const segments = plan.segments.map((span, i) => {
    const first = words.findIndex((w) => w.id === span.first_word),
      last = words.findIndex((w) => w.id === span.last_word);
    if (first < 0 || last < first)
      throw new Error("IDs de palavras inexistentes ou fora de ordem.");
    const selected = words.slice(first, last + 1);
    for (const w of selected) {
      if (used.has(w.id!))
        throw new Error("Uma palavra não pode aparecer duas vezes.");
      used.add(w.id!);
      captions.push({
        ...w,
        t0: cursor + w.t0 - selected[0].t0,
        t1: cursor + w.t1 - selected[0].t0,
      });
    }
    const segment = {
      id: "s" + i,
      src_start: selected[0].t0,
      src_end: selected.at(-1)!.t1,
      out_start: cursor,
      role: i === 0 ? ("hook" as const) : ("body" as const),
      speed: 1,
    };
    cursor += segment.src_end - segment.src_start;
    return segment;
  });
  const payoffStart = captions
    .map((w) => w.t0)
    .filter((t) => t >= cursor - 5 && t <= cursor - 3)
    .reduce(
      (best, t) =>
        Math.abs(t - (cursor - 4)) < Math.abs(best - (cursor - 4)) ? t : best,
      Math.max(0, cursor - 4),
    );
  return edlSchema.parse({
    clip_id: clipId,
    mode,
    source: {
      start: Math.min(...segments.map((s) => s.src_start)),
      end: Math.max(...segments.map((s) => s.src_end)),
    },
    scores: plan.scores,
    structure: {
      hook: {
        start: 0,
        end: 3,
        technique: segments.some(
          (s, i) => i > 0 && s.src_start < segments[0].src_start,
        )
          ? "cold_open"
          : "native",
        text_overlay_options: plan.overlays,
        chosen_overlay: 0,
      },
      beats: [
        {
          start: 3,
          end: payoffStart,
          type: "suspense",
          note: plan.tension_note,
        },
      ],
      payoff: { start: payoffStart, end: cursor, note: plan.payoff_note },
    },
    segments,
    cuts_removed: [],
    reframe: {
      mode: "auto_face",
      keyframes: [{ t: 0, cx: 0.5, cy: 0.5, scale: 1 }],
    },
    captions: { style: "ativa", words: captions },
    effects: [],
    audio: {
      voice: { normalize_lufs: -14, denoise: false },
      music: [],
      sfx: [],
    },
    retention_forecast: { curve: [], risk_points: [] },
    qa: {
      passed: false,
      violations: [
        {
          code: "compiled_plan",
          message:
            "Tempos e legendas compilados das palavras originais; efeitos de cadência inseridos pelo validador.",
          auto_fixed: true,
        },
      ],
    },
    duration_out: cursor,
    integrity_review: "review",
  });
}

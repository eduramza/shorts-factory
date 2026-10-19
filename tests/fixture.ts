import { edlSchema, type Word } from "../packages/edl";
export const words: Word[] = Array.from({ length: 32 }, (_, i) => ({
  id: String(i),
  t0: i * 0.5,
  t1: (i + 1) * 0.5,
  text: [
    "Uma",
    "história",
    "com",
    "começo",
    "conflito",
    "e",
    "uma",
    "solução.",
  ][i % 8],
  emphasis: false,
}));
export const fixture = () =>
  edlSchema.parse({
    clip_id: "fixture",
    mode: "viral",
    source: { start: 0, end: 16 },
    scores: {
      total: 87,
      hook: 22,
      tension: 22,
      payoff: 18,
      self_contained: 13,
      density: 8,
      emotion: 4,
      rationale: {
        hook: "Promessa direta.",
        tension: "Obstáculo explícito.",
        payoff: "Entrega a solução.",
        self_contained: "História completa.",
        density: "Sem pausas longas.",
        emotion: "Surpresa no final.",
      },
    },
    structure: {
      hook: {
        start: 0,
        end: 3,
        technique: "native",
        text_overlay_options: [
          "Uma história com solução",
          "O conflito muda tudo",
          "O começo não revela tudo",
        ],
        chosen_overlay: 0,
      },
      beats: [{ start: 3, end: 12, type: "conflict", note: "Obstáculo" }],
      payoff: { start: 12, end: 16, note: "Solução" },
    },
    segments: [
      {
        id: "s1",
        src_start: 0,
        src_end: 16,
        out_start: 0,
        role: "body",
        speed: 1,
      },
    ],
    cuts_removed: [],
    reframe: {
      mode: "center",
      keyframes: [{ t: 0, cx: 0.5, cy: 0.5, scale: 1 }],
    },
    captions: { style: "ativa", words },
    effects: [3, 6, 9, 12, 15].map((t) => ({
      type: "zoom_punch",
      t0: t,
      t1: Math.min(16, t + 0.4),
      params: { scale: 1.08 },
      reason: "Cadência visual",
    })),
    audio: {
      voice: { normalize_lufs: -14, denoise: false },
      music: [],
      sfx: [],
    },
    retention_forecast: {
      curve: [
        { t: 0, pct: 100 },
        { t: 16, pct: 75 },
      ],
      risk_points: [],
    },
    qa: { passed: true, violations: [] },
    duration_out: 16,
    integrity_review: "verified",
  });

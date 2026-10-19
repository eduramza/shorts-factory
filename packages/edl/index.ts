import { z } from "zod";
import { config } from "./config";
export { config } from "./config";
const time = z.number().finite().nonnegative();
const span = { start: time, end: time };
export const wordSchema = z.object({
  t0: time,
  t1: time,
  text: z.string().min(1),
  emphasis: z.boolean().default(false),
  speaker: z.string().optional(),
  id: z.string().optional(),
});
export const effectSchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  t0: time,
  t1: time,
  params: z.record(z.unknown()),
  reason: z.string().min(1),
  word_anchor: z.string().optional(),
});
export const edlSchema = z.object({
  clip_id: z.string(),
  mode: z.enum(["viral", "balanced", "authority"]),
  source: z.object(span),
  scores: z.object({
    total: z.number().min(0).max(100),
    hook: z.number().min(0).max(25),
    tension: z.number().min(0).max(25),
    payoff: z.number().min(0).max(20),
    self_contained: z.number().min(0).max(15),
    density: z.number().min(0).max(10),
    emotion: z.number().min(0).max(5),
    rationale: z.record(z.string()),
  }),
  structure: z.object({
    hook: z.object({
      ...span,
      technique: z.enum(["native", "cold_open"]),
      text_overlay_options: z
        .array(
          z
            .string()
            .refine(
              (t) => t.trim().split(/\s+/).length <= 8,
              "Máximo de 8 palavras",
            ),
        )
        .length(3),
      chosen_overlay: z.number().int().min(0).max(2),
    }),
    beats: z
      .array(
        z.object({
          ...span,
          type: z.enum(["conflict", "solution", "suspense"]),
          note: z.string(),
        }),
      )
      .min(1),
    payoff: z.object({ ...span, note: z.string() }),
  }),
  segments: z
    .array(
      z.object({
        id: z.string(),
        src_start: time,
        src_end: time,
        out_start: time,
        role: z.enum(["hook", "body", "payoff"]),
        speed: z.number().min(0.25).max(4),
        crossfade: z.number().min(0.03).max(0.06).default(config.crossfade),
      }),
    )
    .min(1),
  cuts_removed: z.array(
    z.object({
      src_start: time,
      src_end: time,
      reason: z.enum(["silence", "filler", "repeat", "low_tension"]),
    }),
  ),
  reframe: z.object({
    mode: z.enum(["auto_face", "split", "center", "manual"]),
    keyframes: z
      .array(
        z.object({
          t: time,
          cx: z.number().min(0).max(1),
          cy: z.number().min(0).max(1),
          scale: z.number().min(1).max(2),
        }),
      )
      .min(1),
  }),
  captions: z.object({
    style: z.string(),
    words: z.array(wordSchema),
    color: z.string().default("#f8fafc"),
    activeColor: z.string().default("#b7fc70"),
    fontSize: z.number().min(24).max(110).default(64),
    bottom: z.number().min(config.safeBottom).max(0.7).default(0.24),
    side: z.number().min(config.safeSide).max(0.3).default(0.08),
  }),
  effects: z.array(effectSchema),
  audio: z.object({
    voice: z.object({ normalize_lufs: z.number(), denoise: z.boolean() }),
    music: z.array(
      z.object({
        track_id: z.string(),
        t0: time,
        t1: time,
        mood: z.enum(["energetic", "suspense", "resolve"]),
        gain_db: z.number(),
        ducking: z.boolean(),
        fade_in: time,
        fade_out: time,
      }),
    ),
    sfx: z.array(z.object({ id: z.string(), t: time, gain_db: z.number() })),
  }),
  retention_forecast: z.object({
    curve: z.array(z.object({ t: time, pct: z.number().min(0).max(100) })),
    risk_points: z.array(z.object({ t: time, why: z.string() })),
  }),
  qa: z.object({
    passed: z.boolean(),
    violations: z.array(
      z
        .object({
          code: z.string(),
          message: z.string(),
          auto_fixed: z.boolean(),
        })
        .or(z.string())
        .transform((v) =>
          typeof v === "string"
            ? { code: "review", message: v, auto_fixed: false }
            : v,
        ),
    ),
  }),
  duration_out: time,
  ab_variable: z.string().optional(),
  integrity_review: z.enum(["verified", "review"]).default("review"),
});
export type EDL = z.infer<typeof edlSchema>;
export type Word = z.infer<typeof wordSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type CatalogAsset = {
  id: string;
  type: string;
  license: string;
  path?: string;
  name?:string;
};
export const secondsToFrames = (t: number, fps = 30) => Math.round(t * fps);
export const framesToSeconds = (f: number, fps = 30) => f / fps;
export function sourceToOutput(edl: EDL, t: number) {
  return edl.segments
    .filter((s) => t >= s.src_start && t <= s.src_end)
    .map((s) => s.out_start + (t - s.src_start) / s.speed);
}
export function validateEdl(
  input: unknown,
  transcript: Word[],
  assets: CatalogAsset[],
  effectIds: string[],
  fix = false,
): EDL {
  let edl = edlSchema.parse(input);
  for(const effect of edl.effects.filter(e=>e.type==="speed_ramp"))edl=applySpeedRamp(edl,transcript,effect.t0,effect.t1,Number(effect.params.from||.8),Number(effect.params.to||1.2));
  const issues: EDL["qa"]["violations"] = edl.qa.violations.filter(v=>v.auto_fixed);
  const add = (code: string, message: string, auto_fixed = false) =>
    issues.some(i=>i.code===code&&i.message===message)||issues.push({ code, message, auto_fixed });
  const limits = config.modes[edl.mode];
  if (
    edl.source.end <= edl.source.start ||
    edl.source.end > (transcript.at(-1)?.t1 || 0) + 0.1
  )
    add("source", "Janela de origem fora da transcrição.");
  if (new Set(edl.segments.map((s) => s.id)).size !== edl.segments.length)
    add("segment_ids", "IDs de segmentos duplicados.");
  if (
    !edl.structure.beats.some(
      (b) => b.type === "conflict" || b.type === "suspense",
    )
  )
    add("tension", "É necessário ao menos um beat de tensão.");
  for (const beat of edl.structure.beats)
    if (
      beat.end <= beat.start ||
      beat.start < edl.structure.hook.start ||
      beat.end > edl.duration_out
    )
      add("beat_time", "Beat fora da montagem.");

  if (edl.duration_out < limits.min || edl.duration_out > limits.max)
    add("duration", "Duração fora do modo escolhido.");
  if (
    edl.scores.hook < config.hookThreshold ||
    edl.scores.payoff < config.payoffThreshold
  )
    add("score", "Candidato descartado por hook/payoff abaixo do mínimo.");
  const total =
    edl.scores.hook +
    edl.scores.tension +
    edl.scores.payoff +
    edl.scores.self_contained +
    edl.scores.density +
    edl.scores.emotion;
  if (edl.scores.total !== total) {
    edl.scores.total = total;
    add("score_sum", "Total recalculado.", true);
  }
  if (
    edl.structure.hook.start !== 0 ||
    edl.structure.hook.end > config.hookSeconds
  )
    add("hook", "Gancho precisa ocupar os primeiros 3 s.");
  const payoffLength = edl.structure.payoff.end - edl.structure.payoff.start;
  if (
    payoffLength < config.payoffMin ||
    payoffLength > config.payoffMax ||
    Math.abs(edl.structure.payoff.end - edl.duration_out) > 0.3
  )
    add("payoff", "Payoff precisa encerrar o corte nos últimos 3–5 s.");
  let duration = 0;
  const boundary = (t: number, key: "t0" | "t1") =>
    transcript.some((w) => Math.abs(w[key] - t) < 0.021);
  for (const s of edl.segments) {
    if(s.src_start<edl.source.start-.021||s.src_end>edl.source.end+.021)add("segment_source","Segmento fora da janela de origem declarada.");
    if (s.src_end <= s.src_start || Math.abs(s.out_start - duration) > 0.02)
      add("segments", "Segmentos inválidos, sobrepostos ou com lacunas.");
    if (!boundary(s.src_start, "t0") || !boundary(s.src_end, "t1"))
      add("word_boundary", "Corte fora do limite de palavra.");
    duration += (s.src_end - s.src_start) / s.speed;
  }
  if (Math.abs(duration - edl.duration_out) > 0.02)
    add("duration_sum", "Duração não corresponde à montagem.");
  for (const w of edl.captions.words) {
    if (w.t1 <= w.t0 || w.t1 > duration + 0.02)
      add("caption_time", "Tempo de legenda inválido.");
    if (w.text.trim().split(/\s+/).length > config.maxCaptionWords)
      add("caption_words", "Legenda com mais de três palavras.");
    const source = transcript.find(
      (original) =>
        original.text === w.text &&
        edl.segments.some(
          (s) =>
            original.t0 >= s.src_start - 0.02 &&
            original.t1 <= s.src_end + 0.02 &&
            Math.abs(
              s.out_start + (original.t0 - s.src_start) / s.speed - w.t0,
            ) <= config.captionTolerance,
        ),
    );
    if (!source)
      add(
        "caption_integrity",
        "Legenda difere da transcrição ou perdeu sincronização.",
      );
  }
  for (let i = 0; i < edl.captions.words.length; i++) {
    const w = edl.captions.words[i];
    if (i > 0 && w.t0 < edl.captions.words[i - 1].t1 - 0.001)
      add("caption_overlap", "Legendas sobrepostas ou fora de ordem.");
  }
  if (edl.audio.voice.normalize_lufs !== config.voiceLufs)
    add("loudness", "Voz deve ter alvo de −14 LUFS.");
  for (const music of edl.audio.music) {
    if (music.t1 <= music.t0 || music.t1 > edl.duration_out)
      add("music_time", "Trilha fora da montagem.");
    if (music.fade_in + music.fade_out > music.t1 - music.t0)
      add("music_fade", "Fade ultrapassa a duração da trilha.");
  }
  const sfx = edl.audio.sfx.slice().sort((a, b) => a.t - b.t);
  for (let i = 0; i < sfx.length; i++) {
    if (sfx[i].t > edl.duration_out) add("sfx_time", "SFX fora da montagem.");
    if (i && sfx[i].t - sfx[i - 1].t < 2)
      add("sfx_density", "SFX com menos de 2 s de intervalo.");
  }
  for (const track of [
    ...edl.audio.music.map((m) => ({ id: m.track_id, type: "music" })),
    ...edl.audio.sfx.map((s) => ({ id: s.id, type: "sfx" })),
  ]) {
    if (
      !assets.some(
        (a) => a.id === track.id && a.type === track.type && a.license.trim(),
      )
    )
      add("asset", "Asset inexistente ou sem licença: " + track.id);
  }
  for (const music of edl.audio.music)
    if (!music.ducking) {
      if (fix) music.ducking = true;
      add("ducking", "Ducking obrigatório.", fix);
    }
  for (const e of edl.effects) {
    if (
      e.type.startsWith("broll_") &&
      !assets.some((a) => a.id === e.params.asset_id && a.license)
    )
      add("asset", "B-roll sem asset licenciado.");
    if (!effectIds.includes(e.type))
      add("effect", "Efeito desconhecido: " + e.type);
    if (e.t1 <= e.t0 || e.t1 > duration + 0.02)
      add("effect_time", "Tempo de efeito inválido.");
  }
  const cropChanges:number[]=[];let prior=edl.reframe.keyframes[0];
  for(const key of edl.reframe.keyframes.slice(1)){if(Math.hypot(key.cx-prior.cx,key.cy-prior.cy)+Math.abs(key.scale-prior.scale)>=config.visualCropDelta){cropChanges.push(key.t);prior=key;}}
  let changes = [
    0,
    ...edl.segments.map((s) => s.out_start),
    ...edl.effects.map((e) => e.t0),
    ...cropChanges,
    duration,
  ].sort((a, b) => a - b);
  for (let i = 1; i < changes.length; i++) {
    if (changes[i] - changes[i - 1] > config.visualGap) {
      if (fix) {
        for (
          let t = changes[i - 1] + config.visualCadence;
          t < changes[i];
          t += config.visualCadence
        )
          edl.effects.push({
            type: "zoom_punch",
            t0: t,
            t1: Math.min(t + 0.45, duration),
            params: { scale: 1.08 },
            reason: "Evita mais de 4 s sem mudança visual.",
          });
      }
      add("visual_gap", "Trecho sem mudança visual por mais de 4 s.", fix);
    }
  }
  for (const key of edl.reframe.keyframes)
    if (key.t > edl.duration_out)
      add("crop_time", "Keyframe fora da montagem.");
  if (edl.integrity_review !== "verified")
    add(
      "meaning",
      "Preservação do sentido e veracidade do gancho aguardam revisão.",
    );
  edl.qa = { passed: !issues.some((i) => !i.auto_fixed), violations: issues };
  return edl;
}
export function rebuildFromSegments(
  edl: EDL,
  segments: EDL["segments"],
  transcript: Word[],
): EDL {
  const next = structuredClone(edl);
  let cursor = 0;
  next.segments = segments.map((s) => {
    const v = { ...s, out_start: cursor };
    cursor += (s.src_end - s.src_start) / s.speed;
    return v;
  });
  next.duration_out = cursor;
  next.captions.words = next.segments.flatMap((s) =>
    transcript
      .filter((w) => w.t0 >= s.src_start - 0.001 && w.t1 <= s.src_end + 0.001)
      .map((w) => ({
        ...w,
        t0: s.out_start + (w.t0 - s.src_start) / s.speed,
        t1: s.out_start + (w.t1 - s.src_start) / s.speed,
      })),
  );
  next.effects = next.effects.flatMap((e) => {
    if (e.word_anchor) {
      const w = next.captions.words.find((w) => w.id === e.word_anchor);
      return w
        ? [{ ...e, t0: w.t0, t1: Math.min(cursor, w.t0 + (e.t1 - e.t0)) }]
        : [];
    }
    return e.t0 < cursor ? [{ ...e, t1: Math.min(e.t1, cursor) }] : [];
  });
  const sourcePoints=edl.reframe.keyframes.flatMap(k=>{const old=edl.segments.find(s=>k.t>=s.out_start&&k.t<=s.out_start+(s.src_end-s.src_start)/s.speed);return old?[{...k,src:old.src_start+(k.t-old.out_start)*old.speed}]:[];});
  next.reframe.keyframes=next.segments.flatMap(s=>{const keys=sourcePoints.filter(k=>k.src>=s.src_start&&k.src<=s.src_end);const nearest=sourcePoints.reduce<(typeof sourcePoints)[number]|undefined>((best,k)=>!best||Math.abs(k.src-s.src_start)<Math.abs(best.src-s.src_start)?k:best,undefined);return keys.length?keys.map(({src,...k})=>({...k,t:s.out_start+(src-s.src_start)/s.speed})):[{t:s.out_start,cx:nearest?.cx||.5,cy:nearest?.cy||.4,scale:nearest?.scale||1}];}).sort((a,b)=>a.t-b.t);
  next.audio.music=next.audio.music.filter(m=>m.t0<cursor).map(m=>{const length=Math.min(m.t1,cursor)-m.t0;return {...m,t1:Math.min(m.t1,cursor),fade_in:Math.min(m.fade_in,length/2),fade_out:Math.min(m.fade_out,length/2)};});
  next.audio.sfx=next.audio.sfx.filter(s=>s.t<cursor);
  next.structure.payoff.end = cursor;
  next.structure.payoff.start = Math.max(0, cursor - 4);
  next.integrity_review = "review";
  return next;
}
export function removeWord(edl: EDL, index: number, transcript: Word[]) {
  const word = edl.captions.words[index];
  if (!word) return edl;
  const segments = edl.segments.flatMap((s) => {
    if (
      word.t0 < s.out_start - 0.001 ||
      word.t0 >= s.out_start + (s.src_end - s.src_start) / s.speed
    )
      return [s];
    const src0 = s.src_start + (word.t0 - s.out_start) * s.speed,
      src1 = s.src_start + (word.t1 - s.out_start) * s.speed;
    const before = transcript.filter(
      (w) => w.t0 >= s.src_start - 0.001 && w.t1 <= src0 + 0.001,
    );
    const after = transcript.filter(
      (w) => w.t0 >= src1 - 0.001 && w.t1 <= s.src_end + 0.001,
    );
    return [
      ...(before.length
        ? [{ ...s, id: s.id + "a", src_end: before.at(-1)!.t1 }]
        : []),
      ...(after.length
        ? [{ ...s, id: s.id + "b", src_start: after[0].t0 }]
        : []),
    ];
  });
  return rebuildFromSegments(edl, segments, transcript);
}
export function native4k(width: number, height: number,scale=1) {
  return (
    Math.min(width, (height * 9) / 16)/scale >= 2160 &&
    Math.min(height, (width * 16) / 9)/scale >= 3840
  );
}
export function selectNonOverlapping(edls: EDL[], count: number) {
  const selected: EDL[] = [];
  for (const clip of [...edls].sort(
    (a, b) => b.scores.total - a.scores.total,
  )) {
    if (
      selected.every(
        (other) =>
          Math.max(
            0,
            Math.min(clip.source.end, other.source.end) -
              Math.max(clip.source.start, other.source.start),
          ) /
            Math.min(
              clip.source.end - clip.source.start,
              other.source.end - other.source.start,
            ) <=
          config.maxOverlap,
      )
    )
      selected.push(clip);
    if (selected.length === count) break;
  }
  return selected;
}

export function applySpeedRamp(edl:EDL,transcript:Word[],t0:number,t1:number,from=.8,to=1.2):EDL{
 const segments:EDL['segments']=[];
 for(const segment of edl.segments){
  const outEnd=segment.out_start+(segment.src_end-segment.src_start)/segment.speed;
  if(outEnd<=t0||segment.out_start>=t1){segments.push(segment);continue;}
  const words=transcript.filter(w=>w.t0>=segment.src_start-.001&&w.t1<=segment.src_end+.001);
  if(!words.length){segments.push(segment);continue;}
  const groups:{words:Word[];speed:number}[]=[];
  for(const word of words){const out=segment.out_start+(word.t0-segment.src_start)/segment.speed;const phase=out<t0||out>=t1?-1:Math.min(3,Math.floor((out-t0)/(t1-t0)*4));const rate=phase<0?segment.speed:segment.speed*(from+(to-from)*phase/3);const last=groups.at(-1);if(last&&last.speed===rate)last.words.push(word);else groups.push({words:[word],speed:rate});}
  for(const [index,group] of groups.entries()){segments.push({...segment,id:segment.id+'-ramp-'+index,src_start:group.words[0].t0,src_end:group.words.at(-1)!.t1,speed:group.speed});}
 }
 const next=rebuildFromSegments(edl,segments,transcript);next.effects=next.effects.filter(e=>e.type!=='speed_ramp');next.qa.violations.push({code:'speed_ramp',message:'Rampa compilada em segmentos com velocidade e legendas remapeadas.',auto_fixed:true});return next;
}

export function maximumScale(edl:EDL){const zooms=edl.effects.filter(e=>e.type==='zoom_punch'||e.type==='zoom_slow');const points=zooms.flatMap(e=>[e.t0,(e.t0+e.t1)/2]);const zoom=points.reduce((max,t)=>Math.max(max,zooms.filter(e=>e.t0<=t&&e.t1>t).reduce((scale,e)=>scale*Number(e.params.scale||1.08),1)),1);return Math.max(...edl.reframe.keyframes.map(k=>k.scale),1)*zoom;}

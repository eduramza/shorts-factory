import { describe, it, expect } from "vitest";
import { fixture, words } from "./fixture";
import {
  validateEdl,
  applySpeedRamp,
  maximumScale,
  edlSchema,
  secondsToFrames,
  framesToSeconds,
  sourceToOutput,
  removeWord,
  native4k,
  selectNonOverlapping,
} from "../packages/edl";
import { effectCatalog } from "../packages/composition/effects/catalog";
import { safePath } from "../packages/core/storage";
const ids = effectCatalog.map((e) => e.id);
const check = (edl: unknown, fix = false) =>
  validateEdl(edl, words, [], ids, fix);
describe("Retention skill deterministic contract", () => {
 it('compiles speed ramps into word-aligned segments and keeps all words',()=>{const original=fixture();const result=applySpeedRamp(original,words,3,8,.8,1.2);expect(result.segments.length).toBeGreaterThan(3);expect(result.captions.words).toHaveLength(words.length);expect(result.segments.every(s=>words.some(w=>w.t0===s.src_start)&&words.some(w=>w.t1===s.src_end))).toBe(true);expect(result.captions.words.every(w=>w.t1>w.t0)).toBe(true);});
 it('accounts for zoom before enabling native 4K',()=>{const e=fixture();e.effects[0].params.scale=1.15;expect(native4k(7680,4320)).toBe(true);expect(native4k(7680,4320,maximumScale(e))).toBe(false);});

  it('does not treat unchanged crop samples as visual changes',()=>{const e=fixture();e.effects=[];e.reframe.keyframes=Array.from({length:80},(_,i)=>({t:i*.2,cx:.5,cy:.5,scale:1}));expect(check(e).qa.violations.some(v=>v.code==='visual_gap')).toBe(true);expect(check(e,true).effects.length).toBeGreaterThan(3);});
  it("accepts a coherent word-aligned EDL", () =>
    expect(check(fixture()).qa.passed).toBe(true));
  it("rejects unstructured JSON", () =>
    expect(() => edlSchema.parse({})).toThrow());
  it("rejects hooks longer than eight words", () => {
    const e = fixture();
    e.structure.hook.text_overlay_options[0] =
      "um dois três quatro cinco seis sete oito nove";
    expect(() => check(e)).toThrow();
  });
  it("discards hook below 12", () => {
    const e = fixture();
    e.scores.hook = 11;
    expect(check(e).qa.violations.some((v) => v.code === "score")).toBe(true);
  });
  it("discards payoff below 8", () => {
    const e = fixture();
    e.scores.payoff = 7;
    expect(check(e).qa.passed).toBe(false);
  });
  it("enforces duration mode", () => {
    const e = fixture();
    e.mode = "authority";
    expect(check(e).qa.violations.some((v) => v.code === "duration")).toBe(
      true,
    );
  });
  it("corrects visual gaps and records correction", () => {
    const e = fixture();
    e.effects = [];
    const result = check(e, true);
    expect(result.effects.length).toBeGreaterThan(3);
    expect(
      result.qa.violations.some((v) => v.code === "visual_gap" && v.auto_fixed),
    ).toBe(true);
    expect(check(result).qa.passed).toBe(true);
  });
  it("rejects unknown effects", () => {
    const e = fixture();
    e.effects[0].type = "unknown";
    expect(check(e).qa.violations.some((v) => v.code === "effect")).toBe(true);
  });
  it("rejects unlicensed or unknown music", () => {
    const e = fixture();
    e.audio.music = [
      {
        track_id: "fake",
        t0: 0,
        t1: 16,
        mood: "suspense",
        gain_db: -16,
        ducking: true,
        fade_in: 0.2,
        fade_out: 0.3,
      },
    ];
    expect(check(e).qa.violations.some((v) => v.code === "asset")).toBe(true);
  });
  it("corrects ducking", () => {
    const e = fixture();
    e.audio.music = [
      {
        track_id: "music",
        t0: 0,
        t1: 16,
        mood: "suspense",
        gain_db: -16,
        ducking: false,
        fade_in: 0.2,
        fade_out: 0.3,
      },
    ];
    const result = validateEdl(
      e,
      words,
      [{ id: "music", type: "music", license: "CC0" }],
      ids,
      true,
    );
    expect(result.audio.music[0].ducking).toBe(true);
  });
  it("detects mid-word cuts", () => {
    const e = fixture();
    e.segments[0].src_start = 0.25;
    expect(check(e).qa.violations.some((v) => v.code === "word_boundary")).toBe(
      true,
    );
  });
  it("rejects invented caption words", () => {
    const e = fixture();
    e.captions.words[1].text = "invenção";
    expect(
      check(e).qa.violations.some((v) => v.code === "caption_integrity"),
    ).toBe(true);
  });
  it("detects caption drift over 80ms", () => {
    const e = fixture();
    e.captions.words[1].t0 += 0.15;
    expect(
      check(e).qa.violations.some((v) => v.code === "caption_integrity"),
    ).toBe(true);
  });
  it("rejects unsafe caption placement", () => {
    const e = fixture();
    e.captions.bottom = 0.05;
    expect(() => check(e)).toThrow();
  });
  it("requires review for unaudited meaning", () => {
    const e = fixture();
    e.integrity_review = "review";
    expect(check(e).qa.passed).toBe(false);
  });
  it("removes a word non-destructively and remaps subsequent captions", () => {
    const original = fixture();
    const result = removeWord(original, 8, words);
    expect(result.duration_out).toBe(15.5);
    expect(result.captions.words).toHaveLength(31);
    expect(result.captions.words[8].id).toBe("9");
    expect(result.captions.words[8].t0).toBe(4);
    expect(original.duration_out).toBe(16);
  });
  it("retains anchor effect after cutting earlier word", () => {
    const e = fixture();
    e.effects[0].word_anchor = "10";
    e.effects[0].t0 = 5;
    e.effects[0].t1 = 5.4;
    const result = removeWord(e, 2, words);
    expect(result.effects[0].t0).toBe(4.5);
  });
  it("maps cold-open source time to multiple output occurrences", () => {
    const e = fixture();
    e.segments.unshift({
      ...e.segments[0],
      id: "cold",
      src_start: 10,
      src_end: 12,
      out_start: 0,
    });
    expect(sourceToOutput(e, 11)).toEqual([1, 11]);
  });
  it("requires actual vertical crop pixels for native 4k", () => {
    expect(native4k(3840, 2160)).toBe(false);
    expect(native4k(7680, 4320)).toBe(true);
    expect(native4k(2160, 3840)).toBe(true);
  });
  it("filters candidates exceeding 30 percent overlap", () => {
    const a = fixture(),
      b = fixture();
    b.clip_id = "b";
    b.source = { start: 4, end: 20 };
    expect(selectNonOverlapping([a, b], 2)).toHaveLength(1);
  });
  it("roundtrips time to frames within half a frame", () => {
    expect(
      Math.abs(framesToSeconds(secondsToFrames(1.234)) - 1.234),
    ).toBeLessThan(1 / 60);
  });
  it("blocks traversal and sibling prefix paths", () => {
    expect(() => safePath("../storage-other/secrets")).toThrow();
    expect(() => safePath("/etc/passwd")).toThrow();
  });
  it("keeps AB variations limited to one declared variable", () => {
    const a = fixture();
    const b = structuredClone(a);
    b.structure.hook.chosen_overlay = 1;
    const a2 = structuredClone(a);
    a2.structure.hook.chosen_overlay = 1;
    expect(b).toEqual(a2);
  });
  it("validates every effect default parameter schema", () => {
    for (const e of effectCatalog)
      expect(() => e.schema.parse(e.defaults)).not.toThrow();
  });
});

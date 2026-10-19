import { describe, it, expect } from "vitest";
import { timedSentences } from "../packages/edl/sentences";
import type { Word } from "../packages/edl";
describe("Timed candidate input", () => {
  it("preserves phrase timing and does not split honorific abbreviations", () => {
    const words = [
      "O",
      "Dr.",
      "Destino",
      "voltou.",
      "Será",
      "verdade?",
      "Talvez",
    ].map((text, i) => ({ id: String(i), text, t0: i, t1: i + 0.8 })) as Word[];
    expect(timedSentences(words)).toEqual([
      { start: 0, end: 3.8, text: "O Dr. Destino voltou." },
      { start: 4, end: 5.8, text: "Será verdade?" },
      { start: 6, end: 6.8, text: "Talvez" },
    ]);
  });
  it("accepts an empty transcript", () =>
    expect(timedSentences([])).toEqual([]));
});

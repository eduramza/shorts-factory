import type { Word } from "./index";
export type TimedSentence = { start: number; end: number; text: string };
export function timedSentences(words: Word[]): TimedSentence[] {
  const sentences: TimedSentence[] = [];
  let buffer: Word[] = [];
  const flush = () => {
    if (buffer.length) {
      sentences.push({
        start: buffer[0].t0,
        end: buffer.at(-1)!.t1,
        text: buffer.map((w) => w.text).join(" "),
      });
      buffer = [];
    }
  };
  for (const word of words) {
    buffer.push(word);
    if (
      /[.!?;][”"']?$/.test(word.text) &&
      !/^(?:dr|dra|sr|sra|prof|etc)\.$/i.test(word.text)
    )
      flush();
  }
  flush();
  return sentences;
}

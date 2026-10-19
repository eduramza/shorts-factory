import { create } from "zustand";
import type { EDL } from "../../../packages/edl";
type EditorState = {
  edl: EDL | null;
  past: EDL[];
  future: EDL[];
  revision: number;
  load: (edl: EDL, past?: EDL[], future?: EDL[]) => void;
  edit: (change: (draft: EDL) => void) => void;
  replace: (edl: EDL) => void;
  undo: () => void;
  redo: () => void;
};
export const useEditor = create<EditorState>((set, get) => ({
  edl: null,
  past: [],
  future: [],
  revision: 0,
  load: (edl, past = [], future = []) =>
    set({ edl, past, future, revision: 0 }),
  edit: (change) => {
    const current = get().edl;
    if (!current) return;
    const draft = structuredClone(current);
    change(draft);
    draft.integrity_review = "review";
    draft.qa.passed = false;
    set((s) => ({
      edl: draft,
      past: [...s.past, current],
      future: [],
      revision: s.revision + 1,
    }));
  },
  replace: (edl) => {
    const current = get().edl;
    set((s) => ({
      edl,
      past: current ? [...s.past, current] : s.past,
      future: [],
      revision: s.revision + 1,
    }));
  },
  undo: () => {
    const { edl, past } = get();
    if (!edl || !past.length) return;
    set((s) => ({
      edl: past.at(-1)!,
      past: past.slice(0, -1),
      future: [edl, ...s.future],
      revision: s.revision + 1,
    }));
  },
  redo: () => {
    const { edl, future } = get();
    if (!edl || !future.length) return;
    set((s) => ({
      edl: future[0],
      future: future.slice(1),
      past: [...s.past, edl],
      revision: s.revision + 1,
    }));
  },
}));

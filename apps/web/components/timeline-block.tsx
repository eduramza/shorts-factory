"use client";
import { useRef, useState } from "react";
type Span = { start: number; end: number };
export function TimelineBlock({
  start,
  end,
  text,
  duration,
  className,
  onSelect,
  onChange,
}: {
  start: number;
  end: number;
  text: string;
  duration: number;
  className: string;
  onSelect: () => void;
  onChange: (span: Span, mode: "move" | "start" | "end") => void;
}) {
  const drag = useRef<{
    x: number;
    width: number;
    mode: "move" | "start" | "end";
    moved: boolean;
  } | null>(null);
  const [draft, setDraft] = useState<Span | null>(null);
  const position = draft || { start, end };
  return (
    <button
      className={"timeline-item " + className}
      title={
        text +
        " · " +
        start.toFixed(2) +
        " s. Arraste para mover; bordas para redimensionar."
      }
      aria-label={
        text + " de " + start.toFixed(2) + " a " + end.toFixed(2) + " segundos"
      }
      style={{
        left: (position.start / duration) * 100 + "%",
        width:
          Math.max(0.25, ((position.end - position.start) / duration) * 100) +
          "%",
        touchAction: "none",
      }}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const offset = event.clientX - rect.left;
        drag.current = {
          x: event.clientX,
          width:
            event.currentTarget.parentElement!.getBoundingClientRect().width,
          mode: offset < 7 ? "start" : offset > rect.width - 7 ? "end" : "move",
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const data = drag.current;
        if (!data) return;
        const delta = ((event.clientX - data.x) / data.width) * duration;
        if (Math.abs(event.clientX - data.x) > 3) data.moved = true;
        const next =
          data.mode === "move"
            ? {
                start: Math.max(
                  0,
                  Math.min(duration - (end - start), start + delta),
                ),
                end: 0,
              }
            : data.mode === "start"
              ? {
                  start: Math.max(0, Math.min(end - 1 / 30, start + delta)),
                  end,
                }
              : {
                  start,
                  end: Math.max(
                    start + 1 / 30,
                    Math.min(duration, end + delta),
                  ),
                };
        if (data.mode === "move") next.end = next.start + (end - start);
        setDraft(next);
      }}
      onPointerUp={(event) => {
        const data = drag.current;
        if (data?.moved && draft) onChange(draft, data.mode);
        else onSelect();
        drag.current = null;
        setDraft(null);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const delta = (event.key === "ArrowLeft" ? -1 : 1) / 30;
          onChange(
            {
              start: Math.max(0, start + delta),
              end: Math.min(duration, end + delta),
            },
            "move",
          );
        }
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
    >
      <span className="resize-grip left" />
      {text}
      <span className="resize-grip right" />
    </button>
  );
}

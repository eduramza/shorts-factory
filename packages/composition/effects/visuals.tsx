"use client";
import React from "react";
import { Img, OffthreadVideo } from "remotion";
import type { EffectProps } from "./types";
export function Flash({ progress, params }: EffectProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: String(params.color || "white"),
        opacity: Math.max(0, 1 - progress * 3),
      }}
    />
  );
}
export function Overlay({ progress, params }: EffectProps) {
  const animation = String(params.animation || "pop");
  const text = String(params.text || "");
  return (
    <div
      style={{
        position: "absolute",
        top: "15%",
        left: "8%",
        right: "8%",
        textAlign: "center",
        fontSize: 64,
        fontWeight: 900,
        color: String(params.color || "white"),
        textShadow: "0 3px 8px black",
        transform:
          animation === "slide"
            ? `translateY(${(1 - Math.min(1, progress * 5)) * 100}px)`
            : `scale(${Math.min(1, progress * 7)})`,
      }}
    >
      {animation === "typewriter"
        ? text.slice(0, Math.ceil(text.length * Math.min(1, progress * 3)))
        : text}
    </div>
  );
}
export function Progress({ progress, params }: EffectProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "2%",
        left: "6%",
        height: 8,
        width: `${88 * progress}%`,
        background: String(params.color || "#b7fc70"),
        borderRadius: 10,
      }}
    />
  );
}
export function Countdown({ progress, params }: EffectProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: "8%",
        right: "8%",
        color: "white",
        fontSize: 72,
        fontWeight: 900,
      }}
    >
      {Math.ceil((1 - progress) * Number(params.seconds || 3))}
    </div>
  );
}
export function Highlight({ params }: EffectProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${Number(params.x || 0.5) * 100}%`,
        top: `${Number(params.y || 0.5) * 100}%`,
        border: "9px solid " + String(params.color || "#b7fc70"),
        borderRadius: params.shape === "arrow" ? 0 : "50%",
        width: "25%",
        height: "15%",
        transform: "translate(-50%,-50%)",
      }}
    />
  );
}
export function Fade({ progress }: EffectProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "black",
        opacity: 1 - Math.sin(progress * Math.PI),
      }}
    />
  );
}
export function Glitch({ progress }: EffectProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: progress < 0.5 ? "rgba(255,0,80,.2)" : "rgba(0,255,255,.2)",
        mixBlendMode: "screen",
        transform: `translateX(${Math.sin(progress * 80) * 15}px)`,
      }}
    />
  );
}
export function Sticker({ params }: EffectProps) {
  return (
    <div
      style={{ position: "absolute", left: "40%", top: "40%", fontSize: 130 }}
    >
      {String(params.text || "→")}
    </div>
  );
}
export function Noop() {
  return null;
}

export function Broll({ params }: EffectProps) {
  const src = String(params.src || "");
  if (!src) return null;
  const style = {
    position: "absolute" as const,
    inset: "0",
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  };
  return params.video ? (
    <OffthreadVideo src={src} muted style={style} />
  ) : (
    <Img src={src} style={style} />
  );
}

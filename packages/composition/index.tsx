import React from "react";
import {
  AbsoluteFill,
  Freeze,
  Sequence,
  OffthreadVideo,
  Audio,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { EDL, CatalogAsset } from "../edl";
import { config } from "../edl";
import { effectCatalog } from "./effects/catalog";
export type CompositionProps = {
  edl: EDL;
  sourceUrl: string;
  assets: CatalogAsset[];
  voiceUrl?: string;
  cleanVoiceUrl?: string;
  sourceMeta?: { width: number; height: number };
};
function dbGain(db: number) {
  return 10 ** (db / 20);
}
function mediaVolume(frame: number, duration: number, fps: number) {
  return Math.min(
    1,
    frame / (fps * config.crossfade),
    Math.max(0, (duration - frame) / (fps * config.crossfade)),
  );
}
function VideoSegment({url,start,speed,duration,edl,cx,cy,voiceUrl,muted=false,sourceMeta,aspect=9/16,outStart=0}:{url:string;start:number;speed:number;duration:number;edl:EDL;cx:number;cy:number;voiceUrl?:string;muted?:boolean;sourceMeta?:{width:number;height:number};aspect?:number;outStart?:number}){
 const frame=useCurrentFrame();const {fps}=useVideoConfig();const sw=sourceMeta?.width||1920,sh=sourceMeta?.height||1080;const cropW=Math.min(sw,sh*aspect),cropH=Math.min(sh,sw/aspect);const px=sw===cropW?.5:Math.max(0,Math.min(1,(cx*sw-cropW/2)/(sw-cropW)));const py=sh===cropH?.5:Math.max(0,Math.min(1,(cy*sh-cropH/2)/(sh-cropH)));
 const freeze=edl.effects.find(e=>e.type==='freeze_frame'&&outStart+frame/fps>=e.t0&&outStart+frame/fps<e.t1);
 const visual=<OffthreadVideo muted src={url} startFrom={Math.round(start*fps)} playbackRate={speed} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:`${px*100}% ${py*100}%`}}/>;
 return <>{freeze?<Freeze frame={Math.max(0,Math.round((freeze.t0-outStart)*fps))}>{visual}</Freeze>:visual}{!muted&&<Audio src={voiceUrl||url} startFrom={Math.round(start*fps)} playbackRate={speed} volume={f=>mediaVolume(f,duration,fps)}/>}</>;
}
export function ShortComposition({
  edl,
  sourceUrl,
  assets,
  voiceUrl,
  cleanVoiceUrl,
  sourceMeta,
}: CompositionProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const keys = edl.reframe.keyframes;
  const before = [...keys].reverse().find((k) => k.t <= t) || keys[0];
  const after = keys.find((k) => k.t > t) || before;
  const f = after.t === before.t ? 0 : (t - before.t) / (after.t - before.t);
  const cx = before.cx + (after.cx - before.cx) * f,
    cy = before.cy + (after.cy - before.cy) * f;
  let scale = before.scale + (after.scale - before.scale) * f,
    dx = 0,
    dy = 0,
    blur = 0;
  for (const effect of edl.effects.filter((e) => e.t0 <= t && e.t1 > t)) {
    const p = (t - effect.t0) / (effect.t1 - effect.t0);
    if (effect.type === "zoom_punch")
      scale *=
        1 + (Number(effect.params.scale || 1.08) - 1) * (1 - (1 - p) ** 3);
    if (effect.type === "zoom_slow")
      scale *= 1 + (Number(effect.params.scale || 1.08) - 1) * p;
    if (effect.type === "shake") {
      dx = Math.sin(p * 70) * Number(effect.params.intensity || 5);
      dy = Math.cos(p * 90) * Number(effect.params.intensity || 5);
    }
    if (effect.type === "pan_suave")
      dx = (p - 0.5) * 1080 * Number(effect.params.distance || 0.03);
    if (effect.type === "whip_pan") dx = Math.sin(p * Math.PI) * 1080 * 0.15;
    if (effect.type === "blur_in") blur = (1 - p) * 15;
    if (effect.type === "blur_out") blur = p * 15;
  }
  const activeWord = edl.captions.words.findIndex((w) => w.t0 <= t && w.t1 > t);
  const groupStart = Math.max(0, Math.floor(activeWord / 3) * 3);
  const words =
    activeWord >= 0 ? edl.captions.words.slice(groupStart, groupStart + 3) : [];
  return (
    <AbsoluteFill
      style={{
        background: "#10121a",
        fontFamily: "Arial, sans-serif",
        color: "white",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          width: 1080,
          height: 1920,
          transform: `scale(${width / 1080})`,
          transformOrigin: "top left",
        }}
      >
        <AbsoluteFill
          style={{
            transform: `translate(${dx}px,${dy}px) scale(${scale})`,
            filter: `blur(${blur}px)`,
          }}
        >
          {edl.segments.map((s) => (
            <Sequence
              key={s.id}
              from={Math.round(s.out_start * fps)}
              durationInFrames={Math.max(
                1,
                Math.round(((s.src_end - s.src_start) / s.speed) * fps),
              )}
            >
              <AbsoluteFill style={{ overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  {edl.reframe.mode === "split" ? (
                    <>
                      <div
                        style={{
                          height: "50%",
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <VideoSegment
                          url={sourceUrl}
                          start={s.src_start} outStart={s.out_start}
                          speed={s.speed}
                          duration={((s.src_end - s.src_start) / s.speed) * fps}
                          edl={edl}
                          cx={0.25}
                          cy={cy}
                          sourceMeta={sourceMeta}
                          aspect={9 / 8}
                          voiceUrl={
                            edl.audio.voice.denoise ? cleanVoiceUrl : voiceUrl
                          }
                        />
                      </div>
                      <div
                        style={{
                          height: "50%",
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <VideoSegment
                          url={sourceUrl}
                          start={s.src_start} outStart={s.out_start}
                          speed={s.speed}
                          duration={((s.src_end - s.src_start) / s.speed) * fps}
                          edl={edl}
                          cx={0.75}
                          cy={cy}
                          sourceMeta={sourceMeta}
                          aspect={9 / 8}
                          muted
                        />
                      </div>
                    </>
                  ) : (
                    <VideoSegment
                      url={sourceUrl}
                      start={s.src_start} outStart={s.out_start}
                      speed={s.speed}
                      duration={((s.src_end - s.src_start) / s.speed) * fps}
                      edl={edl}
                      cx={cx}
                      cy={cy}
                      sourceMeta={sourceMeta}
                      voiceUrl={
                        edl.audio.voice.denoise ? cleanVoiceUrl : voiceUrl
                      }
                    />
                  )}
                </div>
              </AbsoluteFill>
            </Sequence>
          ))}
        </AbsoluteFill>
        {t < edl.structure.hook.end && (
          <div
            style={{
              position: "absolute",
              top: "12%",
              left: "8%",
              right: "8%",
              fontSize: 66,
              fontWeight: 900,
              lineHeight: 1.1,
              textAlign: "center",
              textShadow: "0 3px 12px #000",
            }}
          >
            {
              edl.structure.hook.text_overlay_options[
                edl.structure.hook.chosen_overlay
              ]
            }
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: `${edl.captions.bottom * 100}%`,
            left: `${edl.captions.side * 100}%`,
            right: `${edl.captions.side * 100}%`,
            textAlign: "center",
            fontWeight: 900,
            fontSize: edl.captions.fontSize,
            lineHeight: 1.25,
            WebkitTextStroke:
              edl.captions.style === "contorno" ? "2px black" : undefined,
            textShadow: "0 3px 6px black",
            background:
              edl.captions.style === "caixa" ? "rgba(0,0,0,.7)" : undefined,
          }}
        >
          {words.map((w, i) => (
            <React.Fragment key={w.id || i}>
              <span
                style={{
                  color:
                    groupStart + i === activeWord
                      ? edl.captions.activeColor
                      : edl.captions.color,
                  display: "inline-block",
                  transform:
                    groupStart + i === activeWord ? "scale(1.06)" : undefined,
                }}
              >
                {w.text}
              </span>{" "}
            </React.Fragment>
          ))}
        </div>
        {edl.effects.map((effect, i) => {
          if (t < effect.t0 || t >= effect.t1) return null;
          const definition = effectCatalog.find((e) => e.id === effect.type);
          if (!definition || definition.camera) return null;
          const Renderer = definition.render;
          return (
            <Renderer
              key={i}
              progress={(t - effect.t0) / (effect.t1 - effect.t0)}
              params={
                effect.type.startsWith("broll_")
                  ? {
                      ...effect.params,
                      src: assets.find((a) => a.id === effect.params.asset_id)
                        ?.path,
                      video: effect.type === "broll_video",
                    }
                  : effect.params
              }
              width={1080}
              height={1920}
            />
          );
        })}
        {edl.audio.music.map((m, i) => {
          const a = assets.find((a) => a.id === m.track_id);
          return a?.path ? (
            <Sequence
              key={i}
              from={Math.round(m.t0 * fps)}
              durationInFrames={Math.max(1, Math.round((m.t1 - m.t0) * fps))}
            >
              <Audio
                src={a.path}
                volume={(f) => {
                  const local = f / fps;
                  const speaking = edl.captions.words.some(
                    (w) => w.t0 <= m.t0 + local && w.t1 > m.t0 + local,
                  );
                  return (
                    dbGain(
                      m.gain_db +
                        (m.ducking && speaking ? config.duckingDb : 0),
                    ) *
                    Math.min(
                      1,
                      local / Math.max(0.01, m.fade_in),
                      (m.t1 - m.t0 - local) / Math.max(0.01, m.fade_out),
                    )
                  );
                }}
              />
            </Sequence>
          ) : null;
        })}
        {edl.audio.sfx.map((s, i) => {
          const a = assets.find((a) => a.id === s.id);
          return a?.path ? (
            <Sequence key={i} from={Math.round(s.t * fps)}>
              <Audio src={a.path} volume={dbGain(s.gain_db)} />
            </Sequence>
          ) : null;
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

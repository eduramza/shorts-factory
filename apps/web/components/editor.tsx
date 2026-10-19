"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Undo2,
  Redo2,
  Download,
  Scissors,
  Plus,
  Trash2,
  Check,
  X,
  Copy,
  Save,
  LoaderCircle,
  ChevronUp,
  ChevronDown,
  Eye,
} from "lucide-react";
import { ShortComposition } from "../../../packages/composition";
import {
  config,
  applySpeedRamp,
  edlSchema,
  removeWord,
  rebuildFromSegments,
  native4k,
  maximumScale,
  type EDL,
  type Word,
  type CatalogAsset,
} from "../../../packages/edl";
import { Button } from "./ui/button";
import { TimelineBlock } from "./timeline-block";
import { api, post, time, type Clip, type Project } from "../lib/client";
import {diffEdl} from "../../../packages/edl/diff";
import {Modal} from "./modal";
import { useEditor } from "../lib/editor-store";
type EffectItem = {
  id: string;
  nome: string;
  categoria: string;
  defaults: Record<string, unknown>;
};
export function Editor({
  clipId,
  onBack,
}: {
  clipId: string;
  onBack: () => void;
}) {
  const { edl, past, future, revision, load, edit, replace, undo, redo } =
    useEditor();
  const [project, setProject] = useState<Project | null>(null);
  const [transcript, setTranscript] = useState<Word[]>([]);
  const [catalog, setCatalog] = useState<EffectItem[]>([]);
  const [assets, setAssets] = useState<CatalogAsset[]>([]);
  const [tab, setTab] = useState("Gancho");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("Salvo");
  const [proposal, setProposal] = useState<EDL | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [safe, setSafe] = useState(false);
  const [loop, setLoop] = useState(false);
  const [preset, setPreset] = useState("1080p");
  const [versions, setVersions] = useState<
    { id: string; label: string; edlJson: string; createdAt: string }[]
  >([]);
  const [versionName, setVersionName] = useState("");
  const player = useRef<PlayerRef>(null);
  const saveQueue = useRef(Promise.resolve());
  const loadedId = useRef("");
  const [showDetails, setShowDetails] = useState(false);
  const t = frame / config.fps;
  useEffect(() => {
    let active = true;
    loadedId.current = "";
    Promise.all([
      api<Clip & { history: { past: EDL[]; future: EDL[] } }>(
        "clips/" + clipId,
      ),
      api<EffectItem[]>("effects"),
      api<CatalogAsset[]>("assets"),
    ])
      .then(async ([clip, effects, media]) => {
        const [{ project }, words] = await Promise.all([
          api<{ project: Project }>("projects/" + clip.projectId),
          api<Word[]>("projects/" + clip.projectId + "/transcript"),
        ]);
        if (!active) return;
        load(
          edlSchema.parse(JSON.parse(clip.edlJson)),
          clip.history.past,
          clip.history.future,
        );
        setProject(project);
        setTranscript(words);
        setCatalog(effects);
        setAssets(media);
        loadedId.current = clipId;
        setVersions(await api("clips/" + clipId + "/versions"));
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [clipId, load]);
  useEffect(() => {
    if (!revision || !edl || loadedId.current !== clipId) return;
    setSaved("Alterações pendentes…");
    const timer = setTimeout(() => {
      const snapshot = edl;
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await api("clips/" + clipId, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              edl: snapshot,
              label: "Autosave",
              history: { past, future },
            }),
          });
          setSaved("Salvo localmente");
        } catch (e) {
          setSaved("Falha ao salvar");
          setError(e instanceof Error ? e.message : "Falha ao salvar");
        }
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [revision, edl, clipId]);
  useEffect(() => {
    const id = setInterval(() => {
      const p = player.current;
      if (p) {
        setFrame(p.getCurrentFrame());
        setPlaying(p.isPlaying());
      }
    }, 100);
    return () => clearInterval(id);
  }, []);
  const seek = useCallback((value: number) => {
    player.current?.seekTo(Math.max(0, Math.round(value * config.fps)));
  }, []);
  function split() {
    if (!edl) return;
    const word = [...edl.captions.words].sort(
      (a, b) => Math.abs(a.t0 - t) - Math.abs(b.t0 - t),
    )[0];
    if (!word) return;
    const segment = edl.segments.find(
      (s) =>
        word.t0 > s.out_start + 0.02 &&
        word.t0 < s.out_start + (s.src_end - s.src_start) / s.speed - 0.02,
    );
    if (!segment) return;
    const source =
      segment.src_start + (word.t0 - segment.out_start) * segment.speed;
    const previous = transcript
      .filter((w) => w.t1 <= source + 0.001 && w.t0 >= segment.src_start)
      .at(-1);
    if (!previous) return;
    replace(
      rebuildFromSegments(
        edl,
        edl.segments.flatMap((s) =>
          s.id === segment.id
            ? [
                { ...s, id: s.id + "a", src_end: previous.t1 },
                { ...s, id: s.id + "b", src_start: source },
              ]
            : [s],
        ),
        transcript,
      ),
    );
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        player.current?.toggle();
      }
      if (e.key.toLowerCase() === "k") player.current?.pause();
      if (e.key.toLowerCase() === "j") {
        player.current?.pause();
        seek(Math.max(0, t - 1 / config.fps));
      }
      if (e.key.toLowerCase() === "l") seek(t + 1 / config.fps);
      if (e.key.toLowerCase() === "s") split();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === "Delete" && selected !== null) {
        edit((d) => {
          d.effects.splice(selected, 1);
        });
        setSelected(null);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [t, edl, selected]);
  async function propose(action: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<EDL>(
        "clips/" + clipId + "/propose",
        post({
          action,
          ...(action === "shorten"
            ? {
                seconds: Math.max(
                  config.modes[edl!.mode].min,
                  edl!.duration_out - 5,
                ),
              }
            : {}),
        }),
      );
      setProposal(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na proposta.");
    } finally {
      setBusy(false);
    }
  }
  async function exportVideo() {
    if (!edl || !project) return;
    setBusy(true);
    try {
      await saveQueue.current;
      await api("clips/" + clipId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edl,
          label: "Antes da exportação",
          history: { past, future },
        }),
      });
      const meta = JSON.parse(project.sourceMetaJson || "{}");
      const upscale = preset === "4k" && !native4k(meta.width, meta.height,maximumScale(edl));
      if (
        upscale &&
        !window.confirm(
          "A fonte não tem resolução para 4K nativo; o resultado seria ampliado. Exportar ampliado?",
        )
      )
        return;
      const allowReview =
        edl.qa.passed ||
        window.confirm(
          "Há itens de QA a revisar. Exportar uma cópia para revisão?",
        );
      if (!allowReview) return;
      await api(
        "clips/" + clipId + "/export",
        post({ preset, allowUpscale: upscale, allowReview: true }),
      );
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao exportar.");
    } finally {
      setBusy(false);
    }
  }
  if (!edl || !project || edl.clip_id !== clipId)
    return (
      <div className="editor-loading">
        <LoaderCircle className="spin" />
        <p>{error || "Abrindo o editor…"}</p>
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
      </div>
    );
  const duration = edl.duration_out;
  const meta = JSON.parse(project.sourceMetaJson || "{}");
  return (
    <div className="editor-shell">
      <header className="editor-header">
        <div className="inline-actions">
          <Button
            variant="ghost"
            onClick={async () => {
              await saveQueue.current;
              try {
                await api("clips/" + clipId, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    edl,
                    label: "Ao fechar editor",
                    history: { past, future },
                  }),
                });
                onBack();
              } catch (e) {
                setError(String(e));
              }
            }}
            aria-label="Voltar à galeria"
          >
            <ArrowLeft size={18} />
          </Button>
          <span className="logo-icon">
            <Scissors size={19} />
          </span>
          <div>
            <strong>{project.title}</strong>
            <small>{saved} · Edição não destrutiva</small>
          </div>
        </div>
        <div className="inline-actions">
          <Button
            variant="ghost"
            disabled={!past.length}
            onClick={undo}
            aria-label="Desfazer"
          >
            <Undo2 size={18} />
          </Button>
          <Button
            variant="ghost"
            disabled={!future.length}
            onClick={redo}
            aria-label="Refazer"
          >
            <Redo2 size={18} />
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDetails(!showDetails)}
          >
            <Eye size={16} />
            Análise
          </Button>
          <select
            aria-label="Qualidade de exportação"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          >
            <option value="draft">Rascunho · 540p</option>
            <option value="1080p">Padrão · 1080p</option>
            <option value="4k">
              4K · {native4k(meta.width, meta.height,maximumScale(edl)) ? "nativo" : "ampliado"}
            </option>
          </select>
          <Button disabled={busy} onClick={exportVideo}>
            <Download size={17} />
            Exportar
          </Button>
        </div>
      </header>
      {error && (
        <div className="alert" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Fechar erro">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="editor-body">
        <aside className="transcript-panel">
          <div className="panel-title">
            <h2>Transcrição</h2>
            <span className="pill">{edl.captions.words.length} palavras</span>
          </div>
          <p className="muted small">
            Clique para navegar. Use × para remover a palavra do vídeo.
          </p>
          <div className="transcript-words">
            {edl.captions.words.map((word, i) => (
              <span
                key={word.id + "-" + i}
                className={
                  word.t0 <= t && word.t1 > t ? "word active-word" : "word"
                }
              >
                <button onClick={() => seek(word.t0)}>{word.text}</button>
                <button
                  aria-label={"Remover " + word.text}
                  onClick={() => replace(removeWord(edl, i, transcript))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <details>
            <summary>Ordem dos blocos</summary>
            {edl.segments.map((s, i) => (
              <div key={s.id} className="block-row">
                <span>
                  {s.role} · {time(s.src_start)}
                </span>
                <button
                  aria-label="Mover bloco para cima"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...edl.segments];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    replace(rebuildFromSegments(edl, next, transcript));
                  }}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  aria-label="Mover bloco para baixo"
                  disabled={i === edl.segments.length - 1}
                  onClick={() => {
                    const next = [...edl.segments];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    replace(rebuildFromSegments(edl, next, transcript));
                  }}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            ))}
          </details>
          <div className="transcript-bottom">
            <ShieldNote />
          </div>
        </aside>
        <section className="preview-panel">
          <div className="preview-heading">
            <span>PREVIEW · 9:16</span>
            <button onClick={() => setSafe(!safe)}>
              {safe ? "Ocultar" : "Mostrar"} área segura
            </button>
          </div>
          <div className="player-container">
            <Player
              ref={player}
              component={ShortComposition}
              inputProps={{
                edl,
                sourceMeta: meta,
                voiceUrl: "/api/media/projects/" + project.id + "/voice.wav",
                cleanVoiceUrl:
                  "/api/media/projects/" + project.id + "/voice-clean.wav",
                sourceUrl: "/api/media/" + project.sourcePath,
                assets: assets.map((a) => ({
                  ...a,
                  path: a.path ? "/api/media/" + a.path : undefined,
                })),
              }}
              durationInFrames={Math.max(1, Math.round(duration * config.fps))}
              fps={config.fps}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: "100%", height: "100%" }}
              loop={loop}
              controls={false}
              clickToPlay
            />
            {safe && <div className="safe-overlay" aria-hidden="true" />}
          </div>
          <div className="player-controls">
            <Button
              size="sm"
              variant="ghost"
              aria-label="Frame anterior"
              onClick={() => seek(t - 1 / config.fps)}
            >
              <SkipBack size={16} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={playing ? "Pausar" : "Reproduzir"}
              onClick={() => player.current?.toggle()}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Próximo frame"
              onClick={() => seek(t + 1 / config.fps)}
            >
              <SkipForward size={16} />
            </Button>
            <span>
              {time(t)} <span className="muted">/ {time(duration)}</span>
            </span>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
              />
              Loop
            </label>
          </div>
        </section>
        <aside className="inspector">
          <nav className="editor-tabs" aria-label="Ferramentas de edição">
            {["Gancho", "Legendas", "Efeitos", "Áudio", "Crop", "Versões"].map(
              (v) => (
                <button
                  className={tab === v ? "selected" : ""}
                  onClick={() => setTab(v)}
                  key={v}
                >
                  {v}
                </button>
              ),
            )}
          </nav>
          <div className="inspector-content">
            {tab === "Gancho" && (
              <>
                <span className="eyebrow">OS PRIMEIROS 3 SEGUNDOS</span>
                <h2>Faça valer o primeiro play.</h2>
                <p className="muted">Três aberturas, uma mesma história.</p>
                {edl.structure.hook.text_overlay_options.map((text, i) => (
                  <div
                    className={
                      "hook-option " +
                      (edl.structure.hook.chosen_overlay === i
                        ? "selected"
                        : "")
                    }
                    key={i}
                  >
                    <label>
                      <input
                        type="radio"
                        checked={edl.structure.hook.chosen_overlay === i}
                        onChange={() =>
                          edit((d) => {
                            d.structure.hook.chosen_overlay = i;
                          })
                        }
                      />
                      OPÇÃO {i + 1}
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) =>
                        edit((d) => {
                          d.structure.hook.text_overlay_options[i] =
                            e.target.value;
                        })
                      }
                    />
                    <small>{text.trim().split(/\s+/).length}/8 palavras</small>
                  </div>
                ))}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => propose("hook")}
                >
                  Regenerar gancho
                </Button>
                <div className="inspector-section">
                  <h3>Propostas de IA</h3>
                  <p className="muted small">
                    Você revisa a diferença antes de aplicar.
                  </p>
                  {[
                    { id: "shorten", label: "Encurtar 5 segundos" },
                    { id: "tension", label: "Aumentar tensão" },
                    { id: "ending", label: "Refazer só o final" },
                  ].map((a) => (
                    <Button
                      key={a.id}
                      variant="outline"
                      disabled={busy}
                      onClick={() => propose(a.id)}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
            {tab === "Legendas" && (
              <>
                <h2>Legendas dinâmicas</h2>
                <label>
                  Estilo
                  <select
                    value={edl.captions.style}
                    onChange={(e) =>
                      edit((d) => {
                        d.captions.style = e.target.value;
                      })
                    }
                  >
                    {["ativa", "limpo", "caixa", "contorno", "karaoke"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Cor
                    <input
                      type="color"
                      value={edl.captions.color}
                      onChange={(e) =>
                        edit((d) => {
                          d.captions.color = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    Destaque
                    <input
                      type="color"
                      value={edl.captions.activeColor}
                      onChange={(e) =>
                        edit((d) => {
                          d.captions.activeColor = e.target.value;
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Tamanho: {edl.captions.fontSize}
                  <input
                    type="range"
                    min="24"
                    max="110"
                    value={edl.captions.fontSize}
                    onChange={(e) =>
                      edit((d) => {
                        d.captions.fontSize = Number(e.target.value);
                      })
                    }
                  />
                </label>
                <label>
                  Margem inferior: {Math.round(edl.captions.bottom * 100)}%
                  <input
                    type="range"
                    min=".2"
                    max=".7"
                    step=".01"
                    value={edl.captions.bottom}
                    onChange={(e) =>
                      edit((d) => {
                        d.captions.bottom = Number(e.target.value);
                      })
                    }
                  />
                </label>
                <h3>Palavra a palavra</h3>
                <div className="caption-edit-list">
                  {edl.captions.words.map((w, i) => (
                    <label key={i}>
                      <span>{w.t0.toFixed(2)} s</span>
                      <input
                        aria-label={"Legenda " + (i + 1)}
                        value={w.text}
                        onFocus={() => seek(w.t0)}
                        onChange={(e) =>
                          edit((d) => {
                            d.captions.words[i].text = e.target.value;
                            d.integrity_review = "review";
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
            {tab === "Efeitos" && (
              <>
                <h2>Catálogo de efeitos</h2>
                <p className="muted small">
                  Adicionar no cursor: {t.toFixed(2)} s
                </p>
                <div className="effect-grid">
                  {catalog.map((e) => (
                    <button
                      key={e.id}
                      disabled={
                        e.id.startsWith("broll_") &&
                        !assets.some(
                          (a) =>
                            a.type ===
                            (e.id === "broll_video" ? "brand" : "sticker"),
                        )
                      }
                      onClick={() =>
                        e.id==="speed_ramp"?replace(applySpeedRamp(edl,transcript,t,Math.min(duration,t+3),.8,1.2)):edit((d) => {
                          d.effects.push({
                            id: crypto.randomUUID(),
                            type: e.id,
                            t0: Math.min(t, duration - 0.1),
                            t1: Math.min(duration, t + 1),
                            params: e.id.startsWith("broll_")
                              ? {
                                  asset_id:
                                    assets.find(
                                      (a) =>
                                        a.type ===
                                        (e.id === "broll_video"
                                          ? "brand"
                                          : "sticker"),
                                    )?.id || "",
                                }
                              : structuredClone(e.defaults),
                            reason: "Ênfase narrativa adicionada pelo editor.",
                          });
                        })
                      }
                    >
                      <Plus size={17} />
                      <strong>{e.nome}</strong>
                      <small>{e.categoria}</small>
                    </button>
                  ))}
                </div>
                {selected !== null && edl.effects[selected] && (
                  <div className="inspector-section">
                    <h3>{edl.effects[selected].type}</h3>
                    <label>
                      Início
                      <input
                        type="number"
                        min="0"
                        max={duration}
                        step=".01"
                        value={edl.effects[selected].t0}
                        onChange={(e) =>
                          edit((d) => {
                            d.effects[selected!].t0 = Number(e.target.value);
                          })
                        }
                      />
                    </label>
                    <label>
                      Fim
                      <input
                        type="number"
                        min="0"
                        max={duration}
                        step=".01"
                        value={edl.effects[selected].t1}
                        onChange={(e) =>
                          edit((d) => {
                            d.effects[selected!].t1 = Number(e.target.value);
                          })
                        }
                      />
                    </label>
                    {Object.entries(edl.effects[selected].params).map(
                      ([key, value]) => (
                        <label key={key}>
                          {key}
                          <input
                            value={String(value)}
                            type={typeof value === "number" ? "number" : "text"}
                            step=".01"
                            onChange={(e) =>
                              edit((d) => {
                                d.effects[selected!].params[key] =
                                  typeof value === "number"
                                    ? Number(e.target.value)
                                    : e.target.value;
                              })
                            }
                          />
                        </label>
                      ),
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => {
                        edit((d) => {
                          d.effects.splice(selected, 1);
                        });
                        setSelected(null);
                      }}
                    >
                      <Trash2 size={15} />
                      Remover efeito
                    </Button>
                  </div>
                )}
              </>
            )}
            {tab === "Áudio" && (
              <>
                <h2>Voz e trilha</h2>
                <p className="muted">
                  A voz é normalizada para −14 LUFS na exportação.
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={edl.audio.voice.denoise}
                    onChange={(e) =>
                      edit((d) => {
                        d.audio.voice.denoise = e.target.checked;
                      })
                    }
                  />
                  Reduzir ruído na voz
                </label>
                <label>
                  Música
                  <select
                    value={edl.audio.music[0]?.track_id || ""}
                    onChange={(e) =>
                      edit((d) => {
                        d.audio.music = e.target.value
                          ? [
                              {
                                track_id: e.target.value,
                                t0: 0,
                                t1: duration,
                                mood: "suspense",
                                gain_db: -12,
                                ducking: true,
                                fade_in: 0.2,
                                fade_out: 0.3,
                              },
                            ]
                          : [];
                      })
                    }
                  >
                    <option value="">Sem música</option>
                    {assets
                      .filter((a) => a.type === "music")
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.id}
                        </option>
                      ))}
                  </select>
                </label>
                {edl.audio.music.map((m, i) => (
                  <div key={i}>
                    <label>
                      Volume: {m.gain_db} dB
                      <input
                        type="range"
                        min="-36"
                        max="0"
                        value={m.gain_db}
                        onChange={(e) =>
                          edit((d) => {
                            d.audio.music[i].gain_db = Number(e.target.value);
                          })
                        }
                      />
                    </label>
                    <p className="muted">
                      Ducking automático sob a fala: −16 dB.
                    </p>
                    <label>
                      Fade in (s)
                      <input
                        type="number"
                        step=".1"
                        min="0"
                        value={m.fade_in}
                        onChange={(e) =>
                          edit((d) => {
                            d.audio.music[i].fade_in = Number(e.target.value);
                          })
                        }
                      />
                    </label>
                    <label>
                      Fade out (s)
                      <input
                        type="number"
                        step=".1"
                        min="0"
                        value={m.fade_out}
                        onChange={(e) =>
                          edit((d) => {
                            d.audio.music[i].fade_out = Number(e.target.value);
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                <label>
                  Adicionar SFX no cursor
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value)
                        edit((d) => {
                          d.audio.sfx.push({
                            id: e.target.value,
                            t,
                            gain_db: -10,
                          });
                        });
                    }}
                  >
                    <option value="">Escolha um SFX</option>
                    {assets
                      .filter((a) => a.type === "sfx")
                      .map((a) => (
                        <option key={a.id}>{a.name||a.id}</option>
                      ))}
                  </select>
                </label>
                {!assets.length && (
                  <p className="muted">
                    Cadastre faixas licenciadas na biblioteca para habilitar
                    música e SFX.
                  </p>
                )}
              </>
            )}
            {tab === "Crop" && (
              <>
                <h2>Enquadramento 9:16</h2>
                <label>
                  Modo
                  <select
                    value={edl.reframe.mode}
                    onChange={(e) =>
                      edit((d) => {
                        d.reframe.mode = e.target
                          .value as EDL["reframe"]["mode"];
                        if (e.target.value === "center")
                          d.reframe.keyframes = [
                            { t: 0, cx: 0.5, cy: 0.5, scale: 1 },
                          ];
                      })
                    }
                  >
                    <option value="auto_face">Automático · rosto</option>
                    <option value="center">Centro</option>
                    <option value="manual">Manual</option>
                    <option value="split">Tela dividida · duas zonas</option>
                  </select>
                </label>
                <p className="muted small">
                  O automático combina energia de áudio, movimento facial e
                  diarização quando disponível. Revise as alternâncias. Tela
                  dividida mostra duas zonas fixas da fonte.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    edit((d) => {
                      d.reframe.keyframes.push({
                        t,
                        cx: 0.5,
                        cy: 0.4,
                        scale: 1,
                      });
                      d.reframe.keyframes.sort((a, b) => a.t - b.t);
                    })
                  }
                >
                  <Plus size={15} />
                  Keyframe no cursor
                </Button>
                {edl.reframe.keyframes
                  .filter(
                    (_, i) => edl.reframe.mode === "manual" || i % 10 === 0,
                  )
                  .slice(0, 50)
                  .map((k) => (
                    <div className="crop-key" key={k.t}>
                      <button onClick={() => seek(k.t)}>
                        {k.t.toFixed(2)} s
                      </button>
                      {(["cx", "cy", "scale"] as const).map((property) => (
                        <label key={property}>
                          {property}
                          <input
                            type="number"
                            min={property === "scale" ? 1 : 0}
                            max={property === "scale" ? 2 : 1}
                            step=".01"
                            value={k[property]}
                            onChange={(e) =>
                              edit((d) => {
                                const key = d.reframe.keyframes.find(
                                  (key) => key.t === k.t,
                                );
                                if (key) key[property] = Number(e.target.value);
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ))}
              </>
            )}
            {tab === "Versões" && (
              <>
                <h2>Histórico persistente</h2>
                <label>
                  Nome da versão
                  <input
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    placeholder="Ex.: Gancho mais direto"
                  />
                </label>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await api("clips/" + clipId, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          edl,
                          label: versionName || "Versão nomeada",
                          history: { past, future },
                        }),
                      });
                      setVersions(await api("clips/" + clipId + "/versions"));
                      setVersionName("");
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  <Save size={16} />
                  Salvar versão
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () =>
                    setVersions(await api("clips/" + clipId + "/versions"))
                  }
                >
                  Atualizar histórico
                </Button>
                {versions.map((v) => (
                  <button
                    className="version-row"
                    key={v.id}
                    onClick={() =>
                      replace(edlSchema.parse(JSON.parse(v.edlJson)))
                    }
                  >
                    <strong>{v.label}</strong>
                    <small>
                      {new Date(v.createdAt).toLocaleString("pt-BR")}
                    </small>
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>
      <section className="timeline-panel">
        <div className="timeline-toolbar">
          <div className="inline-actions">
            <strong>Timeline</strong>
            <span className="muted small">
              {duration.toFixed(2)} s · {config.fps} fps
            </span>
            <Button variant="ghost" size="sm" onClick={split}>
              <Scissors size={15} />
              Dividir no limite da palavra
            </Button>
          </div>
          <span className="muted small">
            Espaço: play · J/K/L · S: dividir · ⌘Z: desfazer
          </span>
        </div>
        <div className="timeline">
          <div className="timeline-ruler">
            <span />
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - rect.left) / rect.width) * duration);
              }}
            >
              {Array.from({ length: 11 }, (_, i) => (
                <span key={i}>{((duration * i) / 10).toFixed(1)}s</span>
              ))}
              <i
                className="playhead"
                style={{ left: (t / duration) * 100 + "%" }}
              />
            </div>
          </div>
          {[
            {
              label: "Vídeo",
              color: "video-track",
              items: edl.segments.map((s) => ({
                start: s.out_start,
                end: s.out_start + (s.src_end - s.src_start) / s.speed,
                text:({hook:"Gancho",body:"Narrativa",payoff:"Payoff"})[s.role],
              })),
            },
            {
              label: "Legendas",
              color: "caption-track",
              items: edl.captions.words.map((w) => ({
                start: w.t0,
                end: w.t1,
                text: w.text,
              })),
            },
            {
              label: "Efeitos",
              color: "effect-track",
              items: edl.effects.map((e) => ({
                start: e.t0,
                end: e.t1,
                text: e.type,
              })),
            },
            {
              label: "Texto",
              color: "text-track",
              items: [
                {
                  start: 0,
                  end: edl.structure.hook.end,
                  text: edl.structure.hook.text_overlay_options[
                    edl.structure.hook.chosen_overlay
                  ],
                },
              ],
            },
            {
              label: "Música",
              color: "music-track",
              items: edl.audio.music.map((m) => ({
                start: m.t0,
                end: m.t1,
                text: m.mood,
              })),
            },
            {
              label: "SFX",
              color: "sfx-track",
              items: edl.audio.sfx.map((s) => ({
                start: s.t,
                end: Math.min(duration, s.t + 0.4),
                text: s.id,
              })),
            },
          ].map((track) => (
            <div className="timeline-row" key={track.label}>
              <span>{track.label}</span>
              <div
                className="track-content"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    seek(((e.clientX - rect.left) / rect.width) * duration);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const index = Number(e.dataTransfer.getData("effect"));
                  if (track.label !== "Efeitos" || !Number.isInteger(index))
                    return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const raw = ((e.clientX - rect.left) / rect.width) * duration;
                  const nearest =
                    [...edl.captions.words].sort(
                      (a, b) => Math.abs(a.t0 - raw) - Math.abs(b.t0 - raw),
                    )[0]?.t0 || 0;
                  edit((d) => {
                    const e = d.effects[index];
                    if (e) {
                      const length = e.t1 - e.t0;
                      e.t0 = Math.min(nearest, duration - 0.1);
                      e.t1 = Math.min(duration, e.t0 + length);
                    }
                  });
                }}
              >
                {track.items.map((item, i) => (
                  <TimelineBlock
                    key={i}
                    start={item.start}
                    end={item.end}
                    text={item.text}
                    duration={duration}
                    className={
                      track.color +
                      (track.label === "Efeitos" && selected === i
                        ? " chosen"
                        : "")
                    }
                    onSelect={() => {
                      seek(item.start);
                      if (track.label === "Efeitos") {
                        setSelected(i);
                        setTab("Efeitos");
                      }
                    }}
                    onChange={(span, mode) => {
                      const boundaries = edl.captions.words.flatMap((w) => [
                        w.t0,
                        w.t1,
                      ]);
                      const snap = (value: number) =>
                        boundaries.reduce(
                          (best, b) =>
                            Math.abs(b - value) < Math.abs(best - value)
                              ? b
                              : best,
                          boundaries[0] || 0,
                        );
                      if (track.label === "Vídeo") {
                        const segment = edl.segments[i];
                        if (mode === "move") {
                          const next = [...edl.segments];
                          const target = next.findIndex(
                            (s) => s.out_start >= snap(span.start),
                          );
                          next.splice(i, 1);
                          next.splice(
                            target < 0 ? next.length : target,
                            0,
                            segment,
                          );
                          replace(rebuildFromSegments(edl, next, transcript));
                        } else {
                          const source =
                            segment.src_start +
                            ((mode === "start"
                              ? snap(span.start)
                              : snap(span.end)) -
                              segment.out_start) *
                              segment.speed;
                          const key = mode === "start" ? "t0" : "t1";
                          const candidates = transcript.filter(
                            (w) =>
                              w.t0 >= edl.source.start &&
                              w.t1 <= edl.source.end,
                          );
                          const nearest = candidates.reduce(
                            (best, w) =>
                              Math.abs(w[key] - source) <
                              Math.abs(best[key] - source)
                                ? w
                                : best,
                            candidates[0],
                          );
                          if (!nearest) return;
                          const next = edl.segments.map((s, j) =>
                            j === i
                              ? {
                                  ...s,
                                  ...(mode === "start"
                                    ? {
                                        src_start: Math.min(
                                          nearest.t0,
                                          s.src_end - 0.05,
                                        ),
                                      }
                                    : {
                                        src_end: Math.max(
                                          nearest.t1,
                                          s.src_start + 0.05,
                                        ),
                                      }),
                                }
                              : s,
                          );
                          replace(rebuildFromSegments(edl, next, transcript));
                        }
                        return;
                      }
                      edit((d) => {
                        const start = snap(span.start),
                          end = Math.max(
                            start + 1 / config.fps,
                            Math.min(duration, snap(span.end)),
                          );
                        if (track.label === "Efeitos") {
                          d.effects[i].t0 = start;
                          d.effects[i].t1 = end;
                        }
                        if (track.label === "Legendas") {
                          d.captions.words[i].t0 = start;
                          d.captions.words[i].t1 = end;
                        }
                        if (track.label === "Música") {
                          d.audio.music[i].t0 = start;
                          d.audio.music[i].t1 = end;
                        }
                        if (track.label === "SFX") d.audio.sfx[i].t = start;
                        if (track.label === "Texto")
                          d.structure.hook.end = Math.max(
                            0.1,
                            Math.min(3, end),
                          );
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      {busy && (
        <div className="busy-toast" role="status">
          <LoaderCircle className="spin" size={16} />
          Preparando…
        </div>
      )}
      {proposal && (
        <Modal titleId="proposal-title" onClose={()=>setProposal(null)}>
          <section
            aria-labelledby="proposal-title"
            className="proposal-dialog"
          >
            <h2 id="proposal-title">Revisar proposta de IA</h2>
            <div className="proposal-comparison">
              <div>
                <h3>Atual</h3>
                <p>
                  {duration.toFixed(2)} s · {edl.segments.length} blocos ·{" "}
                  {edl.effects.length} efeitos
                </p>
                <pre>{JSON.stringify(edl.structure, null, 2)}</pre>
              </div>
              <div>
                <h3>Proposta</h3>
                <p>
                  {proposal.duration_out.toFixed(2)} s ·{" "}
                  {proposal.segments.length} blocos · {proposal.effects.length}{" "}
                  efeitos
                </p>
                <pre>{JSON.stringify(proposal.structure, null, 2)}</pre>
              </div>
            </div>
            <details open><summary>Alterações por campo ({diffEdl(edl,proposal).length})</summary><div className="diff-table">{diffEdl(edl,proposal).map((change,i)=><div key={i}><code>{change.path}</code><del>{JSON.stringify(change.before)??'Ausente'}</del><ins>{JSON.stringify(change.after)??'Removido'}</ins></div>)}</div></details>
            <p>
              QA:{" "}
              {proposal.qa.violations.map((v) => v.message).join(" · ") ||
                "Aprovado"}
            </p>
            <div className="inline-actions">
              <Button
                onClick={() => {
                  replace(proposal);
                  setProposal(null);
                }}
              >
                <Check size={16} />
                Aceitar proposta
              </Button>
              <Button variant="outline" onClick={() => setProposal(null)}>
                <X size={16} />
                Descartar
              </Button>
            </div>
          </section>
        </Modal>
      )}
      {showDetails && (
        <Modal titleId="analysis-title" onClose={()=>setShowDetails(false)}>
          <section
            aria-labelledby="analysis-title"
            className="proposal-dialog"
          >
            <div className="section-heading">
              <h2 id="analysis-title">Por que este corte?</h2>
              <Button
                variant="ghost"
                onClick={() => setShowDetails(false)}
                aria-label="Fechar análise"
              >
                <X size={20} />
              </Button>
            </div>
            <div className="score-list">
              {(
                [
                  "hook",
                  "tension",
                  "payoff",
                  "self_contained",
                  "density",
                  "emotion",
                ] as const
              ).map((criterion, i) => (
                <div key={criterion}>
                  <strong>
                    {
                      [
                        "Gancho",
                        "Tensão",
                        "Payoff",
                        "Autocontido",
                        "Ritmo",
                        "Emoção",
                      ][i]
                    }{" "}
                    <span className="accent">
                      {edl.scores[criterion]}/{[25, 25, 20, 15, 10, 5][i]}
                    </span>
                  </strong>
                  <p>
                    {edl.scores.rationale[criterion] ||
                      "Justificativa não fornecida pelo modelo."}
                  </p>
                </div>
              ))}
            </div>
            <h3>Estrutura narrativa</h3>
            <div className="structure-bar">
              <button
                style={{
                  width: (edl.structure.hook.end / duration) * 100 + "%",
                  background: "var(--accent)",
                }}
                onClick={() => seek(0)}
              >
                Hook
              </button>
              {edl.structure.beats.map((b, i) => (
                <button
                  key={i}
                  style={{ flex: 1, background: "var(--purple)" }}
                  onClick={() => seek(b.start)}
                  title={b.note}
                >
                  {({conflict:"Conflito",solution:"Solução",suspense:"Suspense"})[b.type]}
                </button>
              ))}
              <button
                style={{
                  width:
                    ((edl.structure.payoff.end - edl.structure.payoff.start) /
                      duration) *
                      100 +
                    "%",
                  background: "var(--blue)",
                }}
                onClick={() => seek(edl.structure.payoff.start)}
              >
                Payoff
              </button>
            </div>
            <h3>
              Retenção prevista{" "}
              <span className="pill">Estimativa heurística</span>
            </h3>
            <svg
              viewBox="0 0 600 130"
              className="retention-chart"
              role="img"
              aria-label="Curva estimada de retenção"
            >
              <path d="M0 120H600M0 60H600" stroke="var(--border)" />
              <polyline
                points={edl.retention_forecast.curve
                  .map((p) => `${(p.t / duration) * 600},${120 - p.pct * 1.1}`)
                  .join(" ")}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
              />
              {edl.retention_forecast.risk_points.map((risk, i) => (
                <circle
                  key={i}
                  cx={(risk.t / duration) * 600}
                  cy={70}
                  r="6"
                  fill="var(--warning)"
                  onClick={() => seek(risk.t)}
                >
                  <title>{risk.why}</title>
                </circle>
              ))}
            </svg>
            {edl.retention_forecast.risk_points.map((risk, i) => (
              <button
                className="risk-point"
                key={i}
                onClick={() => {
                  seek(risk.t);
                  setShowDetails(false);
                }}
              >
                {time(risk.t)} · {risk.why}
              </button>
            ))}
            <h3>QA e correções</h3>
            {edl.qa.violations.map((v, i) => (
              <p key={i} className={v.auto_fixed ? "accent" : "warning"}>
                {v.auto_fixed ? "Corrigido automaticamente" : "Revisar"} ·{" "}
                {v.message}
              </p>
            ))}
            {!edl.qa.violations.length && (
              <p className="accent">Validadores determinísticos aprovados.</p>
            )}
            <Button
              variant="outline"
              onClick={() =>
                navigator.clipboard.writeText(
                  edl.structure.hook.text_overlay_options[
                    edl.structure.hook.chosen_overlay
                  ],
                )
              }
            >
              <Copy size={16} />
              Copiar título sugerido
            </Button>
          </section>
        </Modal>
      )}
    </div>
  );
}
function ShieldNote() {
  return (
    <p className="muted small">
      O original é preservado. As alterações modificam apenas a montagem JSON.
      Legendas editadas passam novamente pelo QA.
    </p>
  );
}

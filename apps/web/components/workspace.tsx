"use client";
import { useEffect, useState } from "react";
import {
  Scissors,
  LayoutGrid,
  FolderOpen,
  AudioLines,
  Palette,
  Settings,
  Plus,
  ArrowUpRight,
  Upload,
  Film,
  ChevronRight,
  Sun,
  Moon,
  Check,
  LoaderCircle,
  X,
  RefreshCw,
  Download,
  Copy,
  Play,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  api,
  post,
  time,
  type Project,
  type Clip,
  type Job,
  type Render,
} from "../lib/client";
import { Editor } from "./editor";
import { config, type EDL } from "../../../packages/edl";
type Screen = "projects" | "new" | "project" | "assets" | "brand" | "settings";
const status: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  ready: "Pronto",
  failed: "Falhou",
  cancelled: "Cancelado",
  review: "Revisar",
  running: "Em andamento",
  complete: "Concluído",
};
const stages = [
  "ingest",
  "probe",
  "audio",
  "transcribe",
  "analyze",
  "select",
  "plan",
  "reframe",
  "render_preview",
  "complete",
];
const stageLabels = [
  "Recebimento",
  "Verificação",
  "Áudio e proxy",
  "Transcrição",
  "Análise visual",
  "Seleção por IA",
  "Plano de edição",
  "Enquadramento",
  "Pré-visualizações",
  "Concluído",
];
export function Workspace() {
  const [screen, setScreen] = useState<Screen>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [current, setCurrent] = useState<Project | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [renders, setRenders] = useState<Render[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(true);
  const [loading, setLoading] = useState(true);
  function refresh() {
    return api<Project[]>("projects")
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    refresh();
    setDark(localStorage.getItem("theme") !== "light");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!current) return;
    const events = new EventSource("/api/projects/" + current.id + "/events");
    events.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setError("");
      setCurrent(data.project);
      setJobs(data.jobs);
      setClips(data.clips);
      setRenders(data.renders);
    };
    events.onerror = () =>
      setError(
        "Conexão de progresso interrompida. Reconectando automaticamente.",
      );
    return () => events.close();
  }, [current?.id]);
  function open(project: Project) {
    setCurrent(project);
    setScreen("project");
    setClips([]);
    setJobs([]);
    setRenders([]);
  }
  async function run(action: () => Promise<unknown>) {
    try {
      setError("");
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha inesperada.");
    }
  }
  const processingJob = jobs.filter((j) => j.type === "project.process").at(-1);
  const navigation = [
    { id: "projects", icon: LayoutGrid, label: "Projetos" },
    { id: "assets", icon: AudioLines, label: "Biblioteca de assets" },
    { id: "brand", icon: Palette, label: "Brand kits" },
    { id: "settings", icon: Settings, label: "Configurações" },
  ] as const;
  if (editing)
    return (
      <Editor
        clipId={editing}
        onBack={() => {
          setEditing(null);
          refresh();
        }}
      />
    );
  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="logo" href="/" aria-label="ClipForge início">
          <span className="logo-icon">
            <Scissors size={23} />
          </span>
          clipforge<span className="logo-dot">.</span>
        </a>
        <span className="workspace-label">SEU ESTÚDIO LOCAL</span>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={
                "nav-item " +
                (screen === id ||
                (id === "projects" && ["new", "project"].includes(screen))
                  ? "active"
                  : "")
              }
              onClick={() => {
                setScreen(id);
                if (id === "projects") refresh();
              }}
            >
              <Icon size={19} />
              {label}
              {id === "projects" && (
                <span className="nav-count">{projects.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={20} />
          <strong>Seu conteúdo, seu controle.</strong>
          <p>
            Vídeos armazenados neste computador. Você decide quando usar IA
            externa.
          </p>
          <span className="local-indicator">
            <i /> Armazenamento local
          </span>
        </div>
        <button className="theme-control" onClick={() => setDark(!dark)}>
          {dark ? <Sun size={17} /> : <Moon size={17} />}Tema{" "}
          {dark ? "claro" : "escuro"}
        </button>
        <div className="profile">
          <div className="avatar">EU</div>
          <div>
            <strong>Meu workspace</strong>
            <small>Protótipo local</small>
          </div>
          <span className="version">v0.1</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="muted">Workspace</span>
            <ChevronRight size={14} />
            <span>
              {screen === "project"
                ? current?.title
                : navigation.find((n) => n.id === screen)?.label ||
                  "Novo projeto"}
            </span>
          </div>
          <span className="local-indicator">
            <i /> Rodando localmente
          </span>
        </header>
        <main>
          {error && (
            <div className="alert" role="alert">
              {error}
              <button aria-label="Fechar aviso" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {screen === "projects" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">DA IDEIA AO PRÓXIMO PLAY</div>
                  <h1>
                    Seus projetos<span className="accent">.</span>
                  </h1>
                  <p>Histórias longas. Cortes que fazem ficar até o final.</p>
                </div>
                <Button onClick={() => setScreen("new")}>
                  <Plus size={18} />
                  Novo projeto
                </Button>
              </div>
              <div className="stats-grid">
                <div className="stat">
                  <span>
                    Projetos no estúdio
                    <FolderOpen size={18} />
                  </span>
                  <strong>{projects.length.toString().padStart(2, "0")}</strong>
                  <small>Todos os seus vídeos em um lugar</small>
                </div>
                <div className="stat">
                  <span>
                    Prontos para editar
                    <Scissors size={18} />
                  </span>
                  <strong>
                    {projects
                      .filter((p) => p.status === "ready")
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                  <small>Narrativas selecionadas e organizadas</small>
                </div>
                <div className="stat">
                  <span>
                    Em processamento
                    <Activity size={18} />
                  </span>
                  <strong>
                    {projects
                      .filter((p) =>
                        ["processing", "queued"].includes(p.status),
                      )
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                  <small>A IA encontra as melhores histórias</small>
                </div>
              </div>
              <div className="section-heading">
                <h2>
                  Todos os projetos{" "}
                  <span className="pill">{projects.length}</span>
                </h2>
                <span className="muted">Mais recentes primeiro</span>
              </div>
              {loading ? (
                <div className="empty">
                  <LoaderCircle className="spin" />
                  Carregando projetos…
                </div>
              ) : projects.length ? (
                <div className="project-grid">
                  {projects.map((project) => (
                    <button
                      className="project-card"
                      key={project.id}
                      onClick={() => open(project)}
                    >
                      <div className="project-cover">
                        <Film size={44} />
                        <span className="mode-pill">{project.mode}</span>
                        <span className={"status-badge " + project.status}>
                          {status[project.status]}
                        </span>
                      </div>
                      <div className="project-info">
                        <h3>
                          {project.title}
                          <ArrowUpRight size={18} />
                        </h3>
                        <p>
                          {new Date(project.createdAt).toLocaleDateString(
                            "pt-BR",
                          )}{" "}
                          <span>•</span>{" "}
                          {project.sourceMetaJson
                            ? time(JSON.parse(project.sourceMetaJson).duration)
                            : "Aguardando análise"}
                        </p>
                      </div>
                    </button>
                  ))}
                  <button className="new-card" onClick={() => setScreen("new")}>
                    <span>
                      <Plus size={25} />
                    </span>
                    <strong>Criar um novo projeto</strong>
                    <small>Sua próxima boa história começa aqui</small>
                  </button>
                </div>
              ) : (
                <div className="empty-start">
                  <div className="empty-visual">
                    <span className="film-line" />
                    <Scissors size={44} />
                    <span className="film-line" />
                  </div>
                  <span className="eyebrow">
                    UM VÍDEO. VÁRIAS BOAS HISTÓRIAS.
                  </span>
                  <h2>Seu primeiro corte começa aqui</h2>
                  <p>
                    Envie um podcast, aula ou entrevista. Encontre os melhores
                    momentos e edite cada detalhe em um só lugar.
                  </p>
                  <Button onClick={() => setScreen("new")}>
                    <Upload size={18} />
                    Enviar meu primeiro vídeo
                    <ArrowUpRight size={17} />
                  </Button>
                  <div className="format-label">
                    MP4, MOV, WebM ou MKV · Até 4 GB
                  </div>
                </div>
              )}
              <div className="workflow-strip">
                <div>
                  <span>01</span>
                  <strong>Envie seu vídeo</strong>
                  <p>O arquivo original fica no seu computador.</p>
                </div>
                <ChevronRight />
                <div>
                  <span>02</span>
                  <strong>Encontre a narrativa</strong>
                  <p>Gancho, tensão e recompensa. Com justificativa.</p>
                </div>
                <ChevronRight />
                <div>
                  <span>03</span>
                  <strong>Deixe com a sua cara</strong>
                  <p>Edite, compare e exporte em vertical.</p>
                </div>
              </div>
            </>
          )}
          {screen === "new" && (
            <NewProject
              onCreated={async (id) => {
                await refresh();
                const data = await api<{ project: Project }>("projects/" + id);
                open(data.project);
              }}
              onError={setError}
            />
          )}
          {screen === "project" && current && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    PROJETO · {current.mode.toUpperCase()}
                  </div>
                  <h1>{current.title}</h1>
                  <p>
                    Seleção transparente, edição livre e controle do começo ao
                    fim.
                  </p>
                </div>
                <div className="inline-actions">
                  <span className={"status-badge " + current.status}>
                    {status[current.status]}
                  </span>
                  {["processing", "queued"].includes(current.status) ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        run(() =>
                          api("projects/" + current.id + "/cancel", post({})),
                        )
                      }
                    >
                      <X size={16} />
                      Cancelar
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() =>
                        run(() =>
                          api("projects/" + current.id + "/retry", post({})),
                        )
                      }
                    >
                      <RefreshCw size={16} />
                      Reprocessar
                    </Button>
                  )}
                </div>
              </div>
              {jobs.filter((j) => j.type === "project.process").length > 0 && (
                <div className="panel processing">
                  <div className="section-heading">
                    <h2>Processamento</h2>
                    <strong className="accent">
                      {Math.round(processingJob?.progress || 0)}%
                    </strong>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{ width: (processingJob?.progress || 0) + "%" }}
                    />
                  </div>
                  <div className="steps">
                    {stages.map((stage, i) => {
                      const active = stages.indexOf(processingJob?.stage || "");
                      return (
                        <div
                          key={stage}
                          className={
                            i < active ? "done" : i === active ? "current" : ""
                          }
                        >
                          <span>
                            {i < active ? (
                              <Check size={12} />
                            ) : (
                              String(i + 1).padStart(2, "0")
                            )}
                          </span>
                          {stageLabels[i]}
                        </div>
                      );
                    })}
                  </div>
                  {processingJob?.error && (
                    <p role="alert" className="error-text">
                      {processingJob.error}
                    </p>
                  )}
                  <details>
                    <summary>Diagnóstico e logs por etapa</summary>
                    <pre>{jobs.map((j) => j.logJson).join("\n")}</pre>
                  </details>
                </div>
              )}
              <div className="section-heading">
                <h2>
                  Cortes selecionados{" "}
                  <span className="pill">{clips.length}</span>
                </h2>
                <span className="muted">
                  Notas explicadas. Retenção estimada.
                </span>
              </div>
              {!clips.length ? (
                <div className="empty">
                  <Scissors size={30} />
                  <h3>Seus cortes aparecerão aqui</h3>
                  <p>
                    Acompanhe as etapas acima. Em caso de falha, corrija a
                    configuração indicada e reprocese.
                  </p>
                </div>
              ) : (
                <div className="clip-grid">
                  {clips.map((clip) => {
                    const edl = JSON.parse(clip.edlJson) as EDL;
                    return (
                      <article className="clip-card" key={clip.id}>
                        <div className="clip-cover">
                          {clip.previewPath ? (
                            <video
                              controls
                              preload="metadata"
                              src={"/api/media/" + clip.previewPath}
                            />
                          ) : (
                            <div className="clip-placeholder">
                              <Film size={35} />
                              <span>Preview disponível no editor</span>
                            </div>
                          )}
                          <span className="clip-rank">
                            CORTE {String(clip.rank).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="clip-info">
                          <span className="clip-score">
                            {edl.scores.total}
                            <small>/100</small>
                          </span>
                          <h3>
                            {
                              edl.structure.hook.text_overlay_options[
                                edl.structure.hook.chosen_overlay
                              ]
                            }
                          </h3>
                          <p>
                            {time(edl.duration_out)} ·{" "}
                            {edl.structure.hook.technique === "cold_open"
                              ? "Cold open"
                              : "Gancho nativo"}{" "}
                            ·{" "}
                            {edl.qa.passed
                              ? "QA aprovado"
                              : "Revisão necessária"}
                          </p>
                          <div className="inline-actions">
                            <Button
                              size="sm"
                              onClick={() => setEditing(clip.id)}
                            >
                              Editar corte
                              <ArrowUpRight size={15} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Duplicar com outro texto de gancho"
                              onClick={() =>
                                run(() =>
                                  api(
                                    "clips/" + clip.id + "/duplicate",
                                    post({}),
                                  ),
                                )
                              }
                            >
                              <Copy size={16} />
                              A/B
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {renders.length > 0 && (
                <section className="panel">
                  <h2>Exportações</h2>
                  {renders.map((r) => (
                    <div className="export-row" key={r.id}>
                      <span>
                        {r.preset} · {status[r.status]} {Math.round(r.progress)}
                        %
                      </span>
                      {r.path ? (
                        <a download href={"/api/media/" + r.path}>
                          <Download size={16} />
                          Baixar vídeo
                        </a>
                      ) : r.error ? (
                        <span role="alert">{r.error}</span>
                      ) : (
                        <LoaderCircle className="spin" size={17} />
                      )}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {screen === "assets" && <Library onError={setError} />}
          {screen === "brand" && <BrandKits onError={setError} />}
          {screen === "settings" && <SettingsPanel />}
        </main>
        <footer>
          Feito para histórias que merecem ser vistas.
          <span>ClipForge · Estúdio de cortes verticais</span>
        </footer>
      </div>
    </div>
  );
}
async function upload(file: File, onProgress: (p: number) => void) {
  const cacheKey =
    "upload:" + file.name + ":" + file.size + ":" + file.lastModified;
  let id = localStorage.getItem(cacheKey);
  let received: number[] = [];
  if (id) {
    try {
      received = (await api<{ received: number[] }>("uploads/" + id)).received;
    } catch {
      id = null;
    }
  }
  if (!id) {
    id = (
      await api<{ id: string }>(
        "uploads",
        post({
          name: file.name,
          size: file.size,
          type: file.type || "video/mp4",
        }),
      )
    ).id;
    localStorage.setItem(cacheKey, id);
  }
  const count = Math.ceil(file.size / config.chunkBytes);
  for (let i = 0; i < count; i++) {
    if (!received.includes(i))
      await api("uploads/" + id + "/" + i, {
        method: "PUT",
        body: file.slice(i * config.chunkBytes, (i + 1) * config.chunkBytes),
      });
    onProgress(((i + 1) / count) * 100);
  }
  const result = await api<{ source: string }>(
    "uploads/" + id + "/complete",
    post({}),
  );
  localStorage.removeItem(cacheKey);
  return result.source;
}
function NewProject({
  onCreated,
  onError,
}: {
  onCreated: (id: string) => void;
  onError: (error: string) => void;
}) {
  const [sourceMode, setSourceMode] = useState("upload");
  const [sourceUrl, setSourceUrl] = useState("");
  const [ownUrl, setOwnUrl] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("viral");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rights, setRights] = useState(false);
  const [count, setCount] = useState(5);
  const [language, setLanguage] = useState("auto");
  const [context, setContext] = useState("");
  const [kits, setKits] = useState<{ id: string; name: string }[]>([]);
  const [brandKit, setBrandKit] = useState("");
  useEffect(() => {
    api<typeof kits>("brand-kits")
      .then(setKits)
      .catch((e) => onError(e.message));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !rights ||
      (sourceMode === "upload" && !file) ||
      (sourceMode === "url" && (!sourceUrl || !ownUrl))
    )
      return;
    setBusy(true);
    try {
      const source =
        sourceMode === "upload" ? await upload(file!, setProgress) : sourceUrl;
      const result = await api<{ id: string }>(
        "projects",
        post({
          title,
          source,
          ownUrl: sourceMode === "url" && ownUrl,
          rights,
          mode,
          count,
          language,
          context,
          brandKit,
        }),
      );
      onCreated(result.id);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erro ao enviar vídeo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">VAMOS ENCONTRAR SUAS HISTÓRIAS</div>
          <h1>
            Novo projeto<span className="accent">.</span>
          </h1>
          <p>Comece com o original. A edição vem depois.</p>
        </div>
      </div>
      <form className="new-project-form" onSubmit={submit}>
        <div className="panel">
          <h2>
            01 <span>Seu vídeo</span>
          </h2>
          <div className="inline-actions" style={{ marginBottom: 18 }}>
            <Button
              type="button"
              variant={sourceMode === "upload" ? "default" : "outline"}
              onClick={() => setSourceMode("upload")}
            >
              Enviar arquivo
            </Button>
            <Button
              type="button"
              variant={sourceMode === "url" ? "default" : "outline"}
              onClick={() => setSourceMode("url")}
            >
              Link do YouTube
            </Button>
          </div>
          {sourceMode === "upload" ? (
            <label className="upload-zone">
              <Upload size={30} />
              <strong>
                {file ? file.name : "Escolha um vídeo para começar"}
              </strong>
              <span>
                {file
                  ? (file.size / 1024 ** 2).toFixed(1) + " MB"
                  : "Arraste para o seletor ou clique para escolher · Até 4 GB"}
              </span>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                required
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setTitle(f.name.replace(/\.[^.]+$/, ""));
                  }
                }}
              />
            </label>
          ) : (
            <div>
              <label>
                URL do vídeo
                <input
                  type="url"
                  required
                  value={sourceUrl}
                  onChange={(e) => {
                    setSourceUrl(e.target.value);
                    if (!title) setTitle("Meu projeto do YouTube");
                  }}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={ownUrl}
                  onChange={(e) => setOwnUrl(e.target.checked)}
                />
                Confirmo que esta fonte é minha ou está autorizada para meu uso.
              </label>
              <p className="muted small">
                Somente vídeos públicos autorizados. Se a fonte restringir o
                download, envie o arquivo local.
              </p>
            </div>
          )}
          <label>
            Nome do projeto
            <input
              required
              value={title}
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Conversas sobre criatividade"
            />
          </label>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              O vídeo permanece local. A transcrição será enviada ao provedor
              configurado para seleção por IA. Downloads de URL exigem
              autorização sobre a fonte.
            </span>
          </div>
        </div>
        <div className="panel">
          <h2>
            02 <span>Direção dos cortes</span>
          </h2>
          <fieldset>
            <legend>Qual é o seu objetivo?</legend>
            <div className="mode-options">
              {[
                {
                  id: "viral",
                  name: "Viral",
                  duration: "12–25 segundos",
                  detail: "Direto ao ponto. Mais alcance.",
                },
                {
                  id: "balanced",
                  name: "Equilibrado",
                  duration: "20–40 segundos",
                  detail: "História com o contexto certo.",
                },
                {
                  id: "authority",
                  name: "Autoridade",
                  duration: "40–75 segundos",
                  detail: "Espaço para aprofundar.",
                },
              ].map((m) => (
                <label
                  key={m.id}
                  className={"mode-option " + (mode === m.id ? "selected" : "")}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m.id}
                    checked={mode === m.id}
                    onChange={() => setMode(m.id)}
                  />
                  <strong>{m.name}</strong>
                  <span>{m.duration}</span>
                  <small>{m.detail}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-grid">
            <label>
              Número de cortes
              <input
                type="number"
                min={1}
                max={15}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label>
              Idioma
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="auto">Detectar automaticamente</option>
                <option value="pt">Português</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
            </label>
            <label>
              Brand kit
              <select
                value={brandKit}
                onChange={(e) => setBrandKit(e.target.value)}
              >
                <option value="">Estilo padrão</option>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Nicho e tom <span className="muted">opcional</span>
            <textarea
              value={context}
              maxLength={2000}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Ex.: Educação financeira, tom didático, público iniciante."
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            required
            type="checkbox"
            checked={rights}
            onChange={(e) => setRights(e.target.checked)}
          />
          Declaro que tenho os direitos ou licença para usar este conteúdo.
        </label>
        {busy && (
          <div aria-live="polite">
            Enviando arquivo… {Math.round(progress)}%
            <progress value={progress} max={100} />
          </div>
        )}
        <Button
          disabled={
            busy ||
            !rights ||
            (sourceMode === "upload" ? !file : !sourceUrl || !ownUrl)
          }
          type="submit"
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Scissors size={17} />
          )}
          Encontrar meus cortes
          <ArrowUpRight size={16} />
        </Button>
      </form>
    </>
  );
}
function Library({ onError }: { onError: (s: string) => void }) {
  const [items, setItems] = useState<
    {
      id: string;
      name: string;
      type: string;
      license: string;
      sourceUrl: string;
      mood: string;
      bpm: number;
    }[]
  >([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState("music");
  async function refresh() {
    setItems(await api("assets"));
  }
  useEffect(() => {
    refresh().catch((e) => onError(e.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECURSOS COM ORIGEM</div>
          <h1>Biblioteca de assets</h1>
          <p>
            A licença faz parte do asset. Cadastre apenas conteúdo autorizado.
          </p>
        </div>
      </div>
      <input
        aria-label="Filtrar biblioteca"
        placeholder="Buscar por nome, mood ou BPM"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="asset-grid">
        {items
          .filter((a) =>
            [a.name, a.mood, String(a.bpm)]
              .join(" ")
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map((a) => (
            <article className="panel" key={a.id}>
              <AudioLines />
              <h3>{a.name}</h3>
              <p>
                {a.type} · {a.mood} · {a.bpm || "—"} BPM
              </p>
              <small>{a.license}</small>
              <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                Fonte e licença
                <ArrowUpRight size={14} />
              </a>
            </article>
          ))}
      </div>
      {!items.length && (
        <div className="empty">
          <AudioLines size={32} />
          <h3>Sua biblioteca começa com fontes confiáveis</h3>
          <p>Nenhuma faixa incluída. Cadastre mídia com licença registrada.</p>
        </div>
      )}
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!file) return;
          setBusy(true);
          try {
            const form = new FormData(e.currentTarget);
            const path = await upload(file, () => {});
            await api(
              "assets",
              post({
                name: form.get("name"),
                type: kind,
                license: form.get("license"),
                sourceUrl: form.get("sourceUrl"),
                mood: form.get("mood"),
                bpm: Number(form.get("bpm")) || undefined,
                path,
              }),
            );
            await refresh();
          } catch (e) {
            onError(
              e instanceof Error ? e.message : "Erro ao cadastrar asset.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Adicionar asset</h2>
        <div className="form-grid">
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="music">Música</option>
              <option value="sfx">SFX</option>
              <option value="sticker">Imagem / sticker</option>
              <option value="brand">Vídeo de apoio</option>
            </select>
          </label>
          <label>
            Arquivo
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,video/mp4,image/png,image/jpeg,image/webp"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            Licença
            <input name="license" required placeholder="Ex.: CC0 1.0" />
          </label>
          <label>
            URL da fonte
            <input name="sourceUrl" type="url" required />
          </label>
          <label>
            Mood
            <input name="mood" />
          </label>
          <label>
            BPM
            <input name="bpm" type="number" min="1" />
          </label>
        </div>
        <p className="muted">
          Formatos aceitos: MP3, WAV, OGG, MP4, PNG, JPEG e WebP. Use uma fonte
          com licença compatível com o seu uso.
        </p>
        <Button disabled={busy}>Cadastrar asset</Button>
      </form>
    </>
  );
}
function BrandKits({ onError }: { onError: (s: string) => void }) {
  const [kits, setKits] = useState<
    { id: string; name: string; colorsJson: string; captionStyleJson: string }[]
  >([]);
  useEffect(() => {
    api<typeof kits>("brand-kits")
      .then(setKits)
      .catch((e) => onError(e.message));
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">IDENTIDADE CONSISTENTE</div>
          <h1>Brand kits</h1>
          <p>Cor e estilo de legenda para os seus projetos.</p>
        </div>
      </div>
      <div className="asset-grid">
        {kits.map((k) => (
          <div className="panel" key={k.id}>
            <Palette />
            <h3>{k.name}</h3>
            <p>{k.captionStyleJson}</p>
          </div>
        ))}
      </div>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          try {
            await api(
              "brand-kits",
              post({
                name: data.get("name"),
                colorsJson: JSON.stringify([data.get("color")]),
                captionStyleJson: JSON.stringify({
                  style: data.get("style"),
                  activeColor: data.get("color"),
                }),
              }),
            );
            setKits(await api("brand-kits"));
          } catch (e) {
            onError(e instanceof Error ? e.message : "Falha ao salvar.");
          }
        }}
      >
        <h2>Criar brand kit</h2>
        <div className="form-grid">
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            Cor de destaque
            <input type="color" name="color" defaultValue="#b7fc70" />
          </label>
          <label>
            Legenda
            <select name="style">
              <option value="ativa">Palavra ativa</option>
              <option value="limpo">Limpo</option>
              <option value="caixa">Caixa</option>
              <option value="contorno">Contorno</option>
            </select>
          </label>
        </div>
        <Button>Salvar brand kit</Button>
      </form>
    </>
  );
}
function SettingsPanel() {
  const [health, setHealth] = useState<{
    llmConfigured: boolean;
    llmEnabled: boolean;
    model: string;
    privacy: string;
  } | null>(null);
  useEffect(() => {
    api<typeof health>("health").then(setHealth);
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SEU AMBIENTE</div>
          <h1>Configurações</h1>
          <p>Configurações sensíveis ficam no arquivo .env do servidor.</p>
        </div>
      </div>
      <div className="panel settings">
        <h2>IA de decisão</h2>
        <div>
          <span>Provedor de IA</span>
          <strong>
            {health?.llmConfigured
              ? "Chave configurada"
              : "Chave não configurada"}
          </strong>
        </div>
        <div>
          <span>Modelo</span>
          <code>{health?.model || "Carregando…"}</code>
        </div>
        <div>
          <span>Envio para IA</span>
          <strong>{health?.llmEnabled ? "Habilitado" : "Desativado"}</strong>
        </div>
        <p>
          Edite LLM_PROVIDER, a chave do provedor, LLM_MODEL e LLM_ENABLED no
          .env e reinicie make dev. A chave nunca é devolvida ao navegador.
        </p>
      </div>
      <div className="panel settings">
        <h2>Processamento local</h2>
        <div>
          <span>Fila</span>
          <strong>SQLite · um processo local</strong>
        </div>
        <div>
          <span>Armazenamento</span>
          <code>STORAGE_DIR · storage/</code>
        </div>
        <div>
          <span>Concorrência de render</span>
          <code>RENDER_CONCURRENCY</code>
        </div>
        <p>{health?.privacy}</p>
        <p>
          Transcrição: WhisperX local (large-v3), ou provedor externo
          configurado explicitamente em TRANSCRIPTION_PROVIDER. Qualidade
          padrão: 1080 × 1920.
        </p>
      </div>
    </>
  );
}

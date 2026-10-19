import { z } from "zod";
import { Agent, fetch as fetchMedia } from "undici";
import { eq } from "drizzle-orm";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { db, schema, now } from "../../../packages/core/db";
import {
  claim,
  retryFailure,
  recoverJobs,
  progress,
  isCancelled,
  type Task,
} from "../../../packages/core/queue";
import { safePath, storage } from "../../../packages/core/storage";
import { selectClips } from "../../../packages/core/llm";
import {
  edlSchema,
  validateEdl,
  type Word,
  type EDL,
  type CatalogAsset,
} from "../../../packages/edl";
import { effectCatalog } from "../../../packages/composition/effects/catalog";
import { renderClip } from "./render";
const mediaDispatcher = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  connectTimeout: 10000,
});
async function media(
  endpoint: string,
  project: typeof schema.projects.$inferSelect,
) {
  const response = await fetchMedia(
    (process.env.MEDIA_WORKER_URL || "http://127.0.0.1:8000") + "/" + endpoint,
    {
      method: "POST",
      dispatcher: mediaDispatcher,
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Token":
          process.env.MEDIA_WORKER_TOKEN || "local-development-only",
      },
      body: JSON.stringify({
        source: project.sourcePath,
        project_id: project.id,
        language: project.language,
      }),
      signal: AbortSignal.timeout(7200000),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
async function fileHash(path: string) {
  const hash = createHash("sha256");
  for await (const data of createReadStream(path)) hash.update(data);
  return hash.digest("hex");
}
async function processProject(task: Task) {
  let project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, task.projectId))
    .get();
  if (!project) throw new Error("Projeto não encontrado.");
  const params = JSON.parse(project.paramsJson) as {
    count: number;
    context: string;
    brandKit?: string;
  };
  db.update(schema.projects)
    .set({ status: "processing" })
    .where(eq(schema.projects.id, project.id))
    .run();
  const step = (stage: string, value: number, message: string) =>
    progress(task.id, stage, value, message);
  step("ingest", 2, "Arquivo local recebido e direitos registrados.");
  if (/^https:/.test(project.sourcePath)) {
    step("ingest", 3, "Baixando fonte autorizada do YouTube.");
    const imported = z
      .object({ source: z.string() })
      .parse(await media("ingest-url", project));
    db.update(schema.projects)
      .set({ sourcePath: imported.source })
      .where(eq(schema.projects.id, project.id))
      .run();
    project = { ...project, sourcePath: imported.source };
  }
  const hash = await fileHash(safePath(project.sourcePath));
  step("probe", 8, "Verificando integridade do vídeo.");
  const meta = z
    .object({
      duration: z.number().positive(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      fps: z.number().positive(),
      codec: z.string(),
      has_audio: z.literal(true),
    })
    .parse(await media("probe", project));
  db.update(schema.projects)
    .set({ sourceMetaJson: JSON.stringify({ ...meta, hash }) })
    .where(eq(schema.projects.id, project.id))
    .run();
  step("audio", 15, "Criando proxy 720p e extraindo áudio.");
  await media("prepare", project);
  step(
    "transcribe",
    25,
    "Transcrevendo e alinhando palavras. A primeira execução pode baixar os modelos.",
  );
  const transcript = (await media("transcribe", project)) as {
    words: Word[];
    language: string;
    diarized: boolean;
  };
  db.insert(schema.transcripts)
    .values({
      projectId: project.id,
      jsonPath: "projects/" + project.id + "/transcript.json",
      language: transcript.language,
      diarized: transcript.diarized ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: schema.transcripts.projectId,
      set: { language: transcript.language },
    })
    .run();
  step("analyze", 45, "Analisando cenas, silêncios e rostos.");
  const analysis = (await media("analyze", project)) as {
    crop: EDL["reframe"]["keyframes"];
  };
  step("select", 60, "Selecionando narrativas com a skill de retenção.");
  const cache =
    "projects/" + project.id + "/selection-" + hash.slice(0, 16) + ".json";
  const assets = db.select().from(schema.assets).all();
  const activeProject = project;
  async function publishClip(edl: EDL, i: number) {
    step(
      "reframe",
      75 + (i / params.count) * 10,
      "Calculando enquadramento do corte " + (i + 1),
    );
    edl.clip_id = activeProject.id + "-" + i;
    edl.reframe.keyframes = edl.segments.flatMap((s) =>
      analysis.crop
        .filter((k) => k.t >= s.src_start && k.t <= s.src_end)
        .map((k) => ({ ...k, t: s.out_start + (k.t - s.src_start) / s.speed })),
    );
    if (!edl.reframe.keyframes.length)
      edl.reframe.keyframes = [{ t: 0, cx: 0.5, cy: 0.4, scale: 1 }];
    if (params.brandKit) {
      const kit = db
        .select()
        .from(schema.brandKits)
        .where(eq(schema.brandKits.id, params.brandKit))
        .get();
      if (kit?.captionStyleJson) {
        const style = JSON.parse(kit.captionStyleJson);
        edl.captions = { ...edl.captions, ...style };
      }
    }
    const validated = validateEdl(
      edl,
      transcript.words,
      assets,
      effectCatalog.map((e) => e.id),
      true,
    );
    const exists = db
      .select()
      .from(schema.clips)
      .where(eq(schema.clips.id, edl.clip_id))
      .get();
    if (exists?.previewPath) return;
    if (!exists) {
      db.insert(schema.clips)
        .values({
          id: edl.clip_id,
          projectId: activeProject.id,
          rank: i + 1,
          scoreTotal: validated.scores.total,
          scoresJson: JSON.stringify(validated.scores),
          edlJson: JSON.stringify(validated),
          status: validated.qa.passed ? "ready" : "review",
          skillHash: activeProject.skillHash,
          llmTraceJson: JSON.stringify({
            selection: "traces/" + activeProject.id + "-selection.json",
          }),
          createdAt: now(),
          updatedAt: now(),
        })
        .run();
      db.insert(schema.versions)
        .values({
          id: crypto.randomUUID(),
          clipId: edl.clip_id,
          edlJson: JSON.stringify(validated),
          label: "Seleção original",
          createdAt: now(),
        })
        .run();
    }
    step(
      "render_preview",
      85 + (i / params.count) * 14,
      "Renderizando preview " + (i + 1) + " de " + params.count,
    );
    try {
      const output = await renderClip(
        exists ? edlSchema.parse(JSON.parse(exists.edlJson)) : validated,
        "projects/" + activeProject.id + "/proxy.mp4",
        assets,
        "projects/" + activeProject.id + "/preview-" + i + ".mp4",
        "draft",
        () => {},
        () => isCancelled(task.id),
        {
          voice: `projects/${activeProject.id}/voice.wav`,
          clean: `projects/${activeProject.id}/voice-clean.wav`,
        },
      );
      db.update(schema.clips)
        .set({ previewPath: output.path })
        .where(eq(schema.clips.id, edl.clip_id))
        .run();
    } catch (error) {
      if (isCancelled(task.id)) throw error;
      console.error(
        JSON.stringify({ clip_id: edl.clip_id, error: String(error) }),
      );
    }
  }
  let selected: EDL[];
  try {
    selected = JSON.parse(await readFile(safePath(cache), "utf8")).map(
      (e: unknown) => edlSchema.parse(e),
    );
  } catch {
    const controller = new AbortController();
    const cancellation = setInterval(() => {
      if (stopping || isCancelled(task.id)) controller.abort();
    }, 500);
    try {
      selected = await selectClips(
        project.id,
        transcript.words,
        project.mode as EDL["mode"],
        params.count,
        db.select().from(schema.assets).all(),
        params.context,
        {
          signal: controller.signal,
          onClip: async (edl, index) => {
            await publishClip(edl, index);
            step(
              "select",
              60 + Math.min(10, (index + 1) * 2),
              "Corte " +
                (index + 1) +
                " aprovado e pré-visualização disponível. Selecionando os próximos.",
            );
          },
        },
      );
    } finally {
      clearInterval(cancellation);
    }
    await storage.put(cache, Buffer.from(JSON.stringify(selected)));
  }
  if (!selected.length)
    throw new Error(
      "Nenhum candidato atingiu os mínimos de hook e payoff. Tente outro trecho ou modo.",
    );
  step("plan", 72, "Validando montagem e legendas.");
  for (let i = 0; i < selected.length; i++) await publishClip(selected[i], i);
  db.update(schema.projects)
    .set({ status: "ready" })
    .where(eq(schema.projects.id, project.id))
    .run();
  step(
    "complete",
    100,
    "Cortes disponíveis: " +
      selected.length +
      " de " +
      params.count +
      " solicitados.",
  );
}
async function processRender(task: Task) {
  const renderId = task.type.split(":")[1];
  const render = db
    .select()
    .from(schema.renders)
    .where(eq(schema.renders.id, renderId))
    .get();
  if (!render) throw new Error("Exportação não encontrada.");
  const clip = db
    .select()
    .from(schema.clips)
    .where(eq(schema.clips.id, render.clipId))
    .get()!;
  const project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, clip.projectId))
    .get()!;
  db.update(schema.renders)
    .set({ status: "running" })
    .where(eq(schema.renders.id, renderId))
    .run();
  try {
    const result = await renderClip(
      edlSchema.parse(
        JSON.parse(
          await readFile(safePath("renders/" + renderId + ".edl.json"), "utf8"),
        ),
      ),
      project.sourcePath,
      db.select().from(schema.assets).all(),
      "renders/" + renderId + ".mp4",
      render.preset,
      (p) => {
        db.update(schema.renders)
          .set({ progress: p })
          .where(eq(schema.renders.id, renderId))
          .run();
        progress(task.id, "render_final", p, "Exportando vídeo.");
      },
      () => isCancelled(task.id),
      {
        voice: `projects/${project.id}/voice.wav`,
        clean: `projects/${project.id}/voice-clean.wav`,
      },
    );
    db.update(schema.renders)
      .set({
        status: "complete",
        path: result.path,
        sizeBytes: result.size,
        progress: 100,
      })
      .where(eq(schema.renders.id, renderId))
      .run();
  } catch (e) {
    db.update(schema.renders)
      .set({ status: "failed", error: String(e) })
      .where(eq(schema.renders.id, renderId))
      .run();
    throw e;
  }
}
recoverJobs();
console.log("ClipForge worker local: fila SQLite pronta.");
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
while (!stopping) {
  const task = claim();
  if (!task) {
    await new Promise((r) => setTimeout(r, 1000));
    continue;
  }
  try {
    if (task.type === "project.process") await processProject(task);
    else if (task.type.startsWith("render:")) await processRender(task);
    else throw new Error("Tipo de tarefa desconhecido.");
    if (!isCancelled(task.id))
      db.update(schema.jobs)
        .set({ status: "complete", progress: 100, finishedAt: now() })
        .where(eq(schema.jobs.id, task.id))
        .run();
  } catch (error) {
    if (stopping && !isCancelled(task.id)) {
      db.update(schema.jobs)
        .set({ status: "queued" })
        .where(eq(schema.jobs.id, task.id))
        .run();
      break;
    }
    if (!isCancelled(task.id)) {
      if (retryFailure(task, error)) {
        if (task.type === "project.process")
          db.update(schema.projects)
            .set({ status: "queued" })
            .where(eq(schema.projects.id, task.projectId))
            .run();
        continue;
      }
      db.update(schema.jobs)
        .set({ status: "failed", error: String(error), finishedAt: now() })
        .where(eq(schema.jobs.id, task.id))
        .run();
      if (task.type === "project.process")
        db.update(schema.projects)
          .set({ status: "failed" })
          .where(eq(schema.projects.id, task.projectId))
          .run();
    }
    console.error(
      JSON.stringify({
        job_id: task.id,
        project_id: task.projectId,
        error: String(error),
      }),
    );
  }
}

await mediaDispatcher.close();

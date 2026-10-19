import {correctTranscript,correctionSchema} from "../../../packages/edl/transcript";
import {canonicalYoutubeUrl} from "../../../packages/core/source-url";
import {llmSettings} from "../../../packages/core/llm-provider";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { readFile, stat, mkdir, open, readdir, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { db, schema, now } from "../../../packages/core/db";
import {
  safePath,
  storage,
  combineChunks,
} from "../../../packages/core/storage";
import { enqueue, cancelProject } from "../../../packages/core/queue";
import { skill, structured } from "../../../packages/core/llm";
import {
  config,
  edlSchema,
  validateEdl,
  native4k,
  maximumScale,
  wordSchema,
  type EDL,
  type Word,
} from "../../../packages/edl";
import { effectCatalog } from "../../../packages/composition/effects/catalog";
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const projectInput = z.object({
  title: z.string().min(1).max(150),
  source: z.string(),
  rights: z.literal(true),
  ownUrl: z.boolean().default(false),
  mode: z.enum(["viral", "balanced", "authority"]),
  count: z.number().int().min(1).max(15),
  language: z.string().default("auto"),
  context: z.string().max(2000).default(""),
  brandKit: z.string().optional(),
});
async function readChunk(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Chunk vazio.");
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Chunk ultrapassa o limite.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
const json = (data: unknown, status = 200) => Response.json(data, { status });
async function getTranscript(projectId: string): Promise<Word[]> {
  try {
    return (
      JSON.parse(
        await readFile(
          safePath("projects/" + projectId + "/transcript.json"),
          "utf8",
        ),
      ) as { words: Word[] }
    ).words;
  } catch {
    return [];
  }
}
export async function handle(request: Request, parts: string[]) {
  try {
    const [resource, id, action] = parts;
    const method = request.method;
    const publicAddress = new URL("http://" + (request.headers.get("host") || new URL(request.url).host));
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(
        publicAddress.hostname,
      )
    )
      return json({ error: "O protótipo aceita apenas acesso local." }, 403);
    if (method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && new URL(origin).host !== publicAddress.host)
        return json({ error: "Origem não autorizada." }, 403);
    }
    if (resource === "health")
      return json({
        ok: true,
        queue: "sqlite",
        llmConfigured: llmSettings().configured,
        provider:llmSettings().provider,
        llmEnabled: process.env.LLM_ENABLED !== "false",
        model: llmSettings().model,
        privacy:
          "A transcrição é enviada ao provedor de IA configurado quando a IA é usada. Vídeos permanecem locais; transcrição externa só se configurada.",
      });
    if (resource === "effects")
      return json(
        effectCatalog.map(
          ({ id, nome, categoria, defaults, descricao_para_IA }) => ({
            id,
            nome,
            categoria,
            defaults,
            descricao_para_IA,
          }),
        ),
      );
    if (resource === "uploads") {
      if (method === "POST" && !id) {
        const body = z
          .object({
            name: z.string().max(200),
            size: z.number().int().positive().max(config.maxUploadBytes),
            type: z.enum([
              "video/mp4",
              "video/quicktime",
              "video/webm",
              "video/x-matroska",
              "audio/mpeg",
              "audio/wav",
              "audio/x-wav",
              "audio/ogg",
              "image/png",
              "image/jpeg",
              "image/webp",
            ]),
          })
          .parse(await request.json());
        const uploadId = randomUUID();
        await storage.put(
          "uploads/" + uploadId + "/meta.json",
          Buffer.from(JSON.stringify(body)),
        );
        return json({ id: uploadId, chunkSize: config.chunkBytes });
      }
      idSchema.parse(id);
      const meta = JSON.parse(
        await readFile(safePath("uploads/" + id + "/meta.json"), "utf8"),
      ) as { name: string; size: number; type: string };
      const count = Math.ceil(meta.size / config.chunkBytes);
      if (method === "GET")
        return json({
          received: (await readdir(safePath("uploads/" + id)))
            .filter((f) => /^\d+$/.test(f))
            .map(Number),
          ...meta,
        });
      if (method === "PUT") {
        const index = z.coerce
          .number()
          .int()
          .min(0)
          .max(count - 1)
          .parse(action);
        const expected = Math.min(
          config.chunkBytes,
          meta.size - index * config.chunkBytes,
        );
        if (
          Number(request.headers.get("content-length") || 0) > config.chunkBytes
        )
          return json({ error: "Chunk muito grande." }, 413);
        const bytes = await readChunk(request, expected);
        if (bytes.length !== expected)
          return json({ error: "Tamanho do chunk incorreto." }, 400);
        await storage.put("uploads/" + id + "/" + index, bytes);
        return json({ ok: true });
      }
      if (method === "POST" && action === "complete") {
        const extensions: Record<string, string> = {
          "video/webm": "webm",
          "video/x-matroska": "mkv",
          "video/mp4": "mp4",
          "video/quicktime": "mov",
          "audio/mpeg": "mp3",
          "audio/wav": "wav",
          "audio/x-wav": "wav",
          "audio/ogg": "ogg",
          "image/png": "png",
          "image/jpeg": "jpg",
          "image/webp": "webp",
        };
        const ext = extensions[meta.type];
        const key = "sources/" + id + "." + ext;
        const size = await combineChunks(id, count, key);
        if (size !== meta.size) {
          await storage.remove(key);
          throw new Error("Upload incompleto. Retome o envio.");
        }
        await storage.remove("uploads/" + id);
        return json({ source: key });
      }
    }
    if (resource === "projects") {
      if (method === "GET" && !id)
        return json(
          db
            .select()
            .from(schema.projects)
            .orderBy(desc(schema.projects.createdAt))
            .all(),
        );
      if (method === "POST" && !id) {
        const body = projectInput.parse(await request.json());
        const projectId = randomUUID();
        let source = body.source;
        if (/^https?:/.test(source)) {
          if(!body.ownUrl)return json({error:'Confirme que você tem autorização para esta fonte.'},400);
          source=canonicalYoutubeUrl(source);
        }else {
        if (!/^sources\/[a-f0-9-]+\.(mp4|mov|webm|mkv)$/.test(source))
          throw new Error("Origem de upload inválida.");
        await stat(safePath(source));
        }
        const s = await skill();
        db.insert(schema.projects)
          .values({
            id: projectId,
            title: body.title,
            sourcePath: source,
            language: body.language,
            mode: body.mode,
            status: "queued",
            createdAt: now(),
            paramsJson: JSON.stringify(body),
            rightsAt: now(),
            rightsUser: "local",
            skillHash: s.hash,
          })
          .run();
        enqueue(projectId, "project.process");
        return json({ id: projectId }, 201);
      }
      idSchema.parse(id);
      const project = db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, id))
        .get();
      if (!project) return json({ error: "Projeto não encontrado." }, 404);
      if (method === "GET" && action === "events") {
        const encoder = new TextEncoder();
        let timer: ReturnType<typeof setInterval>;
        let closed=false;
        const stream = new ReadableStream({
          start(controller) {
            const send = () => {
              if(closed)return;
              if (request.signal.aborted) {
                closed=true;
                clearInterval(timer);
                try {
                  controller.close();
                } catch {}
                return;
              }
              try { controller.enqueue(
                encoder.encode(
                  "data: " +
                    JSON.stringify({
                      project: db
                        .select()
                        .from(schema.projects)
                        .where(eq(schema.projects.id, id))
                        .get(),
                      jobs: db
                        .select()
                        .from(schema.jobs)
                        .where(eq(schema.jobs.projectId, id))
                        .all(),
                      clips: db
                        .select()
                        .from(schema.clips)
                        .where(eq(schema.clips.projectId, id))
                        .all(),
                      renders: db
                        .select()
                        .from(schema.renders)
                        .all()
                        .filter(
                          (r) =>
                            db
                              .select()
                              .from(schema.clips)
                              .where(eq(schema.clips.id, r.clipId))
                              .get()?.projectId === id,
                        ),
                    }) +
                    "\n\n",
                ),
              ); } catch { closed=true; clearInterval(timer); }
            };
            timer = setInterval(send, 1000);
            send();
          },
          cancel() {
            closed=true;
            clearInterval(timer);
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }
      if (method === "POST" && action === "cancel") {
        cancelProject(id);
        return json({ ok: true });
      }
      if (method === "POST" && action === "retry") {
        if (project.status === "processing" || project.status === "queued")
          throw new Error("Projeto já está na fila.");
        db.update(schema.projects)
          .set({ status: "queued" })
          .where(eq(schema.projects.id, id))
          .run();
        return json({ jobId: enqueue(id, "project.process") });
      }
      if(method==='POST'&&action==='transcript'&&parts[3]==='corrections'){
        if(db.select().from(schema.clips).where(eq(schema.clips.projectId,id)).all().length)throw new Error('Correções da transcrição-fonte devem preceder a seleção. Após gerar cortes, use versões no editor.');
        const changes=z.array(correctionSchema).parse(await request.json());const key='projects/'+id+'/transcript.json';const transcript=JSON.parse(await readFile(safePath(key),'utf8'));
        const corrected=correctTranscript(transcript.words,changes);transcript.words=corrected;transcript.corrections=[...(transcript.corrections||[]),...changes.map(change=>({...change,at:now()}))];
        await storage.put(key,Buffer.from(JSON.stringify(transcript)));return json({corrected:changes.length});
      }
      if (method === "GET" && action === "transcript")
        return json(await getTranscript(id));
      if (method === "GET")
        return json({
          project,
          clips: db
            .select()
            .from(schema.clips)
            .where(eq(schema.clips.projectId, id))
            .all(),
          jobs: db
            .select()
            .from(schema.jobs)
            .where(eq(schema.jobs.projectId, id))
            .all(),
        });
    }
    if (resource === "clips") {
      idSchema.parse(id);
      const clip = db
        .select()
        .from(schema.clips)
        .where(eq(schema.clips.id, id))
        .get();
      if (!clip) return json({ error: "Corte não encontrado." }, 404);
      const edl = edlSchema.parse(JSON.parse(clip.edlJson));
      if (method === "GET" && action === "versions")
        return json(
          db
            .select()
            .from(schema.versions)
            .where(eq(schema.versions.clipId, id))
            .orderBy(desc(schema.versions.createdAt))
            .all(),
        );
      if (method === "GET") {
        const history = db
          .select()
          .from(schema.editorHistory)
          .where(eq(schema.editorHistory.clipId, id))
          .get();
        return json({
          ...clip,
          edl,
          history: history
            ? {
                past: JSON.parse(history.pastJson),
                future: JSON.parse(history.futureJson),
              }
            : { past: [], future: [] },
        });
      }
      if (method === "PUT") {
        const body = z
          .object({
            edl: edlSchema,
            label: z.string().max(100).default("Edição automática"),
            history: z
              .object({ past: z.array(edlSchema), future: z.array(edlSchema) })
              .optional(),
          })
          .parse(await request.json());
        if (body.edl.clip_id !== id)
          throw new Error("Identidade do corte inválida.");
        for (const e of body.edl.effects) {
          const definition = effectCatalog.find((d) => d.id === e.type);
          if (!definition) throw new Error("Efeito não disponível.");
          definition.schema.parse(e.params);
        }
        const result = validateEdl(
          body.edl,
          await getTranscript(clip.projectId),
          db.select().from(schema.assets).all(),
          effectCatalog.map((e) => e.id),
          true,
        );
        db.transaction((tx) => {
          if (body.history)
            tx.insert(schema.editorHistory)
              .values({
                clipId: id,
                pastJson: JSON.stringify(body.history.past),
                futureJson: JSON.stringify(body.history.future),
              })
              .onConflictDoUpdate({
                target: schema.editorHistory.clipId,
                set: {
                  pastJson: JSON.stringify(body.history.past),
                  futureJson: JSON.stringify(body.history.future),
                },
              })
              .run();
          tx.insert(schema.versions)
            .values({
              id: randomUUID(),
              clipId: id,
              edlJson: JSON.stringify(result),
              label: body.label,
              createdAt: now(),
            })
            .run();
          tx.update(schema.clips)
            .set({
              edlJson: JSON.stringify(result),
              scoreTotal: result.scores.total,
              status: result.qa.passed ? "ready" : "review",
              previewPath: JSON.stringify(result) === clip.edlJson ? clip.previewPath : null,
              updatedAt: now(),
            })
            .where(eq(schema.clips.id, id))
            .run();
        });
        return json(result);
      }
      if (method === "POST" && action === "duplicate") {
        const copy = structuredClone(edl);
        copy.clip_id = randomUUID();
        copy.ab_variable = "hook_text";
        copy.structure.hook.chosen_overlay =
          (copy.structure.hook.chosen_overlay + 1) % 3;
        db.insert(schema.clips)
          .values({
            ...clip,
            id: copy.clip_id,
            edlJson: JSON.stringify(copy),
            previewPath: null,
            createdAt: now(),
            updatedAt: now(),
          })
          .run();
        return json({ id: copy.clip_id });
      }
      if (method === "POST" && action === "propose") {
        const body = z
          .object({
            action: z.enum(["hook", "shorten", "tension", "ending"]),
            seconds: z.number().positive().optional(),
          })
          .parse(await request.json());
        const s = await skill();
        const transcript = await getTranscript(clip.projectId);
        let proposal = await structured(
          s.text +
            "\nCATÁLOGO: " +
            JSON.stringify({
              effects: effectCatalog.map((e) => e.id),
              assets: db.select().from(schema.assets).all(),
            }),
          "Proponha uma nova EDL. Altere somente a parte pedida: " +
            JSON.stringify(body) +
            ". EDL atual: " +
            JSON.stringify(edl) +
            ". Transcrição: " +
            JSON.stringify(transcript),
          edlSchema,
          id + "-proposal-" + Date.now(),
        );
        if (body.action === "hook") {
          const options = proposal.structure.hook.text_overlay_options;
          proposal = structuredClone(edl);
          proposal.structure.hook.text_overlay_options = options;
        }
        proposal.clip_id = id;
        proposal.integrity_review = "review";
        return json(
          validateEdl(
            proposal,
            transcript,
            db.select().from(schema.assets).all(),
            effectCatalog.map((e) => e.id),
            true,
          ),
        );
      }
      if (method === "POST" && action === "export") {
        const body = z
          .object({
            preset: z.enum(["draft", "1080p", "4k"]),
            allowUpscale: z.boolean().default(false),
            allowReview: z.boolean().default(false),
          })
          .parse(await request.json());
        if (!edl.qa.passed && !body.allowReview)
          return json(
            {
              error:
                "Revise as violações de QA antes de exportar, ou confirme a exportação para revisão.",
            },
            422,
          );
        const project = db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, clip.projectId))
          .get()!;
        const meta = JSON.parse(project.sourceMetaJson || "{}") as {
          width: number;
          height: number;
        };
        if (
          body.preset === "4k" &&
          !native4k(meta.width, meta.height,maximumScale(edl)) &&
          !body.allowUpscale
        )
          return json(
            {
              error:
                "A fonte não tem resolução para 4K nativo; o resultado seria ampliado.",
              needsUpscale: true,
            },
            422,
          );
        const renderId = randomUUID();
        await storage.put("renders/" + renderId + ".edl.json", Buffer.from(JSON.stringify(edl)));
        db.insert(schema.renders)
          .values({
            id: renderId,
            clipId: id,
            preset: body.preset,
            status: "queued",
            createdAt: now(),
            progress: 0,
          })
          .run();
        enqueue(clip.projectId, "render:" + renderId);
        return json({
          id: renderId,
          upscaled: body.preset === "4k" && !native4k(meta.width, meta.height,maximumScale(edl)),
        });
      }
      if (method === "POST" && action === "feedback") {
        const body = z
          .object({
            platform: z.string(),
            curve: z.array(
              z.object({
                t: z.number().nonnegative(),
                pct: z.number().min(0).max(100),
              }),
            ),
            views: z.number().int().nonnegative(),
          })
          .parse(await request.json());
        db.insert(schema.feedback)
          .values({
            clipId: id,
            platform: body.platform,
            curveJson: JSON.stringify(body.curve),
            views: body.views,
            importedAt: now(),
          })
          .onConflictDoUpdate({
            target: schema.feedback.clipId,
            set: {
              curveJson: JSON.stringify(body.curve),
              views: body.views,
              importedAt: now(),
            },
          })
          .run();
        return json({
          ok: true,
          calibrationReady:
            db.select().from(schema.feedback).all().length >= 30,
        });
      }
    }
    if (resource === "assets") {
      if (method === "GET") return json(db.select().from(schema.assets).all());
      if (method === "POST") {
        const body = z
          .object({
            type: z.enum(["music", "sfx", "font", "sticker", "brand"]),
            name: z.string().min(1),
            license: z.string().min(1),
            sourceUrl: z.string().url(),
            mood: z.string().optional(),
            bpm: z.number().optional(),
            path: z
              .string()
              .regex(
                /^sources\/[a-f0-9-]+\.(mp4|mov|webm|mkv|mp3|wav|ogg|png|jpg|webp)$/,
              ),
          })
          .parse(await request.json());
        await stat(safePath(body.path));
        const assetId = randomUUID();
        db.insert(schema.assets)
          .values({ id: assetId, ...body })
          .run();
        return json({ id: assetId });
      }
    }
    if (resource === "brand-kits") {
      if (method === "GET")
        return json(db.select().from(schema.brandKits).all());
      if (method === "POST") {
        const body = z
          .object({
            id: z.string().optional(),
            name: z.string().min(1),
            colorsJson: z.string(),
            captionStyleJson: z.string(),
            fontIds: z.string().default("[]"),
          })
          .parse(await request.json());
        const kitId = body.id || randomUUID();
        db.insert(schema.brandKits)
          .values({ ...body, id: kitId })
          .onConflictDoUpdate({ target: schema.brandKits.id, set: body })
          .run();
        return json({ id: kitId });
      }
    }
    if (resource === "media" && method === "GET") {
      const key = parts.slice(1).join("/");
      if (
        !/^(sources|projects|renders)\//.test(key) ||
        !/\.(mp4|mov|webm|mkv|mp3|wav|ogg|png|jpg|webp)$/.test(key)
      )
        return json({ error: "Arquivo não disponível." }, 403);
      const path = safePath(key);
      const info = await stat(path);
      const range = request.headers.get("range");
      const match = range?.match(/^bytes=(\d+)-(\d*)$/);
      const start = match ? Number(match[1]) : 0;
      const end =
        match && match[2]
          ? Math.min(Number(match[2]), info.size - 1)
          : info.size - 1;
      if (start > end || start >= info.size)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": "bytes */" + info.size },
        });
      const stream = Readable.toWeb(
        createReadStream(path, { start, end }),
      ) as ReadableStream;
      return new Response(stream, {
        status: match ? 206 : 200,
        headers: {
          "Content-Type":
            (
              {
                webm: "video/webm",
                mp3: "audio/mpeg",
                wav: "audio/wav",
                ogg: "audio/ogg",
                png: "image/png",
                jpg: "image/jpeg",
                webp: "image/webp",
              } as Record<string, string>
            )[key.split(".").at(-1)!] || "video/mp4",
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes",
          ...(match
            ? { "Content-Range": `bytes ${start}-${end}/${info.size}` }
            : {}),
        },
      });
    }
    return json({ error: "Recurso não encontrado." }, 404);
  } catch (error) {
    if (!(error instanceof z.ZodError))
      console.error(
        JSON.stringify({
          event: "api.error",
          resource: parts[0],
          error: String(error),
        }),
      );
    return json(
      {
        error:
          error instanceof z.ZodError
            ? "Dados inválidos: " +
              error.issues
                .map((i) => i.path.join(".") + ": " + i.message)
                .join("; ")
            : error instanceof Error
              ? error.message
              : "Falha inesperada.",
      },
      400,
    );
  }
}

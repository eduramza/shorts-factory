import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import { db, schema } from "../packages/core/db";
import { safePath } from "../packages/core/storage";
import { config, edlSchema, validateEdl, type Word } from "../packages/edl";
import { effectCatalog } from "../packages/composition/effects/catalog";
const exec = promisify(execFile);
const projectId = process.argv[2];
if (!projectId) throw new Error("Provide project ID.");
const directory = "storage/evidence/youtube-nq5NKs5DDlE";
await mkdir(directory, { recursive: true });
const base = process.env.APP_URL || "http://127.0.0.1:3000";
const waiting = process.argv.includes("--wait"),
  rendering = process.argv.includes("--render");
const deadline = Date.now() + 90 * 60 * 1000;
let last = "";
let project = db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.id, projectId))
  .get();
if (!project) throw new Error("Project not found.");
while (waiting && ["processing", "queued"].includes(project.status)) {
  const job = db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.projectId, projectId))
    .all()
    .filter((j) => j.type === "project.process")
    .at(-1);
  const status = job?.stage + ": " + job?.progress;
  if (status !== last) {
    console.log(status);
    last = status;
  }
  if (Date.now() > deadline)
    throw new Error("Validation timeout while waiting for processing.");
  await new Promise((r) => setTimeout(r, 2000));
  project = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .get()!;
}
const clips = db
  .select()
  .from(schema.clips)
  .where(eq(schema.clips.projectId, projectId))
  .all();
const jobs = db
  .select()
  .from(schema.jobs)
  .where(eq(schema.jobs.projectId, projectId))
  .all();
let words: Word[] = [];
try {
  words = JSON.parse(
    await readFile(
      safePath("projects/" + projectId + "/transcript.json"),
      "utf8",
    ),
  ).words;
} catch {}
const results: Record<string, unknown>[] = [];
for (const clip of clips) {
  const edl = validateEdl(
    JSON.parse(clip.edlJson),
    words,
    db.select().from(schema.assets).all(),
    effectCatalog.map((e) => e.id),
    false,
  );
  const result: Record<string, unknown> = {
    id: clip.id,
    rank: clip.rank,
    title:
      edl.structure.hook.text_overlay_options[
        edl.structure.hook.chosen_overlay
      ],
    duration: edl.duration_out,
    scores: edl.scores,
    qa: edl.qa,
    segments: edl.segments,
    transcript: edl.captions.words.map((w) => w.text).join(" "),
    sourceDeclared: JSON.parse(project.paramsJson).rights === true,
  };
  await writeFile(
    directory + "/clip-" + clip.rank + ".edl.json",
    JSON.stringify(edl, null, 2),
  );
  if (rendering) {
    const response = await fetch(base + "/api/clips/" + clip.id + "/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset: "1080p", allowReview: true }),
    });
    const started = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(started));
    let render = db
      .select()
      .from(schema.renders)
      .where(eq(schema.renders.id, started.id))
      .get()!;
    while (["queued", "running"].includes(render.status)) {
      if (Date.now() > deadline) throw new Error("Render validation timeout.");
      await new Promise((r) => setTimeout(r, 2000));
      render = db
        .select()
        .from(schema.renders)
        .where(eq(schema.renders.id, started.id))
        .get()!;
      const message =
        "Clip " +
        clip.rank +
        " " +
        render.status +
        " " +
        Math.round(render.progress || 0) +
        "%";
      if (message !== last) {
        console.log(message);
        last = message;
      }
    }
    if (render.path) {
      const path = safePath(render.path);
      const probe = JSON.parse(
        (
          await exec("ffprobe", [
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            path,
          ])
        ).stdout,
      );
      const measured = await exec(
        "ffmpeg",
        [
          "-hide_banner",
          "-i",
          path,
          "-af",
          "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
          "-f",
          "null",
          "-",
        ],
        { maxBuffer: 10 * 1024 ** 2 },
      );
      const loudness = JSON.parse(
        measured.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s)![0],
      );
      const video = probe.streams.find(
        (s: { codec_type: string }) => s.codec_type === "video",
      );
      await exec("ffmpeg", ["-v", "error", "-i", path, "-f", "null", "-"], {
        maxBuffer: 10 * 1024 ** 2,
      });
      const audioSync = JSON.parse(
        (
          await exec(
            ".venv/bin/python",
            [
              "scripts/validate-audio.py",
              directory + "/clip-" + clip.rank + ".edl.json",
              safePath(
                "projects/" +
                  projectId +
                  "/" +
                  (edl.audio.voice.denoise ? "voice-clean.wav" : "voice.wav"),
              ),
              path,
            ],
            { maxBuffer: 10 * 1024 ** 2 },
          )
        ).stdout,
      );
      result.audioSync = audioSync;
      result.render = {
        path: render.path,
        preset: render.preset,
        width: video.width,
        height: video.height,
        fps: video.avg_frame_rate,
        codec: video.codec_name,
        pixelFormat: video.pix_fmt,
        colorSpace: video.color_space,
        duration: Number(probe.format.duration),
        durationDelta: Math.abs(
          Number(probe.format.duration) - edl.duration_out,
        ),
        lufs: Number(loudness.input_i),
        truePeak: Number(loudness.input_tp),
        decoded: true,
      };
      result.technicalPassed =
        video.width === 1080 &&
        video.height === 1920 &&
        video.pix_fmt === "yuv420p" &&
        video.color_space === "bt709" &&
        Math.abs(Number(probe.format.duration) - edl.duration_out) <=
          config.frameTolerance / config.fps &&
        Math.abs(Number(loudness.input_i) + 14) <= 1 &&
        Number(loudness.input_tp) <= -1;
      result.technicalPassed =
        result.technicalPassed === true && audioSync.passed;
      for (const [index, t] of [
        0,
        Math.min(2, edl.duration_out / 4),
        edl.duration_out / 2,
        Math.max(0, edl.duration_out - 0.3),
      ].entries())
        await exec("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-ss",
          String(t),
          "-i",
          path,
          "-frames:v",
          "1",
          "-vf",
          "scale=270:480",
          directory + "/clip-" + clip.rank + "-frame-" + index + ".png",
        ]);
    } else {
      result.renderError = render.error;
      result.technicalPassed = false;
    }
  }
  results.push(result);
}
const passed =
  clips.length >= 5 &&
  results.every(
    (r) => (r.qa as { passed: boolean }).passed && r.technicalPassed === true,
  );
const report = {
  projectId,
  sourceUrl: "https://www.youtube.com/watch?v=nq5NKs5DDlE",
  recordedAt: new Date().toISOString(),
  projectStatus: project.status,
  projectCreatedAt: project.createdAt,
  elapsedSeconds: (Date.now() - Date.parse(project.createdAt)) / 1000,
  requestedClips: 5,
  deliveredClips: clips.length,
  alignedWords: words.length,
  automaticAndTechnicalPassed: passed,
  visualAndEditorialReview: "pending",
  jobs: jobs.map((j) => ({
    stage: j.stage,
    status: j.status,
    error: j.error,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
  })),
  clips: results,
};
await writeFile(
  directory + "/validation.json",
  JSON.stringify(report, null, 2),
);
await writeFile(
  directory + "/validation.md",
  `# Validação com vídeo real\n\nProjeto: ${projectId}\n\nStatus: ${project.status}. Cortes: ${clips.length}/5. Palavras alinhadas: ${words.length}.\n\nValidação automática e técnica: ${passed ? "APROVADA" : "NÃO APROVADA / PENDENTE"}. Revisão visual e editorial: pendente.\n\n` +
    results
      .map(
        (r) =>
          `## Corte ${r.rank}: ${r.title}\n\nDuração: ${r.duration} s. QA: ${(r.qa as { passed: boolean }).passed ? "aprovado" : "revisar"}. Render: ${r.technicalPassed === true ? "aprovado" : "pendente ou falhou"}.\n\n${r.transcript}\n\n\`\`\`json\n${JSON.stringify({ qa: r.qa, render: r.render, audioSync: r.audioSync, error: r.renderError }, null, 2)}\n\`\`\`\n`,
      )
      .join("\n"),
);
console.log(
  JSON.stringify({
    projectStatus: project.status,
    clips: clips.length,
    passed,
    report: directory + "/validation.md",
  }),
);

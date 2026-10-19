import { renderClip } from "../apps/render-worker/src/render";
import { fixture, words } from "../tests/fixture";
import { db, schema, now } from "../packages/core/db";
import { storage } from "../packages/core/storage";
const e = fixture();
const projectId = "synthetic-demo";
const meta = {
  duration: 16,
  width: 1280,
  height: 720,
  fps: 30,
  codec: "h264",
  has_audio: true,
};
db.insert(schema.projects)
  .values({
    id: projectId,
    title: "Teste técnico · mídia sintética",
    sourcePath: "sources/fixture.mp4",
    sourceMetaJson: JSON.stringify(meta),
    language: "pt",
    mode: "viral",
    status: "ready",
    createdAt: now(),
    paramsJson: JSON.stringify({
      count: 1,
      context:
        "Mídia sintética de teste, sem fala real. Não representa seleção por IA.",
    }),
    rightsAt: now(),
    rightsUser: "synthetic-test-generator",
    skillHash: "test-fixture",
  })
  .onConflictDoNothing()
  .run();
await storage.put(
  "projects/" + projectId + "/transcript.json",
  Buffer.from(JSON.stringify({ words, synthetic: true })),
);
db.insert(schema.clips)
  .values({
    id: e.clip_id,
    projectId,
    rank: 1,
    scoreTotal: e.scores.total,
    scoresJson: JSON.stringify(e.scores),
    edlJson: JSON.stringify(e),
    status: "ready",
    skillHash: "test-fixture",
    createdAt: now(),
    updatedAt: now(),
  })
  .onConflictDoNothing()
  .run();
const result = await renderClip(
  e,
  "sources/fixture.mp4",
  [],
  "renders/smoke-1080p.mp4",
  "1080p",
  (p) => {
    if (Math.round(p) % 10 === 0) console.log("Render " + Math.round(p) + "%");
  },
  () => false,
);
await storage.put(
  "evidence/render-probe.json",
  Buffer.from(JSON.stringify(result, null, 2)),
);
console.log(JSON.stringify(result, null, 2));

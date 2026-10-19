import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture, words } from "./fixture";
let handle: typeof import("../apps/web/lib/api").handle;
let store: typeof import("../packages/core/storage");
let database: typeof import("../packages/core/db");
let folder: string;
let projectId: string;
const request = (
  parts: string[],
  method = "GET",
  body?: unknown,
  raw = false,
) =>
  handle(
    new Request("http://localhost:3000/api/" + parts.join("/"), {
      method,
      headers: {
        "Content-Type": raw ? "application/octet-stream" : "application/json",
      },
      ...(body !== undefined
        ? { body: raw ? new Uint8Array(body as Buffer) : JSON.stringify(body) }
        : {}),
    }),
    parts,
  );
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), "clipforge-test-"));
  process.env.STORAGE_DIR = folder;
  store = await import("../packages/core/storage");
  database = await import("../packages/core/db");
  handle = (await import("../apps/web/lib/api")).handle;
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});
describe.sequential("Local API and SQLite queue", () => {
  it("serves health without returning a secret", async () => {
    const r = await request(["health"]);
    const data = await r.json();
    expect(data.queue).toBe("sqlite");
    expect(data).not.toHaveProperty("apiKey");
  });
  it("uploads chunks idempotently and assembles original bytes", async () => {
    const init = await request(["uploads"], "POST", {
      name: "../unsafe.mp4",
      size: 4,
      type: "video/mp4",
    });
    const { id } = await init.json();
    expect(init.status).toBe(200);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            ["uploads", id, "0"],
            "PUT",
            Buffer.from([0, 1, 2, 3]),
            true,
          )
        ).status,
      ).toBe(200);
    const state = await (await request(["uploads", id])).json();
    expect(state.received).toEqual([0]);
    const done = await (
      await request(["uploads", id, "complete"], "POST", {})
    ).json();
    expect(await store.storage.get(done.source)).toEqual(
      Buffer.from([0, 1, 2, 3]),
    );
  });
  it("rejects files over 4 GB and invalid MIME", async () => {
    expect(
      (
        await request(["uploads"], "POST", {
          name: "bad.exe",
          size: 5e9,
          type: "application/octet-stream",
        })
      ).status,
    ).toBe(400);
  });
  it("requires explicit rights confirmation", async () => {
    expect(
      (
        await request(["projects"], "POST", {
          title: "Test",
          source: "sources/test.mp4",
          rights: false,
          mode: "viral",
          count: 5,
        })
      ).status,
    ).toBe(400);
  });
  it("creates a project with recorded rights and a persistent job", async () => {
    await store.storage.put("sources/aaaa.mp4", Buffer.from([1, 2, 3]));
    const result = await request(["projects"], "POST", {
      title: "Synthetic integration fixture",
      source: "sources/aaaa.mp4",
      rights: true,
      mode: "viral",
      count: 1,
    });
    expect(result.status).toBe(201);
    projectId = (await result.json()).id;
    const { project, jobs } = await (
      await request(["projects", projectId])
    ).json();
    expect(project.rightsAt).toBeTruthy();
    expect(project.skillHash).toHaveLength(64);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe("project.process");
  });
  it("cancels pending work and can explicitly retry", async () => {
    expect(
      (await request(["projects", projectId, "cancel"], "POST", {})).status,
    ).toBe(200);
    let state = await (await request(["projects", projectId])).json();
    expect(state.jobs[0].status).toBe("cancelled");
    expect(
      (await request(["projects", projectId, "retry"], "POST", {})).status,
    ).toBe(200);
    state = await (await request(["projects", projectId])).json();
    expect(
      state.jobs.some((j: { status: string }) => j.status === "queued"),
    ).toBe(true);
  });
  it('retries transient failures with persisted backoff and leaves permanent failures alone',async()=>{const q=await import('../packages/core/queue');q.cancelProject(projectId);const id=q.enqueue(projectId,'test');const task=q.claim()!;expect(task.id).toBe(id);expect(task.attempt).toBe(1);expect(q.retryFailure(task,new Error('fetch failed'))).toBe(true);expect(q.claim()).toBeUndefined();const {eq}=await import('drizzle-orm');database.db.update(database.schema.queueAttempts).set({nextAt:0}).where(eq(database.schema.queueAttempts.jobId,id)).run();const retried=q.claim()!;expect(retried.attempt).toBe(2);expect(q.retryFailure(retried,new Error('Configure a API'))).toBe(false);q.cancelProject(projectId);});
  it('accepts the actual loopback Host behind Next URL normalization',async()=>{const r=await handle(new Request('http://localhost:3000/api/uploads',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','Content-Type':'application/json'},body:JSON.stringify({name:'test.mp4',size:4,type:'video/mp4'})}),['uploads']);expect(r.status).toBe(200);});
  it('rejects a foreign Host even if Origin matches it',async()=>{const r=await handle(new Request('http://localhost:3000/api/health',{headers:{host:'attacker.invalid'}}),['health']);expect(r.status).toBe(403);});
  it('closes the SSE timer when the browser cancels the stream',async()=>{vi.useFakeTimers();try{const r=await request(['projects',projectId,'events']);const reader=r.body!.getReader();expect((await reader.read()).done).toBe(false);await reader.cancel();vi.advanceTimersByTime(3000);expect(vi.getTimerCount()).toBe(0);}finally{vi.useRealTimers();}});
  it("prevents cross-origin mutations", async () => {
    const response = await handle(
      new Request("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { origin: "https://attacker.invalid" },
        body: "{}",
      }),
      ["projects"],
    );
    expect(response.status).toBe(403);
  });
  it("saves versions, validates edits, duplicates only the hook variable", async () => {
    const { db, schema, now } = database;
    const e = fixture();
    db.insert(schema.clips)
      .values({
        id: e.clip_id,
        projectId,
        rank: 1,
        edlJson: JSON.stringify(e),
        status: "ready",
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    await store.storage.put(
      "projects/" + projectId + "/transcript.json",
      Buffer.from(JSON.stringify({ words })),
    );
    const result = await request(["clips", "fixture"], "PUT", {
      edl: e,
      label: "Named version",
    });
    expect(result.status).toBe(200);
    expect(
      (await (await request(["clips", "fixture", "versions"])).json())[0].label,
    ).toBe("Named version");
    const copy = await (
      await request(["clips", "fixture", "duplicate"], "POST", {})
    ).json();
    const duplicate = (await (await request(["clips", copy.id])).json()).edl;
    expect(duplicate.structure.hook.chosen_overlay).toBe(1);
    expect(duplicate.segments).toEqual(e.segments);
    expect(duplicate.captions).toEqual(e.captions);
    expect(duplicate.ab_variable).toBe("hook_text");
  });
  it("refuses music without a license", async () => {
    expect(
      (
        await request(["assets"], "POST", {
          name: "Unknown",
          type: "music",
          license: "",
          sourceUrl: "https://example.org",
          path: "sources/aaaa.mp4",
        })
      ).status,
    ).toBe(400);
  });
});

import { eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, schema, now } from "./db";
import {config} from "../edl/config";
export type Task = {
  id: string;
  projectId: string;
  type: string;
  status: string;
  progress: number;
  error: string | null;
  stage: string | null;
  logJson: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempt:number;
};
export function enqueue(projectId: string, type: string) {
  const id = randomUUID();
  db.insert(schema.jobs)
    .values({
      id,
      projectId,
      type,
      status: "queued",
      progress: 0,
      stage: "aguardando",
      logJson: "[]",
    })
    .run();
  return id;
}
export function cancelProject(projectId: string) {
  db.update(schema.jobs)
    .set({ status: "cancelled", finishedAt: now() })
    .where(
      and(
        eq(schema.jobs.projectId, projectId),
        inArray(schema.jobs.status, ["queued", "running"]),
      ),
    )
    .run();
  db.update(schema.projects)
    .set({ status: "cancelled" })
    .where(eq(schema.projects.id, projectId))
    .run();
}
export function isCancelled(id: string) {
  return (
    db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get()
      ?.status === "cancelled"
  );
}
export function recoverJobs() {
  db.update(schema.jobs)
    .set({ status: "queued", stage: "retomando" })
    .where(eq(schema.jobs.status, "running"))
    .run();
}
export function claim(): Task | undefined {
  return db.transaction((tx) => {
    const job = tx
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.status, "queued"))
      .all().find(candidate=>{const attempt=tx.select().from(schema.queueAttempts).where(eq(schema.queueAttempts.jobId,candidate.id)).get();return !attempt||attempt.nextAt<=Date.now();});
    if (!job) return;
    tx.update(schema.jobs)
      .set({ status: "running", startedAt: job.startedAt||now() })
      .where(and(eq(schema.jobs.id, job.id), eq(schema.jobs.status, "queued")))
      .run();
    const prior=tx.select().from(schema.queueAttempts).where(eq(schema.queueAttempts.jobId,job.id)).get();const attempt=(prior?.attempts||0)+1;
    tx.insert(schema.queueAttempts).values({jobId:job.id,attempts:attempt,nextAt:0}).onConflictDoUpdate({target:schema.queueAttempts.jobId,set:{attempts:attempt,nextAt:0}}).run();
    return { ...job, status: "running",attempt };
  });
}
export function progress(
  id: string,
  stage: string,
  value: number,
  message: string,
) {
  const current = db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, id))
    .get();
  if (!current || current.status === "cancelled")
    throw new Error("Processamento cancelado.");
  const log = JSON.parse(current.logJson || "[]") as unknown[];
  log.push({ stage, progress: value, message, at: now() });
  db.update(schema.jobs)
    .set({ stage, progress: value, logJson: JSON.stringify(log) })
    .where(eq(schema.jobs.id, id))
    .run();
  console.log(
    JSON.stringify({
      job_id: id,
      project_id: current.projectId,
      stage,
      progress: value,
      message,
    }),
  );
}

export function retryFailure(task:Task,error:unknown){
 if(task.attempt>config.retryCount||!/(429|500|502|503|504|timeout|timed out|ECONN|fetch failed|network)/i.test(String(error)))return false;
 const delay=config.retryBaseMs*2**(task.attempt-1);
 const current=db.select().from(schema.jobs).where(eq(schema.jobs.id,task.id)).get();
 progress(task.id,'retry',current?.progress||task.progress,'Falha temporária. Nova tentativa em '+delay/1000+' s.');
 db.update(schema.queueAttempts).set({nextAt:Date.now()+delay}).where(eq(schema.queueAttempts.jobId,task.id)).run();
 db.update(schema.jobs).set({status:'queued',error:null}).where(eq(schema.jobs.id,task.id)).run();
 return true;
}

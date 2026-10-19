import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  sourcePath: text("source_path").notNull(),
  sourceMetaJson: text("source_meta_json"),
  language: text("language").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  paramsJson: text("params_json").notNull(),
  rightsAt: text("rights_at").notNull(),
  rightsUser: text("rights_user").notNull(),
  skillHash: text("skill_hash").notNull(),
});
export const transcripts = sqliteTable("transcripts", {
  projectId: text("project_id").primaryKey(),
  jsonPath: text("json_path").notNull(),
  language: text("language"),
  diarized: integer("diarized"),
});
export const clips = sqliteTable("clips", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  rank: integer("rank").notNull(),
  scoreTotal: real("score_total"),
  scoresJson: text("scores_json"),
  edlJson: text("edl_json").notNull(),
  status: text("status").notNull(),
  previewPath: text("preview_path"),
  skillHash: text("skill_hash"),
  llmTraceJson: text("llm_trace_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const versions = sqliteTable("clip_versions", {
  id: text("id").primaryKey(),
  clipId: text("clip_id").notNull(),
  edlJson: text("edl_json").notNull(),
  label: text("label").notNull(),
  createdAt: text("created_at").notNull(),
});
export const renders = sqliteTable("renders", {
  id: text("id").primaryKey(),
  clipId: text("clip_id").notNull(),
  preset: text("preset").notNull(),
  status: text("status").notNull(),
  path: text("path"),
  sizeBytes: integer("size_bytes"),
  createdAt: text("created_at").notNull(),
  progress: real("progress").default(0),
  error: text("error"),
});
export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  license: text("license").notNull(),
  sourceUrl: text("source_url").notNull(),
  mood: text("mood"),
  bpm: real("bpm"),
  duration: real("duration"),
});
export const brandKits = sqliteTable("brand_kits", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  colorsJson: text("colors_json"),
  fontIds: text("font_ids"),
  captionStyleJson: text("caption_style_json"),
  logoPath: text("logo_path"),
  watermarkJson: text("watermark_json"),
  introOutroJson: text("intro_outro_json"),
});
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  progress: real("progress").notNull(),
  error: text("error"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  stage: text("stage"),
  logJson: text("log_json").default("[]"),
});
export const feedback = sqliteTable("retention_feedback", {
  clipId: text("clip_id").primaryKey(),
  platform: text("platform").notNull(),
  curveJson: text("curve_json").notNull(),
  views: integer("views"),
  importedAt: text("imported_at").notNull(),
});

export const editorHistory = sqliteTable("editor_history", {
  clipId: text("clip_id").primaryKey(),
  pastJson: text("past_json").notNull(),
  futureJson: text("future_json").notNull(),
});
export const queueAttempts=sqliteTable('queue_attempts',{jobId:text('job_id').primaryKey(),attempts:integer('attempts').notNull(),nextAt:integer('next_at').notNull()});

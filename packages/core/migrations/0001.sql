CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,title TEXT NOT NULL,source_path TEXT NOT NULL,source_meta_json TEXT,language TEXT NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,params_json TEXT NOT NULL,rights_at TEXT NOT NULL,rights_user TEXT NOT NULL,skill_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS transcripts(project_id TEXT PRIMARY KEY,json_path TEXT NOT NULL,language TEXT,diarized INTEGER);
CREATE TABLE IF NOT EXISTS clips(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,rank INTEGER NOT NULL,score_total REAL,scores_json TEXT,edl_json TEXT NOT NULL,status TEXT NOT NULL,preview_path TEXT,skill_hash TEXT,llm_trace_json TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clip_versions(id TEXT PRIMARY KEY,clip_id TEXT NOT NULL,edl_json TEXT NOT NULL,label TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS renders(id TEXT PRIMARY KEY,clip_id TEXT NOT NULL,preset TEXT NOT NULL,status TEXT NOT NULL,path TEXT,size_bytes INTEGER,created_at TEXT NOT NULL,progress REAL DEFAULT 0,error TEXT);
CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,type TEXT NOT NULL,name TEXT NOT NULL,path TEXT NOT NULL,license TEXT NOT NULL,source_url TEXT NOT NULL,mood TEXT,bpm REAL,duration REAL);
CREATE TABLE IF NOT EXISTS brand_kits(id TEXT PRIMARY KEY,name TEXT NOT NULL,colors_json TEXT,font_ids TEXT,caption_style_json TEXT,logo_path TEXT,watermark_json TEXT,intro_outro_json TEXT);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,type TEXT NOT NULL,status TEXT NOT NULL,progress REAL NOT NULL,error TEXT,started_at TEXT,finished_at TEXT,stage TEXT,log_json TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS retention_feedback(clip_id TEXT PRIMARY KEY,platform TEXT NOT NULL,curve_json TEXT NOT NULL,views INTEGER,imported_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS clips_project ON clips(project_id);
CREATE INDEX IF NOT EXISTS jobs_project ON jobs(project_id);
CREATE INDEX IF NOT EXISTS versions_clip ON clip_versions(clip_id,created_at);

CREATE TABLE IF NOT EXISTS editor_history(clip_id TEXT PRIMARY KEY,past_json TEXT NOT NULL,future_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS queue_attempts(job_id TEXT PRIMARY KEY,attempts INTEGER NOT NULL,next_at INTEGER NOT NULL);

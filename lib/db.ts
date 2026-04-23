import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "storage", "app.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      duration_sec REAL,
      language TEXT DEFAULT 'multi',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcriptions (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      segments_json TEXT NOT NULL,
      transcript_json TEXT,
      audio_duration_sec REAL,
      cost_estimate_usd REAL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS structured_outputs (
      id TEXT PRIMARY KEY,
      transcription_id TEXT NOT NULL REFERENCES transcriptions(id) ON DELETE CASCADE,
      summary TEXT,
      thesis_json TEXT,
      notes_json TEXT,
      actions_json TEXT,
      model TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('llm_provider', 'groq');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('ollama_model', 'llama3.1');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('ollama_base_url', 'http://localhost:11434/v1');
  `);
}

-- Standalone database for 競走馬血統ならべ. Do not bind a Sweeper/Putt D1 here.
CREATE TABLE IF NOT EXISTS players (
 player_id TEXT PRIMARY KEY, credential_hash TEXT NOT NULL, display_name TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS records (
 player_id TEXT NOT NULL, difficulty TEXT NOT NULL, score_version TEXT NOT NULL,
 score_ms INTEGER NOT NULL, elapsed_ms INTEGER NOT NULL, penalty_ms INTEGER NOT NULL,
 stage_id TEXT NOT NULL, seed TEXT NOT NULL,
 horse_ids_json TEXT NOT NULL, actions_json TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(player_id,difficulty,score_version),
 FOREIGN KEY(player_id) REFERENCES players(player_id)
);
CREATE INDEX IF NOT EXISTS idx_horse_leaderboard ON records(difficulty,score_version,score_ms,updated_at,player_id);
CREATE TABLE IF NOT EXISTS submissions (
 run_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, submission_id TEXT NOT NULL,
 response_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_horse_submissions_player ON submissions(player_id,created_at);
CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, hits INTEGER NOT NULL
);

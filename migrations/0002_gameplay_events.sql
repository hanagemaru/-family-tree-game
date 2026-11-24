-- Aggregate play counting for 競走馬血統ならべ. No player ID, URL, referrer or ranking data.
-- session_id is a random per-tab-visit ID; run_id is a random per-play ID ('' for visit events).
CREATE TABLE IF NOT EXISTS gameplay_events (
 session_id TEXT NOT NULL,
 event TEXT NOT NULL CHECK (event IN ('visit','start','complete')),
 run_id TEXT NOT NULL DEFAULT '',
 source TEXT NOT NULL,
 difficulty TEXT NOT NULL CHECK (difficulty IN ('none','easy','normal','hard')),
 outcome TEXT NOT NULL CHECK (outcome IN ('none','clear','gaveup')),
 received_at INTEGER NOT NULL,
 PRIMARY KEY (session_id,event,run_id)
);
CREATE INDEX IF NOT EXISTS gameplay_events_event_received_at ON gameplay_events(event,received_at);

CREATE TABLE IF NOT EXISTS research_threads (
    thesis_id TEXT NOT NULL,
    context_hash TEXT NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (thesis_id, context_hash)
);
INSERT OR IGNORE INTO schema_migrations VALUES (4);

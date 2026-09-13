PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS research_threads_v5;
CREATE TABLE research_threads_v5 (
    thesis_id TEXT NOT NULL,
    context_hash TEXT NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (thesis_id, context_hash)
);
INSERT INTO research_threads_v5 (thesis_id, context_hash, body)
SELECT thesis_id, context_hash, body FROM research_threads;
DROP TABLE research_threads;
ALTER TABLE research_threads_v5 RENAME TO research_threads;
INSERT OR IGNORE INTO schema_migrations VALUES (5);
PRAGMA foreign_keys = ON;

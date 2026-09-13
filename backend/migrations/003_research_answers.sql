CREATE TABLE IF NOT EXISTS research_answers (
    input_hash TEXT PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
    thesis_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    assessment_input_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    body TEXT NOT NULL,
    FOREIGN KEY (thesis_id, version) REFERENCES theses(id, version)
);
CREATE INDEX IF NOT EXISTS research_answers_thesis_version
ON research_answers(thesis_id, version, created_at);
INSERT OR IGNORE INTO schema_migrations VALUES (3);

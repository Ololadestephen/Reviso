CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS theses (
    id TEXT NOT NULL, version INTEGER NOT NULL, body TEXT NOT NULL,
    PRIMARY KEY (id, version)
);
CREATE TABLE IF NOT EXISTS assessments (
    input_hash TEXT PRIMARY KEY, thesis_id TEXT NOT NULL, version INTEGER NOT NULL,
    body TEXT NOT NULL, FOREIGN KEY (thesis_id, version) REFERENCES theses(id, version)
);
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY, thesis_id TEXT NOT NULL, body TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_migrations VALUES (1);

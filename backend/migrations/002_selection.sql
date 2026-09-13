CREATE TABLE IF NOT EXISTS assessment_selection (
    thesis_id TEXT PRIMARY KEY,
    input_hash TEXT NOT NULL REFERENCES assessments(input_hash)
);
INSERT OR IGNORE INTO assessment_selection(thesis_id, input_hash)
SELECT thesis_id, input_hash FROM assessments
WHERE rowid IN (SELECT MAX(rowid) FROM assessments GROUP BY thesis_id);
INSERT OR IGNORE INTO schema_migrations VALUES (2);

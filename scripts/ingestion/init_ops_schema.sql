-- ==============================================================================
-- SCHÉMA OPS-DB POUR LES SESSIONS DE FORMATION (cfaoacademy-ops-db-1 : ops)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS training_session (
    id UUID PRIMARY KEY,
    session_index INT NOT NULL,
    year INT NOT NULL DEFAULT 2026,
    pole VARCHAR(32) NOT NULL,
    brand VARCHAR(64) NOT NULL,
    code VARCHAR(64),
    title VARCHAR(512) NOT NULL,
    training_type VARCHAR(64) NOT NULL DEFAULT 'Présentiel',
    location VARCHAR(128) NOT NULL,
    start_date DATE,
    end_date DATE,
    duration_days INT,
    trainer VARCHAR(128),
    client_scope VARCHAR(128),
    version_source VARCHAR(128) NOT NULL,
    is_authoritative BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uniq_ops_session_year_idx UNIQUE (year, session_index)
);

CREATE INDEX IF NOT EXISTS idx_ops_session_brand ON training_session(brand);
CREATE INDEX IF NOT EXISTS idx_ops_session_location ON training_session(location);
CREATE INDEX IF NOT EXISTS idx_ops_session_dates ON training_session(start_date, end_date);

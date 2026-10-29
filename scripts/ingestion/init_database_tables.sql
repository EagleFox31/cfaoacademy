-- ==============================================================================
-- INITIALISATION DU SCHÉMA DE DONNÉES DE FORMATION & ARBITRAGE
-- CFAO Academy — Architecture 2026
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BASE NEEDS (cfao-needs-needs-db-1 : needs)
-- Les trois premières tables sont aussi des modèles Django (campaigns, migration
-- 0004) : garder ce schéma identique à cfao-needs/api/campaigns/models.py.
-- ------------------------------------------------------------------------------

-- Quotas filiales par marque et par pays (Clé de répartition 2026)
CREATE TABLE IF NOT EXISTS campaigns_branchbrandquota (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns_campaign(id) ON DELETE CASCADE,
    pole VARCHAR(32) NOT NULL,
    country VARCHAR(64) NOT NULL,
    brand VARCHAR(64) NOT NULL,
    total_branch_techs INT NOT NULL DEFAULT 0,
    brand_tech_count INT NOT NULL DEFAULT 0,
    requested_needs INT NOT NULL DEFAULT 0,
    allocated_seats INT NOT NULL DEFAULT 0,
    source_file VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uniq_campaign_branch_quota UNIQUE (campaign_id, pole, country, brand)
);

CREATE INDEX IF NOT EXISTS idx_branch_quota_country ON campaigns_branchbrandquota(country);
CREATE INDEX IF NOT EXISTS idx_branch_quota_brand ON campaigns_branchbrandquota(brand);

-- Attributions détaillées par module et par filiale
CREATE TABLE IF NOT EXISTS campaigns_courseallocation (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns_campaign(id) ON DELETE CASCADE,
    brand VARCHAR(64) NOT NULL,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(512) NOT NULL,
    level VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    country VARCHAR(64) NOT NULL,
    allocated_seats INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_alloc_code ON campaigns_courseallocation(code);
CREATE INDEX IF NOT EXISTS idx_course_alloc_country ON campaigns_courseallocation(country);

-- Sessions de formation planifiées 2026 (Consolidées avec priorité Suzuki Août)
CREATE TABLE IF NOT EXISTS campaigns_trainingsession (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uniq_training_session_idx UNIQUE (year, session_index)
);

CREATE INDEX IF NOT EXISTS idx_trainingsession_brand ON campaigns_trainingsession(brand);
CREATE INDEX IF NOT EXISTS idx_trainingsession_dates ON campaigns_trainingsession(start_date, end_date);

-- Thématiques non choisies (Historique des arbitrages négatifs)
CREATE TABLE IF NOT EXISTS campaigns_coursenonchoisie (
    id UUID PRIMARY KEY,
    year INT NOT NULL DEFAULT 2026,
    bu VARCHAR(32) NOT NULL,
    brand VARCHAR(64) NOT NULL,
    level VARCHAR(32) NOT NULL,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(512) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'NON_CHOISIE_06_02_2026',
    source_file VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_non_choisie_code ON campaigns_coursenonchoisie(code);

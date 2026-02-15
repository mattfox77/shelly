-- Saga Oversight Schema
-- Tracks Shelly's oversight of saga-orchestrator workflow executions

CREATE TABLE IF NOT EXISTS saga_oversight (
    id SERIAL PRIMARY KEY,
    saga_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    decisions_made JSONB DEFAULT '[]',
    summary TEXT,
    total_dimensions INTEGER DEFAULT 0,
    completed_dimensions INTEGER DEFAULT 0,
    collapsed_dimensions INTEGER DEFAULT 0,
    duration_ms BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_saga_oversight_saga_id ON saga_oversight(saga_id);
CREATE INDEX idx_saga_oversight_status ON saga_oversight(status);
CREATE INDEX idx_saga_oversight_created ON saga_oversight(created_at);

-- Ensure updated_at trigger function exists (may already exist from 001)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saga_oversight_updated_at
    BEFORE UPDATE ON saga_oversight
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

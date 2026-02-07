-- Shelly Database Initialization Script
-- This script runs automatically when the PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== Core Tables ====================

-- Projects table for tracked repositories
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    github_repo VARCHAR(255) NOT NULL UNIQUE,
    owner VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_branch VARCHAR(100) DEFAULT 'main',
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_repo ON projects(github_repo);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);

-- Issue snapshots for tracking issue state over time
CREATE TABLE IF NOT EXISTS issue_snapshots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    github_issue_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    state VARCHAR(20) NOT NULL,
    labels JSONB DEFAULT '[]',
    assignees JSONB DEFAULT '[]',
    milestone VARCHAR(255),
    author VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_snapshots_project ON issue_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_issue_snapshots_number ON issue_snapshots(github_issue_number);
CREATE INDEX IF NOT EXISTS idx_issue_snapshots_snapshot ON issue_snapshots(snapshot_at DESC);

-- PR snapshots for tracking PR state over time
CREATE TABLE IF NOT EXISTS pr_snapshots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    github_pr_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    state VARCHAR(20) NOT NULL,
    base_branch VARCHAR(255) NOT NULL,
    head_branch VARCHAR(255) NOT NULL,
    author VARCHAR(100) NOT NULL,
    reviewers JSONB DEFAULT '[]',
    review_state VARCHAR(50),
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    changed_files INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    merged_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_snapshots_project ON pr_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_pr_snapshots_number ON pr_snapshots(github_pr_number);
CREATE INDEX IF NOT EXISTS idx_pr_snapshots_snapshot ON pr_snapshots(snapshot_at DESC);

-- Daily reports
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    issues_opened INTEGER DEFAULT 0,
    issues_closed INTEGER DEFAULT 0,
    prs_opened INTEGER DEFAULT 0,
    prs_merged INTEGER DEFAULT 0,
    prs_closed INTEGER DEFAULT 0,
    commits_count INTEGER DEFAULT 0,
    active_contributors INTEGER DEFAULT 0,
    summary TEXT,
    highlights JSONB DEFAULT '[]',
    blockers JSONB DEFAULT '[]',
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_project ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date DESC);

-- Weekly reports
CREATE TABLE IF NOT EXISTS weekly_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    issues_opened INTEGER DEFAULT 0,
    issues_closed INTEGER DEFAULT 0,
    prs_opened INTEGER DEFAULT 0,
    prs_merged INTEGER DEFAULT 0,
    velocity_score DECIMAL(5,2),
    health_score DECIMAL(5,2),
    summary TEXT,
    trends JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_project ON weekly_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_start DESC);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    action_target VARCHAR(255) NOT NULL,
    action_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(action_type);

-- ==================== Chat Tables ====================

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(created_at DESC);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    tool_calls JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- ==================== Sandbox Tables ====================

-- Sandbox sessions
CREATE TABLE IF NOT EXISTS sandbox_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    agent VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_status ON sandbox_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_created ON sandbox_sessions(created_at DESC);

-- Sandbox events
CREATE TABLE IF NOT EXISTS sandbox_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) REFERENCES sandbox_sessions(session_id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_sandbox_events_session ON sandbox_events(session_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_events_sequence ON sandbox_events(session_id, sequence);

-- ==================== Notification Tables ====================

-- Notification history
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel VARCHAR(50) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'sent',
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at DESC);

-- ==================== Initial Data ====================

-- Insert initial activity log entry
INSERT INTO activity_log (project_id, action_type, action_target, action_details)
VALUES
    (NULL, 'system', 'database_initialized', '{"version": "1.0.0"}')
ON CONFLICT DO NOTHING;

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Shelly database initialized successfully!';
END $$;

-- Shelly Database Schema
-- GitHub Project Manager AI Agent

-- Projects (GitHub repositories being tracked)
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    github_repo VARCHAR(255) NOT NULL UNIQUE,  -- e.g., "owner/repo"
    owner VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_branch VARCHAR(100) DEFAULT 'main',
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_owner ON projects(owner);
CREATE INDEX idx_projects_active ON projects(is_active);

-- Issue snapshots (cached issue data for analysis)
CREATE TABLE IF NOT EXISTS issue_snapshots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    github_issue_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    state VARCHAR(20) NOT NULL,  -- open, closed
    labels JSONB DEFAULT '[]',
    assignees JSONB DEFAULT '[]',
    milestone VARCHAR(100),
    author VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, github_issue_number, snapshot_at)
);

CREATE INDEX idx_issue_snapshots_project ON issue_snapshots(project_id);
CREATE INDEX idx_issue_snapshots_state ON issue_snapshots(state);
CREATE INDEX idx_issue_snapshots_snapshot_at ON issue_snapshots(snapshot_at);

-- Pull request snapshots
CREATE TABLE IF NOT EXISTS pr_snapshots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    github_pr_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    state VARCHAR(20) NOT NULL,  -- open, closed, merged
    base_branch VARCHAR(100),
    head_branch VARCHAR(100),
    author VARCHAR(100),
    reviewers JSONB DEFAULT '[]',
    review_state VARCHAR(50),  -- pending, approved, changes_requested
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    changed_files INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    merged_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, github_pr_number, snapshot_at)
);

CREATE INDEX idx_pr_snapshots_project ON pr_snapshots(project_id);
CREATE INDEX idx_pr_snapshots_state ON pr_snapshots(state);
CREATE INDEX idx_pr_snapshots_snapshot_at ON pr_snapshots(snapshot_at);

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

CREATE INDEX idx_daily_reports_project ON daily_reports(project_id);
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);

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

CREATE INDEX idx_weekly_reports_project ON weekly_reports(project_id);
CREATE INDEX idx_weekly_reports_week ON weekly_reports(week_start);

-- Milestone tracking
CREATE TABLE IF NOT EXISTS milestone_tracking (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    github_milestone_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    due_date DATE,
    state VARCHAR(20) DEFAULT 'open',
    total_issues INTEGER DEFAULT 0,
    closed_issues INTEGER DEFAULT 0,
    open_issues INTEGER DEFAULT 0,
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    estimated_completion DATE,
    risk_level VARCHAR(20),  -- on_track, at_risk, delayed
    notes TEXT,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, github_milestone_number, snapshot_at)
);

CREATE INDEX idx_milestone_tracking_project ON milestone_tracking(project_id);
CREATE INDEX idx_milestone_tracking_state ON milestone_tracking(state);

-- Activity log (audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,  -- issue_triaged, pr_reviewed, report_generated, etc.
    action_target VARCHAR(255),  -- e.g., "issue #123"
    action_details JSONB DEFAULT '{}',
    performed_by VARCHAR(100) DEFAULT 'shelly',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_project ON activity_log(project_id);
CREATE INDEX idx_activity_log_action ON activity_log(action_type);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

-- DEPRECATED: Replaced by Temporal Schedules (see src/temporal/).
-- Kept for backward compatibility. Do not add new references.
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,  -- daily_report, weekly_report, stale_check, etc.
    schedule VARCHAR(100) NOT NULL,  -- cron expression
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    is_enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scheduled_tasks_project ON scheduled_tasks(project_id);
CREATE INDEX idx_scheduled_tasks_enabled ON scheduled_tasks(is_enabled);
CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(next_run);

-- Notifications sent
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,  -- email, slack, github_comment
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_project ON notifications(project_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- Related issues tracking (for duplicate detection)
CREATE TABLE IF NOT EXISTS related_issues (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    issue_a INTEGER NOT NULL,
    issue_b INTEGER NOT NULL,
    relation_type VARCHAR(50) NOT NULL,  -- duplicate, related, blocks, blocked_by
    confidence DECIMAL(3,2),  -- 0.00 to 1.00
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_by VARCHAR(100),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(project_id, issue_a, issue_b, relation_type)
);

CREATE INDEX idx_related_issues_project ON related_issues(project_id);
CREATE INDEX idx_related_issues_a ON related_issues(issue_a);
CREATE INDEX idx_related_issues_b ON related_issues(issue_b);

-- Contributor stats cache
CREATE TABLE IF NOT EXISTS contributor_stats (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    commits INTEGER DEFAULT 0,
    prs_opened INTEGER DEFAULT 0,
    prs_merged INTEGER DEFAULT 0,
    prs_reviewed INTEGER DEFAULT 0,
    issues_opened INTEGER DEFAULT 0,
    issues_closed INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    lines_added INTEGER DEFAULT 0,
    lines_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, username, period_start, period_end)
);

CREATE INDEX idx_contributor_stats_project ON contributor_stats(project_id);
CREATE INDEX idx_contributor_stats_user ON contributor_stats(username);
CREATE INDEX idx_contributor_stats_period ON contributor_stats(period_start, period_end);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_tasks_updated_at
    BEFORE UPDATE ON scheduled_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

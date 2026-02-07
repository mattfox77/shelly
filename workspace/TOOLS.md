# Shelly's Tools

## GitHub Operations

### list_issues
List issues from a repository with optional filters.
```typescript
list_issues(repo: string, filters?: {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
  milestone?: string;
  since?: string;
})
```

### get_issue
Get detailed information about a specific issue.
```typescript
get_issue(repo: string, issue_number: number)
```

### create_issue
Create a new issue in a repository.
```typescript
create_issue(repo: string, title: string, body: string, options?: {
  labels?: string[];
  assignees?: string[];
  milestone?: number;
})
```

### update_issue
Update an existing issue.
```typescript
update_issue(repo: string, issue_number: number, updates: {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  assignees?: string[];
  milestone?: number;
})
```

### add_comment
Add a comment to an issue or pull request.
```typescript
add_comment(repo: string, issue_number: number, body: string)
```

### list_pull_requests
List pull requests from a repository.
```typescript
list_pull_requests(repo: string, filters?: {
  state?: 'open' | 'closed' | 'all';
  base?: string;
  head?: string;
  sort?: 'created' | 'updated' | 'popularity';
})
```

### get_pull_request
Get detailed information about a pull request including diff stats.
```typescript
get_pull_request(repo: string, pr_number: number)
```

### list_pr_reviews
List reviews on a pull request.
```typescript
list_pr_reviews(repo: string, pr_number: number)
```

### request_reviewers
Request reviewers for a pull request.
```typescript
request_reviewers(repo: string, pr_number: number, reviewers: string[])
```

### list_commits
List commits in a repository or pull request.
```typescript
list_commits(repo: string, options?: {
  sha?: string;
  path?: string;
  since?: string;
  until?: string;
  pr_number?: number;
})
```

### get_file_contents
Get contents of a file from the repository.
```typescript
get_file_contents(repo: string, path: string, ref?: string)
```

### search_code
Search for code across repositories.
```typescript
search_code(query: string, options?: {
  repo?: string;
  language?: string;
  path?: string;
})
```

### search_issues
Search issues and pull requests.
```typescript
search_issues(query: string, options?: {
  repo?: string;
  type?: 'issue' | 'pr';
  state?: 'open' | 'closed';
})
```

## Project Management

### list_milestones
List milestones in a repository.
```typescript
list_milestones(repo: string, state?: 'open' | 'closed' | 'all')
```

### get_milestone_progress
Get progress statistics for a milestone.
```typescript
get_milestone_progress(repo: string, milestone_number: number)
```

### list_labels
List all labels in a repository.
```typescript
list_labels(repo: string)
```

### add_labels
Add labels to an issue.
```typescript
add_labels(repo: string, issue_number: number, labels: string[])
```

## Reporting

### generate_daily_report
Generate a daily summary report for a repository.
```typescript
generate_daily_report(repo: string, date?: string)
```

### generate_weekly_report
Generate a weekly summary report.
```typescript
generate_weekly_report(repo: string, week_start?: string)
```

### get_contributor_stats
Get contribution statistics for repository contributors.
```typescript
get_contributor_stats(repo: string, since?: string)
```

### get_velocity_metrics
Calculate velocity metrics (issues closed, PRs merged per time period).
```typescript
get_velocity_metrics(repo: string, period: 'day' | 'week' | 'month')
```

## Notifications

### send_notification
Send a notification via configured channels (email, Slack, etc.).
```typescript
send_notification(channel: 'email' | 'slack', recipient: string, message: {
  subject: string;
  body: string;
  priority?: 'low' | 'normal' | 'high';
})
```

### schedule_reminder
Schedule a reminder for a future time.
```typescript
schedule_reminder(target: string, message: string, when: string)
```

## Data Persistence

### save_project_state
Save current project state to database.
```typescript
save_project_state(repo: string, state: ProjectState)
```

### get_project_history
Get historical project data for trend analysis.
```typescript
get_project_history(repo: string, metric: string, period: string)
```

### log_activity
Log an activity for audit trail.
```typescript
log_activity(repo: string, action: string, details: object)
```

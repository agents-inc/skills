# Agent Metrics

## Purpose

Track which agents are being called and whether they're the right choice for each task.

## How It Works

Each agent automatically appends an entry to `.claude/agent-metrics.json` at the end of their work.

## File Format

Simple JSON array of entries:

```json
[
  {
    "date": "2025-11-19",
    "agent": "pm",
    "task": "Add user profile editing",
    "wasAppropriate": true,
    "why": "New feature needs spec first",
    "outputs": [".claude/specs/_active/profile-editing.md"],
    "successCriteriaDefined": true,
    "patternsReferenced": ["SettingsForm.tsx:45-89"],
    "issues": "none"
  },
  {
    "date": "2025-11-19",
    "agent": "developer",
    "task": "Implement profile editing",
    "wasAppropriate": true,
    "why": "Had spec from PM, implemented it",
    "outputs": ["ProfileEditModal.tsx", "UserProfile.tsx"],
    "hadSpec": true,
    "readPatternFiles": true,
    "testsRan": true,
    "testsPassed": true,
    "issues": "none"
  },
  {
    "date": "2025-11-18",
    "agent": "pm",
    "task": "Fix button color bug",
    "wasAppropriate": false,
    "why": "Simple bug fix didn't need PM - should have used developer directly",
    "outputs": [],
    "issues": "Wasted time creating spec for trivial fix"
  }
]
```

## Review Commands

```bash
# View all entries
cat .claude/agent-metrics.json | jq

# See inappropriate agent calls
cat .claude/agent-metrics.json | jq '.[] | select(.wasAppropriate == false)'

# Count by agent
cat .claude/agent-metrics.json | jq 'group_by(.agent) | map({agent: .[0].agent, count: length})'

# Recent entries (last 5)
cat .claude/agent-metrics.json | jq '.[-5:]'

# Entries with issues
cat .claude/agent-metrics.json | jq '.[] | select(.issues != "none")'
```

## What to Look For

After a few days of usage:

1. **Inappropriate calls** - `wasAppropriate: false` entries
   - Are you calling PM for simple fixes?
   - Are you calling developer without specs?
   - Are reviewers being called at the wrong time?

2. **Missing patterns** - Agents not being used when they should be
   - Is pattern-scout never called? (missing pattern documentation)
   - Is TDD never called? (no test-first development)
   - Are reviewers skipped? (quality gates missing)

3. **Common issues** - Same problems appearing repeatedly
   - Specs missing pattern references?
   - Tests not being run?
   - Context files not being updated?

## Agent Selection Guide

| Task | Right Agent | Wrong Agent |
|------|------------|-------------|
| New feature | PM → developer → reviewer | developer (no spec) |
| Simple bug fix | developer | PM (overkill) |
| Extract patterns | pattern-scout | developer |
| Test-first workflow | TDD → reviewer | developer → TDD (backwards) |
| React code review | reviewer-react | reviewer-general |
| General code review | reviewer-general | reviewer-react |
| Pattern enforcement | pattern-critique | reviewer-general |

## Cleanup

After reviewing, you can:

```bash
# Archive old entries
cat .claude/agent-metrics.json | jq '.[-100:]' > .claude/agent-metrics.json

# Start fresh
echo '[]' > .claude/agent-metrics.json
```

# Observability - Axiom Monitors and Debugging

> APL queries for monitoring, alerting, and debugging. Back to [SKILL.md](../SKILL.md) | See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [correlation-ids.md](correlation-ids.md) for request tracing context.

---

## Pattern: Axiom Monitors

### Error Rate Monitor

```apl
// Axiom APL - Error rate alert (> 1% errors)
['myapp-prod']
| where _time > ago(5m)
| summarize
    total = count(),
    errors = countif(level == "error")
| extend error_rate = todouble(errors) / todouble(total) * 100
| where error_rate > 1
```

### Latency Monitor

```apl
// Axiom APL - P95 latency alert (> 2 seconds)
['myapp-prod']
| where _time > ago(5m)
| where isnotnull(duration)
| summarize p95 = percentile(duration, 95)
| where p95 > 2000
```

### Specific Error Monitor

```apl
// Axiom APL - Database connection errors
['myapp-prod']
| where _time > ago(5m)
| where level == "error"
| where message contains "database" or message contains "connection"
| summarize count() by bin(_time, 1m)
| where count_ > 5
```

---

## Pattern: Monitor Configuration in Axiom

1. **Error Rate Alert**
   - Query: Error rate > 1% over 5 minutes
   - Severity: Warning
   - Notification: Slack #alerts channel

2. **High Latency Alert**
   - Query: P95 > 2000ms over 5 minutes
   - Severity: Warning
   - Notification: Slack #alerts channel

3. **Database Errors Alert**
   - Query: > 5 database errors in 1 minute
   - Severity: Critical
   - Notification: PagerDuty + Slack

---

## Pattern: Debugging Guide - Tracing a Request

### Step 1: Get Correlation ID

Find the correlation ID from:
- Response headers: `x-correlation-id`
- Error reports in Sentry
- User-reported issue (if client shows correlation ID)

### Step 2: Search Axiom

```apl
// Find all logs for a specific request
['myapp-prod']
| where correlationId == "abc-123-def-456"
| order by _time asc
```

### Step 3: Analyze Request Flow

```apl
// See request timeline with duration
['myapp-prod']
| where correlationId == "abc-123-def-456"
| project _time, level, operation, message, duration
| order by _time asc
```

### Step 4: Find Related Errors

```apl
// Get error details and stack traces
['myapp-prod']
| where correlationId == "abc-123-def-456"
| where level == "error"
| project _time, message, error, stack
```

### Step 5: Check Sentry

If an error was captured:
1. Search Sentry by correlation ID tag
2. Review stack trace with source maps
3. Check user context and breadcrumbs
4. View session replay if available

---

## Debugging Checklist

- [ ] Get correlation ID from error/user report
- [ ] Search Axiom for request timeline
- [ ] Identify where request failed
- [ ] Check error details and stack trace
- [ ] Review related database queries
- [ ] Check external service calls
- [ ] Verify user context in Sentry

---

_See [core.md](core.md) for foundational patterns: Log Levels, Structured Logging._

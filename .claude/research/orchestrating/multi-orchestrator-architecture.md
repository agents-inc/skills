# Multi-Orchestrator Architecture: Research & Analysis

## Executive Summary

This document analyzes approaches to extend the current single-orchestrator system to support multiple simultaneous orchestration agents. The goal is to enable parallel orchestration pipelines while avoiding conflicts, maintaining consistency, and enabling cross-orchestrator coordination when needed.

**Key Finding:** A hybrid approach combining hierarchical orchestration with file-based coordination provides the best balance of simplicity, scalability, and reliability for the Claude subagent ecosystem.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Problem Space](#2-problem-space)
3. [Multi-Orchestrator Patterns](#3-multi-orchestrator-patterns)
4. [Conflict Avoidance Strategies](#4-conflict-avoidance-strategies)
5. [State Coordination Mechanisms](#5-state-coordination-mechanisms)
6. [Communication Patterns](#6-communication-patterns)
7. [Scalability Considerations](#7-scalability-considerations)
8. [Implementation Approaches](#8-implementation-approaches)
9. [Recommendations](#9-recommendations)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Current Architecture Analysis

### 1.1 File-Based State Management

The current orchestrator uses a file-based state system:

```
.claude/
├── orchestrator-status.json     # Primary status (watched by main Claude)
├── orchestrator-queue.json      # Inbound task queue
└── orchestrator/
    ├── DASHBOARD.md             # Human-readable dashboard
    └── tasks/
        ├── 001-task-name.md     # Individual task files
        ├── 002-task-name.md
        └── ...
```

### 1.2 Current Limitations for Multi-Orchestrator

| Limitation | Description | Impact |
|------------|-------------|--------|
| **Single Status File** | `orchestrator-status.json` assumes one writer | Write conflicts, data loss |
| **Linear Task IDs** | Simple incrementing (001, 002...) | ID collisions between orchestrators |
| **No Identity** | Orchestrator has no unique identifier | Cannot track which orchestrator owns which task |
| **No Coordination** | No mechanism for orchestrators to communicate | Duplicate work, conflicting actions |
| **Shared Dashboard** | Single DASHBOARD.md for all state | Merge conflicts, unclear ownership |

### 1.3 Current Communication Flow

```
                    Single Orchestrator Model
                    ========================

User ──> Main Claude ──> orchestrator-queue.json ──> Orchestrator
                                                          │
                              ┌─────────────────┬─────────┼─────────┬─────────────────┐
                              ▼                 ▼         ▼         ▼                 ▼
                         Agent A           Agent B   Agent C   Agent D           Agent E
                              │                 │         │         │                 │
                              └─────────────────┴─────────┴─────────┴─────────────────┘
                                                          │
                    ◄──────── orchestrator-status.json ◄──┘
```

---

## 2. Problem Space

### 2.1 Why Multiple Orchestrators?

| Scenario | Single Orchestrator Problem | Multi-Orchestrator Solution |
|----------|----------------------------|----------------------------|
| **Parallel Workstreams** | Sequential processing bottleneck | Dedicated orchestrator per workstream |
| **Domain Isolation** | One orchestrator manages all domains | Frontend orchestrator, backend orchestrator |
| **Fault Tolerance** | Single point of failure | Redundant orchestrators, failover |
| **Scaling** | Context limit on one orchestrator | Distribute cognitive load |
| **Priority Lanes** | Everything in one queue | Fast lane vs background lane |

### 2.2 Core Challenges

**Challenge 1: Task Ownership**
- Which orchestrator owns which task?
- How to prevent duplicate task pickup?
- How to handle task handoffs?

**Challenge 2: Resource Contention**
- File write conflicts (status.json, dashboard, task files)
- Agent availability (can two orchestrators use same agent type?)
- Output file conflicts

**Challenge 3: Dependency Resolution**
- Task A (orchestrator 1) depends on Task B (orchestrator 2)
- How do orchestrators know about each other's tasks?
- How to synchronize completion?

**Challenge 4: Visibility**
- Main Claude needs unified view of all orchestrators
- User needs single dashboard
- How to aggregate status?

---

## 3. Multi-Orchestrator Patterns

### 3.1 Pattern A: Hierarchical Orchestration

```
                    Hierarchical Model
                    ==================

                      Meta-Orchestrator
                   (coordinates domains)
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
   Frontend-Orch      Backend-Orch      Test-Orch
        │                   │                 │
   ┌────┴────┐         ┌────┴────┐       ┌────┴────┐
   ▼         ▼         ▼         ▼       ▼         ▼
Agent A   Agent B   Agent C   Agent D   Agent E   Agent F
```

**Characteristics:**
- Clear hierarchy with meta-orchestrator at top
- Domain-specific sub-orchestrators
- Delegation flows down, status flows up
- Cross-domain dependencies managed at meta level

**File Structure:**
```
.claude/
├── meta-orchestrator-status.json    # Global status aggregator
├── orchestrators/
│   ├── frontend/
│   │   ├── status.json
│   │   ├── queue.json
│   │   └── tasks/
│   ├── backend/
│   │   ├── status.json
│   │   ├── queue.json
│   │   └── tasks/
│   └── testing/
│       ├── status.json
│       ├── queue.json
│       └── tasks/
└── DASHBOARD.md                     # Unified view
```

**Pros:**
- Clear ownership boundaries
- Scalable to many domains
- Natural task routing based on domain
- Cross-domain dependencies explicit

**Cons:**
- Meta-orchestrator becomes bottleneck
- More complex setup
- Overhead for simple tasks

### 3.2 Pattern B: Peer Orchestration Network

```
                    Peer Model
                    ==========

         ┌──────────────────────────────────────┐
         │           Message Bus                │
         │   (shared state + event queue)       │
         └──────────────────────────────────────┘
                  ▲         ▲         ▲
                  │         │         │
          ┌───────┴──┐  ┌───┴───┐  ┌──┴───────┐
          │ Orch-1   │  │ Orch-2│  │  Orch-3  │
          │ (claims  │  │(claims│  │ (claims  │
          │  tasks)  │  │ tasks)│  │  tasks)  │
          └───────┬──┘  └───┬───┘  └──┬───────┘
                  │         │         │
                  ▼         ▼         ▼
              Agents    Agents    Agents
```

**Characteristics:**
- No hierarchy; all orchestrators equal peers
- Task claiming via distributed lock/claim mechanism
- Event-based coordination
- Any orchestrator can pick up any task

**File Structure:**
```
.claude/
├── message-bus/
│   ├── events.json              # Event log (append-only)
│   ├── claims.json              # Task claim registry
│   └── heartbeats.json          # Orchestrator liveness
├── orchestrators/
│   ├── orch-001/
│   │   ├── status.json
│   │   └── tasks/
│   ├── orch-002/
│   │   ├── status.json
│   │   └── tasks/
│   └── ...
└── DASHBOARD.md                 # Aggregated view
```

**Pros:**
- No single point of failure
- Natural load balancing
- Flexible scaling
- Resilient to orchestrator failures

**Cons:**
- Complex coordination logic
- Potential for race conditions
- Harder to debug
- Requires robust claiming mechanism

### 3.3 Pattern C: Work-Stealing Queue

```
                    Work-Stealing Model
                    ====================

         ┌────────────────────────────────────────────┐
         │              Global Task Queue             │
         │  (priority-ordered, unclaimed tasks)       │
         └────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │ Orch-1  │       │ Orch-2  │       │ Orch-3  │
    │┌───────┐│       │┌───────┐│       │┌───────┐│
    ││ Local ││       ││ Local ││       ││ Local ││
    ││ Queue ││  ◄──► ││ Queue ││  ◄──► ││ Queue ││
    │└───────┘│       │└───────┘│       │└───────┘│
    └─────────┘       └─────────┘       └─────────┘
         │                 │                 │
    Agents              Agents            Agents
```

**Characteristics:**
- Global queue for unclaimed tasks
- Orchestrators pull from global, push to local
- Idle orchestrators can \"steal\" from busy peers
- Priority-based task selection

**File Structure:**
```
.claude/
├── global-queue.json             # Unclaimed tasks
├── global-status.json            # Aggregated status
├── orchestrators/
│   ├── orch-001/
│   │   ├── local-queue.json      # Claimed/active tasks
│   │   ├── status.json
│   │   └── tasks/
│   └── ...
└── DASHBOARD.md
```

**Pros:**
- Automatic load balancing
- No orchestrator sits idle while work exists
- Simple task distribution
- Good for homogeneous workloads

**Cons:**
- Complex stealing logic
- May not respect task affinity
- Harder to predict which orchestrator handles what

---

## 4. Conflict Avoidance Strategies

### 4.1 Namespace Isolation

Each orchestrator operates in its own namespace:

```json
// Task ID format: {orchestrator-id}-{sequence}
{
  \"id\": \"frontend-orch-001\",
  \"task\": \"Implement header component\"
}

{
  \"id\": \"backend-orch-001\",
  \"task\": \"Add auth middleware\"
}
```

**Implementation:**
- Orchestrator ID prefix on all task IDs
- Separate task directories per orchestrator
- No ID collision possible

### 4.2 Optimistic Locking with Version Numbers

```json
// status.json with version control
{
  \"version\": 42,
  \"updated\": \"2025-12-17T10:30:00Z\",
  \"orchestrators\": {
    \"frontend-orch\": {
      \"version\": 15,
      \"active\": [...]
    }
  }
}
```

**Workflow:**
1. Read current version
2. Make changes locally
3. Write with version check
4. If version mismatch, re-read and retry

### 4.3 Lock Files

```
.claude/
├── locks/
│   ├── status.lock              # Lock for status file
│   ├── queue.lock               # Lock for queue file
│   └── tasks/
│       └── 001.lock             # Per-task locks
```

**Implementation:**
```
Lock acquisition:
1. Check if .lock file exists
2. If exists, check timestamp (stale after 60s?)
3. If stale or absent, create .lock with orchestrator ID + timestamp
4. Perform operation
5. Delete .lock file
```

**Lock file format:**
```json
{
  \"holder\": \"frontend-orch\",
  \"acquired\": \"2025-12-17T10:30:00Z\",
  \"operation\": \"update-status\"
}
```

### 4.4 Append-Only Event Log

Instead of modifying shared state, use immutable events:

```json
// events.json (append-only)
[
  {\"seq\": 1, \"type\": \"TASK_CREATED\", \"orchestrator\": \"frontend-orch\", \"task\": {...}},
  {\"seq\": 2, \"type\": \"TASK_CLAIMED\", \"orchestrator\": \"frontend-orch\", \"task_id\": \"001\,
  {\"seq\": 3, \"type\": \"TASK_STARTED\", \"orchestrator\": \"frontend-orch\", \"task_id\": \"001\"},
  {\"seq\": 4, \"type\": \"TASK_COMPLETED\", \"orchestrator\": \"frontend-orch\", \"task_id\": \"001\", \"result\": \"SUCCESS\"}
]
```

**Benefits:**
- No write conflicts (append-only)
- Full audit trail
- Easy to reconstruct state
- Natural event sourcing

**Deriving current state:**
```
function getCurrentState(events):
  state = {}
  for event in events:
    apply(state, event)
  return state
```

---

## 5. State Coordination Mechanisms

### 5.1 Shared State File

**Single file approach (current):**
```json
// orchestrator-status.json
{
  \"active\": [...],
  \"queued\": [...],
  \"recent\": [...]
}
```

**Multi-orchestrator extension:**
```json
// orchestrator-status.json (extended)
{
  \"orchestrators\": {
    \"frontend-orch\": {
      \"id\": \"frontend-orch\",
      \"status\": \"RUNNING\",
      \"last_heartbeat\": \"2025-12-17T10:30:00Z\",
      \"active\": [...],
      \"queued\": [...],
      \"recent\": [...]
    },
    \"backend-orch\": {
      \"id\": \"backend-orch\",
      \"status\": \"RUNNING\",
      \"last_heartbeat\": \"2025-12-17T10:29:45Z\",
      \"active\": [...],
      \"queued\": [...],
      \"recent\": [...]
    }
  },
  \"global_summary\": {
    \"total_active\": 4,
    \"total_queued\": 7,
    \"orchestrators_online\": 2
  }
}
```

### 5.2 Per-Orchestrator Status Files

Each orchestrator maintains its own status file:

```
.claude/orchestrators/
├── frontend-orch/
│   └── status.json
├── backend-orch/
│   └── status.json
└── aggregate-status.json      # Periodically aggregated
```

**Aggregation mechanism:**
- Main Claude reads all `*/status.json` files
- Builds aggregate view on demand
- No write coordination needed

### 5.3 Watch Files

A lightweight coordination mechanism:

```
.claude/watch/
├── frontend-orch.heartbeat    # Last modified = liveness
├── backend-orch.heartbeat
└── needs-attention.flag       # Signals to main Claude
```

**Heartbeat protocol:**
1. Each orchestrator touches its heartbeat file every 30s
2. Main Claude checks file timestamps
3. Stale heartbeat (>2 min) = orchestrator presumed dead
4. Main Claude can reassign orphaned tasks

---

## 6. Communication Patterns

### 6.1 Direct File Messaging

Orchestrators communicate via file drops:

```
.claude/messages/
├── to-frontend-orch/
│   └── msg-001.json
├── to-backend-orch/
│   └── msg-002.json
└── broadcast/
    └── msg-003.json
```

**Message format:**
```json
{
  \"id\": \"msg-001\",
  \"from\": \"backend-orch\",
  \"to\": \"frontend-orch\",
  \"type\": \"TASK_DEPENDENCY_READY\",
  \"payload\": {
    \"task_id\": \"backend-orch-042\",
    \"result\": \"SUCCESS\",
    \"outputs\": [\"api/auth.ts\"]
  },
  \"timestamp\": \"2025-12-17T10:30:00Z\"
}
```

**Protocol:**
1. Sender writes message to recipient's inbox
2. Recipient polls inbox periodically
3. Recipient deletes message after processing
4. Sender can poll for acknowledgment

### 6.2 Event Bus (Append-Only Log)

```json
// .claude/event-bus.json
{
  \"last_sequence\": 156,
  \"events\": [
    {\"seq\": 155, \"type\": \"TASK_COMPLETED\", \"source\": \"backend-orch\", \"task_id\": \"...\"},
    {\"seq\": 156, \"type\": \"DEPENDENCY_SATISFIED\", \"source\": \"system\", \"blocked\": \"frontend-orch-012\"}
  ]
}
```

**Consumption pattern:**
- Each orchestrator tracks last processed sequence
- On poll, read events with seq > last_processed
- Process in order, update last_processed

### 6.3 Request-Response via Files

For synchronous coordination:

```
.claude/rpc/
├── requests/
│   └── req-001.json           # Request from orchestrator A
└── responses/
    └── req-001-response.json  # Response from orchestrator B
```

**Request:**
```json
{
  \"request_id\": \"req-001\",
  \"from\": \"frontend-orch\",
  \"to\": \"backend-orch\",
  \"method\": \"GET_TASK_STATUS\",
  \"params\": {\"task_id\": \"backend-orch-042\"},
  \"timeout_ms\": 30000
}
```

**Response:**
```json
{
  \"request_id\": \"req-001\",
  \"status\": \"SUCCESS\",
  \"result\": {\"task_status\": \"COMPLETE\", \"output_files\": [...]}
}
```

---

## 7. Scalability Considerations

### 7.1 Task Distribution Strategies

**Strategy 1: Domain-Based Routing**
```
Task routing rules:
- Contains \"React|component|UI|frontend\" -> frontend-orch
- Contains \"API|database|server|backend\" -> backend-orch
- Contains \"test|spec|e2e\" -> test-orch
- Default -> general-orch
```

**Strategy 2: Round-Robin**
```
next_orchestrator = orchestrators[task_count % len(orchestrators)]
```

**Strategy 3: Least-Loaded**
```
next_orchestrator = min(orchestrators, key=lambda o: o.active_count)
```

**Strategy 4: Affinity-Based**
```
# Prefer orchestrator that handled related tasks
if task.related_to in orchestrator.recent_tasks:
    return orchestrator
```

### 7.2 Load Balancing

**Metrics to track:**
- Active task count per orchestrator
- Task completion rate
- Average task duration
- Orchestrator responsiveness (heartbeat lag)

**Load balancing file:**
```json
// .claude/load-balancer.json
{
  \"orchestrators\": {
    \"frontend-orch\": {
      \"active_tasks\": 3,
      \"max_capacity\": 5,
      \"avg_completion_time_ms\": 45000,
      \"load_score\": 0.6
    },
    \"backend-orch\": {
      \"active_tasks\": 1,
      \"max_capacity\": 5,
      \"avg_completion_time_ms\": 60000,
      \"load_score\": 0.2
    }
  },
  \"routing_preference\": \"backend-orch\"
}
```

### 7.3 Cross-Orchestrator Dependencies

**Dependency tracking:**
```json
// .claude/dependencies.json
{
  \"dependencies\": [
    {
      \"blocked_task\": \"frontend-orch-012\",
      \"waiting_on\": \"backend-orch-042\",
      \"type\": \"SEQUENTIAL\",
      \"created\": \"2025-12-17T10:25:00Z\"
    }
  ]
}
```

**Resolution workflow:**
1. Orchestrator A creates task with dependency on task in Orchestrator B
2. Writes dependency record to dependencies.json
3. Orchestrator B completes its task, writes to event bus
4. Orchestrator A (or dependency watcher) sees completion
5. Dependency marked resolved, blocked task unblocked

### 7.4 Failure Handling

**Orchestrator failure scenarios:**

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Crash mid-task | Stale heartbeat | Reassign active tasks |
| Hung orchestrator | No progress on active tasks | Alert + manual intervention |
| Context exhaustion | Orchestrator self-reports | Handoff to fresh instance |
| Task failure | Task marked FAILED | Surface to user or retry |

**Orphan task recovery:**
```json
// .claude/orphaned-tasks.json (maintained by supervisor/main Claude)
{
  \"orphaned\": [
    {
      \"task_id\": \"frontend-orch-012\",
      \"original_orchestrator\": \"frontend-orch\",
      \"orphaned_at\": \"2025-12-17T10:30:00Z\",
      \"reason\": \"orchestrator_timeout\",
      \"reassigned_to\": null
    }
  ]
}
```

---

## 8. Implementation Approaches

### 8.1 Approach A: Separate Namespaces (Simplest)

**Overview:** Each orchestrator has complete isolation. No shared state.

**File Structure:**
```
.claude/
├── orchestrators/
│   ├── frontend/
│   │   ├── status.json
│   │   ├── queue.json
│   │   ├── DASHBOARD.md
│   │   └── tasks/
│   └── backend/
│       ├── status.json
│       ├── queue.json
│       ├── DASHBOARD.md
│       └── tasks/
└── aggregate-dashboard.md   # Main Claude builds this on demand
```

**Coordination:** Main Claude manually routes tasks and aggregates status.

**Pros:**
- Zero coordination logic needed
- Each orchestrator identical to current implementation
- No conflict possible

**Cons:**
- No automatic load balancing
- Cross-orchestrator dependencies manual
- Duplication of dashboard

### 8.2 Approach B: Hierarchical with Meta-Orchestrator

**Overview:** Meta-orchestrator coordinates domain-specific sub-orchestrators.

**File Structure:**
```
.claude/
├── meta-status.json              # Global state
├── task-router.json              # Routing rules
├── dependencies.json             # Cross-domain dependencies
├── orchestrators/
│   ├── frontend/...
│   ├── backend/...
│   └── testing/...
└── DASHBOARD.md                  # Unified dashboard
```

**Meta-orchestrator responsibilities:**
1. Route incoming tasks to appropriate sub-orchestrator
2. Track cross-domain dependencies
3. Aggregate status for main Claude
4. Handle sub-orchestrator failures

**Sub-orchestrator changes:**
1. Report status to meta-orchestrator (not main Claude)
2. Accept routed tasks (not from queue.json)
3. Signal completion to meta for dependency resolution

**Pros:**
- Clear delegation structure
- Natural domain isolation
- Centralized dependency management
- Single dashboard

**Cons:**
- Meta-orchestrator complexity
- Additional layer of coordination
- Meta becomes bottleneck

### 8.3 Approach C: Peer Network with Event Bus

**Overview:** Equal-peer orchestrators coordinate via shared event bus.

**File Structure:**
```
.claude/
├── event-bus.json                # Append-only event log
├── claims.json                   # Task claim registry
├── task-pool.json                # Unclaimed tasks
├── orchestrators/
│   ├── orch-001/
│   │   ├── status.json
│   │   ├── last-processed-seq
│   │   └── tasks/
│   └── orch-002/...
└── DASHBOARD.md                  # Derived from event bus
```

**Protocol:**
1. New task -> written to task-pool.json
2. Orchestrator claims task (atomic write to claims.json)
3. On claim success, orchestrator moves task to local
4. Progress events written to event-bus.json
5. Other orchestrators see events, update their view

**Claim mechanism:**
```json
// claims.json
{
  \"claims\": {
    \"task-001\": {
      \"claimed_by\": \"orch-001\",
      \"claimed_at\": \"2025-12-17T10:30:00Z\"
    }
  }
}
```

**Claim protocol:**
1. Read claims.json
2. Check if task already claimed
3. If not, write claim with orchestrator ID
4. Re-read to verify (optimistic locking)
5. If conflict, back off and retry

**Pros:**
- No single point of failure
- Automatic load balancing
- Scalable to many orchestrators
- Event history for debugging

**Cons:**
- Complex claiming logic
- Potential race conditions
- Event bus can grow large
- All orchestrators must process all events

---

## 9. Recommendations

### 9.1 Recommended Architecture: Hierarchical Hybrid

Based on analysis, I recommend a **hierarchical approach with file-based coordination**:

```
                 Recommended Architecture
                 ========================

                      Main Claude
                    (user interface)
                           │
                           ▼
                ┌──────────────────────┐
                │   Meta-Orchestrator  │
                │  (routing + deps)    │
                └──────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   Frontend-Orch      Backend-Orch      Test-Orch
   (domain scope)     (domain scope)    (domain scope)
         │                 │                 │
     Agents            Agents            Agents
```

### 9.2 Rationale

| Factor | Why Hierarchical Hybrid |
|--------|-------------------------|
| **Complexity** | Simpler than peer network, more powerful than isolated namespaces |
| **Scalability** | Domains can have independent sub-orchestrators |
| **Visibility** | Single meta-orchestrator provides unified view |
| **Existing Code** | Minimal changes to current orchestrator agent |
| **Dependencies** | Meta-orchestrator naturally handles cross-domain deps |
| **Failure** | Domain failures isolated; meta can reassign |

### 9.3 Key Design Decisions

**1. Domain Boundaries**
- Frontend: React components, styling, client state
- Backend: API routes, database, auth, middleware
- Testing: All test types, E2E, coverage
- General: Cross-cutting, documentation, architecture

**2. Task Routing**
```yaml
# task-router.yaml
routes:
  - pattern: \"React|component|UI|JSX|TSX|CSS|SCSS\"
    target: frontend-orch
  - pattern: \"API|route|database|auth|middleware|server\"
    target: backend-orch
  - pattern: \"test|spec|e2e|coverage|assert\"
    target: test-orch
  - pattern: \"*\"
    target: general-orch
```

**3. Cross-Domain Dependencies**
- Explicitly declared in task definition
- Meta-orchestrator tracks and resolves
- Blocking is visible in dashboard

**4. Status Aggregation**
- Each sub-orchestrator writes own status.json
- Meta-orchestrator aggregates on poll
- Main Claude sees unified dashboard

---

## 10. Implementation Roadmap

### Phase 1: Foundation (2-4 hours)

**Goal:** Establish multi-orchestrator file structure without changing behavior.

**Tasks:**
1. Create new directory structure:
   ```
   .claude/orchestrators/{domain}/
   ```
2. Add orchestrator identity to existing orchestrator:
   ```json
   {
     \"orchestrator_id\": \"default\",
     \"domain\": \"general\"
   }
   ```
3. Update status.json format to include orchestrator ID
4. Create aggregation script for unified dashboard

**Deliverable:** Single orchestrator works with new structure; ready for multi.

### Phase 2: Domain Orchestrators (4-6 hours)

**Goal:** Create domain-specific orchestrator variants.

**Tasks:**
1. Create orchestrator agent variants in agents.yaml:
   - `frontend-orchestrator`
   - `backend-orchestrator`
   - `test-orchestrator`
2. Each variant has:
   - Own task routing preferences
   - Own status file location
   - Domain-specific boilerplate injection
3. Update main Claude interface to route to appropriate orchestrator

**Deliverable:** Multiple orchestrators can run independently.

### Phase 3: Meta-Orchestrator (4-6 hours)

**Goal:** Add coordination layer.

**Tasks:**
1. Create `meta-orchestrator` agent that:
   - Routes tasks to domain orchestrators
   - Aggregates status from all orchestrators
   - Tracks cross-domain dependencies
2. Implement dependency tracking:
   ```json
   // dependencies.json
   {
     \"blocking\": [
       {\"blocked\": \"frontend-orch-042\", \"on\": \"backend-orch-017\"}
     ]
   }
   ```
3. Implement dependency resolution workflow
4. Create unified DASHBOARD.md generator

**Deliverable:** Full multi-orchestrator system with coordination.

### Phase 4: Advanced Features (Optional, 4-8 hours)

**Goal:** Add robustness and observability.

**Tasks:**
1. Heartbeat monitoring for orchestrator liveness
2. Orphaned task detection and reassignment
3. Load-based routing (prefer less busy orchestrator)
4. Event bus for audit trail
5. Orchestrator metrics and performance tracking

**Deliverable:** Production-grade multi-orchestrator system.

---

## Appendix A: File Format Specifications

### A.1 Extended Status File

```json
{
  \"$schema\": \"./schemas/orchestrator-status.schema.json\",
  \"version\": 2,
  \"orchestrator_id\": \"frontend-orch\",
  \"domain\": \"frontend\",
  \"updated\": \"2025-12-17T10:30:45Z\",
  \"status\": \"RUNNING\",
  \"heartbeat\": \"2025-12-17T10:30:45Z\",
  \"active\": [
    {
      \"id\": \"frontend-orch-001\",
      \"task\": \"Implement header component\",
      \"agent\": \"frontend-developer\",
      \"status\": \"Working on NavBar\",
      \"started\": \"2025-12-17T10:25:00Z\",
      \"depends_on\": []
    }
  ],
  \"queued\": [],
  \"recent\": [],
  \"metrics\": {
    \"tasks_completed_today\": 12,
    \"avg_task_duration_ms\": 45000,
    \"success_rate\": 0.92
  }
}
```

### A.2 Meta Status File

```json
{
  \"$schema\": \"./schemas/meta-orchestrator-status.schema.json\",
  \"version\": 1,
  \"updated\": \"2025-12-17T10:30:45Z\",
  \"orchestrators\": {
    \"frontend-orch\": {
      \"status\": \"RUNNING\",
      \"last_heartbeat\": \"2025-12-17T10:30:45Z\",
      \"active_count\": 2,
      \"queued_count\": 1
    },
    \"backend-orch\": {
      \"status\": \"RUNNING\",
      \"last_heartbeat\": \"2025-12-17T10:30:40Z\",
      \"active_count\": 1,
      \"queued_count\": 3
    }
  },
  \"dependencies\": {
    \"blocking\": [
      {
        \"blocked\": \"frontend-orch-042\",
        \"blocked_orchestrator\": \"frontend-orch\",
        \"waiting_on\": \"backend-orch-017\",
        \"waiting_orchestrator\": \"backend-orch\",
        \"reason\": \"API endpoint must exist first\"
      }
    ],
    \"recently_resolved\": []
  },
  \"global_summary\": {
    \"total_active\": 3,
    \"total_queued\": 4,
    \"orchestrators_online\": 2,
    \"cross_domain_dependencies\": 1
  }
}
```

### A.3 Task Routing Config

```yaml
# src/orchestrator-config/routing.yaml
routing:
  rules:
    - name: frontend
      patterns:
        - \"React\"
        - \"component\"
        - \"UI\"
        - \"\\.tsx$\"
        - \"\\.jsx$\"
        - \"SCSS|CSS|style\"
      target: frontend-orch
      priority: 10

    - name: backend
      patterns:
        - \"API\"
        - \"route\"
        - \"database\"
        - \"auth\"
        - \"middleware\"
        - \"server\"
      target: backend-orch
      priority: 10

    - name: testing
      patterns:
        - \"test\"
        - \"spec\"
        - \"e2e\"
        - \"coverage\"
      target: test-orch
      priority: 5

    - name: default
      patterns:
        - \".*\"
      target: general-orch
      priority: 1

  load_balancing:
    enabled: true
    strategy: \"least-loaded\"
    consider_affinity: true
```

---

## Appendix B: Migration Strategy

### From Single to Multi-Orchestrator

**Step 1: Non-Breaking Changes**
- Add orchestrator_id to status.json
- Add domain field to orchestrator agent
- Both are optional, defaults work

**Step 2: Directory Migration**
- Create new `.claude/orchestrators/default/` directory
- Symlink old files initially
- Gradually move to new structure

**Step 3: New Orchestrator Introduction**
- Create frontend-orch with separate directory
- Route frontend tasks to it
- Observe and tune

**Step 4: Full Cutover**
- All orchestrators use new structure
- Meta-orchestrator coordinates
- Legacy files deprecated

---

## Appendix C: Monitoring Commands

For use with `watch` in main Claude session:

```bash
# Watch all orchestrator statuses
watch -n 5 'cat .claude/orchestrators/*/status.json | jq -s \".\"'

# Watch unified dashboard
watch -n 5 'cat .claude/DASHBOARD.md'

# Check orchestrator heartbeats
watch -n 10 'ls -la .claude/orchestrators/*/heartbeat'

# View event bus tail
watch -n 5 'tail -20 .claude/event-bus.json | jq \".\"'

# Check for orphaned tasks
watch -n 30 'cat .claude/orphaned-tasks.json 2>/dev/null || echo \"none\"'
```

---

## SELECTED APPROACH: Phase 1 - User-Driven Queue with Dependencies

**Decision Date:** 2025-12-17
**Selected By:** User
**Rationale:** Start simple with user-controlled routing, build foundation for future automation.

### Overview

Phase 1 implements a queue-based orchestration system where:
- **User explicitly specifies** what tasks to run and their dependencies
- **Orchestrator handles** spawning agents, tracking progress, resolving dependencies, parallelization
- **No automatic routing** - user decides if something is research vs implementation

This creates a scalable foundation that can later be enhanced with automatic task decomposition.

### File Structure

```
.claude/
├── orchestrator-queue.json      # Task queue with dependencies
├── orchestrator-status.json     # Running status (existing, enhanced)
└── orchestrator/
    ├── DASHBOARD.md             # Human-readable view
    ├── tasks/                   # Task definition files
    │   └── {task-id}.md
    └── results/                 # NEW: Output from completed tasks
        └── {task-id}.md         # Research findings, implementation notes
```

### Queue File Format

```json
// .claude/orchestrator-queue.json
{
  "version": 1,
  "tasks": [
    {
      "id": "res-001",
      "type": "research",
      "description": "How does authentication work in this codebase?",
      "agent": "frontend-researcher",
      "status": "pending",
      "depends_on": [],
      "created": "2025-12-17T10:00:00Z",
      "started": null,
      "completed": null,
      "agent_id": null
    },
    {
      "id": "res-002",
      "type": "research",
      "description": "What form patterns exist in the codebase?",
      "agent": "frontend-researcher",
      "status": "pending",
      "depends_on": [],
      "created": "2025-12-17T10:00:00Z"
    },
    {
      "id": "impl-001",
      "type": "implement",
      "description": "Build login form component following existing patterns",
      "agent": "frontend-developer",
      "status": "blocked",
      "depends_on": ["res-001", "res-002"],
      "inject_results": true,
      "created": "2025-12-17T10:00:00Z"
    }
  ]
}
```

### Task Schema

```typescript
interface QueueTask {
  id: string;                    // Unique ID (res-001, impl-001, test-001)
  type: "research" | "implement" | "test" | "review" | "refactor";
  description: string;           // What to do
  agent: string;                 // Which agent to use
  status: "pending" | "blocked" | "running" | "complete" | "failed";
  depends_on: string[];          // Task IDs that must complete first
  inject_results?: boolean;      // If true, inject dependency results into prompt
  created: string;               // ISO timestamp
  started?: string;              // When agent was spawned
  completed?: string;            // When agent finished
  agent_id?: string;             // Background agent ID for polling
  result_summary?: string;       // Brief outcome
  error?: string;                // If failed, why
}
```

### Status File Format (Enhanced)

```json
// .claude/orchestrator-status.json
{
  "version": 2,
  "updated": "2025-12-17T10:30:00Z",
  "session_id": "orch-20251217-103000",
  "state": "running",
  "summary": "2 running, 1 blocked, 0 pending, 1 complete",
  "running": [
    {
      "id": "res-001",
      "task": "Research auth patterns",
      "agent": "frontend-researcher",
      "agent_id": "a1b2c3d",
      "started": "2025-12-17T10:25:00Z",
      "last_poll": "2025-12-17T10:30:00Z"
    }
  ],
  "blocked": [
    {
      "id": "impl-001",
      "task": "Build login form",
      "waiting_on": ["res-001", "res-002"],
      "waiting_on_remaining": ["res-001"]
    }
  ],
  "completed": [
    {
      "id": "res-002",
      "task": "Research form patterns",
      "result": "SUCCESS",
      "completed": "2025-12-17T10:28:00Z",
      "result_file": ".claude/orchestrator/results/res-002.md"
    }
  ],
  "failed": []
}
```

### Orchestrator Workflow

```
ORCHESTRATOR MAIN LOOP:

1. READ queue.json
2. CATEGORIZE tasks:
   - pending: no dependencies OR all deps complete
   - blocked: has incomplete dependencies
   - running: already spawned, needs polling

3. For each PENDING task:
   a. If inject_results=true, read results from dependency tasks
   b. Build prompt with description + injected results
   c. Spawn agent with run_in_background=true
   d. Record agent_id
   e. Mark task as "running"
   f. Update status.json

4. For each RUNNING task:
   a. Poll agent via TaskOutput(agent_id, block=false)
   b. If complete:
      - Write result to .claude/orchestrator/results/{id}.md
      - Mark task as "complete"
      - Check if any blocked tasks are now unblocked
   c. If failed:
      - Mark task as "failed" with error
      - Surface to user

5. UPDATE status.json with current state
6. If tasks remain (pending, blocked, or running): CONTINUE LOOP
7. If all complete or user interrupts: EXIT

PARALLELIZATION:
- Spawn ALL pending tasks simultaneously (they have no deps)
- Poll ALL running tasks in each loop iteration
- Unblock tasks as soon as their deps complete
```

### Result Injection

When a task has `inject_results: true`, the orchestrator builds its prompt like this:

```markdown
## Task
Build login form component following existing patterns

## Context from Dependencies

### From res-001 (Research: auth patterns)
[Contents of .claude/orchestrator/results/res-001.md]

### From res-002 (Research: form patterns)
[Contents of .claude/orchestrator/results/res-002.md]

## Instructions
Implement this task using the research findings above.
```

### User Commands

```
# Add a research task
/queue add research "How does X work?" --agent frontend-researcher

# Add implementation task with dependencies
/queue add implement "Build Y component" --agent frontend-developer --after res-001,res-002

# Add test task after implementation
/queue add test "Test Y component" --agent tester --after impl-001

# View queue
/queue status

# Start orchestrator
/queue run

# Add task while orchestrator is running (it will pick it up)
/queue add research "Also research Z" --agent backend-researcher
```

### Implementation Tasks

1. **Update orchestrator agent prompt** to implement the main loop
2. **Create queue.json schema** and initial file
3. **Update status.json format** to v2
4. **Create results/ directory handling**
5. **Implement result injection** into downstream task prompts
6. **Create /queue slash commands** (optional, can use natural language)

### Example Session

```
User: "Start the orchestrator and process the queue"

Orchestrator reads queue.json:
  - res-001: pending (no deps) → SPAWN
  - res-002: pending (no deps) → SPAWN
  - impl-001: blocked (needs res-001, res-002)

Status: "2 running, 1 blocked"

[Time passes, polling...]

res-002 completes → write results/res-002.md
Status: "1 running, 1 blocked, 1 complete"

res-001 completes → write results/res-001.md
impl-001 now unblocked (all deps complete) → SPAWN with injected results
Status: "1 running, 0 blocked, 2 complete"

impl-001 completes → write results/impl-001.md
Status: "0 running, 0 blocked, 3 complete"

Orchestrator: "All tasks complete. See results in .claude/orchestrator/results/"
```

---

## Sources

- Current orchestrator implementation: `.claude/agents/orchestrator.md`
- Async orchestrator analysis: `.claude/research/async-orchestrator-analysis.md`
- Anthropic multi-agent research: https://www.anthropic.com/engineering/multi-agent-research-system
- Azure AI Agent patterns: https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
- Distributed systems patterns: Fowler, Patterns of Enterprise Application Architecture

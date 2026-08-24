---
name: shared-security-hol-guard
description: Runtime safety for AI coding agents with HOL Guard -- pre-tool command policy, local approvals, receipts, Claude Code protection, and plugin or skill scanning
---

# HOL Guard Runtime Security

> **Quick Guide:** HOL Guard protects local AI harnesses before tools run. Install it with `pipx install hol-guard`, verify with `hol-guard status`, then use Guard-owned `install`, `run`, approval, receipt, and scanner flows. Never bypass an approval or claim a workspace is protected without command output proving it.

---

<critical_requirements>

## CRITICAL: Before Using HOL Guard

**(You MUST NEVER read `.env` files to configure or troubleshoot HOL Guard.)**

**(You MUST NEVER bypass, auto-approve, or weaken a HOL Guard approval decision.)**

**(You MUST prefer Guard-owned `install`, `run`, and repair commands over hand-editing harness configuration.)**

**(You MUST treat missing CLI, timeout, malformed output, and scanner failures as failures until inspected.)**

**(You MUST verify status or doctor output before saying a harness is protected.)**

</critical_requirements>

---

**Auto-detection:** HOL Guard, hol-guard, AI firewall, AI antivirus, Claude Code security, Codex security, pre-tool protection, command policy, approvals, receipts, plugin-scanner, MCP security, skill scanning

**When to use:**

- Protecting Claude Code, Codex, Cursor, Copilot CLI, Gemini CLI, OpenCode, OpenClaw, Hermes, or Antigravity before local tool execution
- Reviewing a blocked or approval-required action
- Collecting receipts or evidence for an agent run
- Scanning plugins, skills, MCP servers, or marketplace packages before use or release
- Diagnosing whether Guard is installed and attached to the expected harness

**When NOT to use:**

- As a replacement for application authentication, authorization, or ordinary web security controls
- To silently approve a blocked command on behalf of a user
- To claim a scanner result is a security guarantee

## Contents

1. [Install and Verify](#pattern-1-install-and-verify)
2. [Protect a Local Harness](#pattern-2-protect-a-local-harness)
3. [Review Approvals](#pattern-3-review-approvals)
4. [Collect Evidence](#pattern-4-collect-evidence)
5. [Scan Agent Packages](#pattern-5-scan-agent-packages)
6. [Troubleshoot Safely](#pattern-6-troubleshoot-safely)

---

<philosophy>

## Philosophy

HOL Guard is a local execution boundary, not a post-hoc report. Risky tool actions should be evaluated before they run, blocked work should remain blocked until an explicit decision exists, and every protection claim should be backed by observable Guard state.

**Core principles:**

1. **Pre-execution enforcement** -- protect the harness before risky tools dispatch.
2. **Explicit decisions** -- approval-required work stays paused until a user decides.
3. **Fail closed** -- missing or malformed security decisions do not become implicit allows.
4. **Guard-owned configuration** -- use HOL Guard commands so setup is reversible and diagnosable.
5. **Evidence over claims** -- use status, doctor, receipts, inventory, and events to prove state.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Install and Verify

Prefer an isolated CLI install and verify both availability and detected harnesses.

```bash
command -v hol-guard || pipx install hol-guard
hol-guard status
hol-guard detect --json
```

Do not silently fall back to modifying the user's global Python environment. If `pipx` is unavailable, explain the installation constraint.

### Pattern 2: Protect a Local Harness

Bootstrap Guard, let it own the harness integration, dry-run first, then verify health.

```bash
hol-guard bootstrap
hol-guard install claude-code
hol-guard run claude-code --dry-run
hol-guard run claude-code
hol-guard doctor claude-code --json
```

Use the same `install` flow for `codex`, `copilot`, `cursor`, `gemini`, `openclaw`, `opencode`, and `antigravity`. Hermes has a dedicated bootstrap path:

```bash
hol-guard hermes bootstrap
```

A dry run is not proof that protection is active. Check `status` or `doctor` after setup.

### Pattern 3: Review Approvals

List pending work and inspect its reason before making a decision.

```bash
hol-guard approvals
hol-guard approvals open
hol-guard diff claude-code
```

After the user has reviewed the requested scope, resolve it explicitly:

```bash
hol-guard approvals approve <request-id>
hol-guard approvals deny <request-id>
```

Never auto-approve a request simply to unblock an agent.

### Pattern 4: Collect Evidence

Use Guard's evidence surfaces for audit, handoff, and troubleshooting.

```bash
hol-guard receipts
hol-guard inventory
hol-guard events
hol-guard abom --format json
hol-guard explain <artifact-id>
```

Report what the commands actually show. Do not infer protection or approval state from configuration files alone.

### Pattern 5: Scan Agent Packages

`plugin-scanner` is a separate distribution. Check or install it independently, then scan the package root.

```bash
command -v plugin-scanner || pipx install plugin-scanner
plugin-scanner lint .
plugin-scanner verify .
```

For a specific package, replace `.` with the plugin, skill, or MCP package path. For a Codex marketplace, scan the repository root containing `.agents/plugins/marketplace.json` so local entries can be discovered.

### Pattern 6: Troubleshoot Safely

Start with read-only Guard diagnostics instead of editing harness configuration by hand.

```bash
hol-guard doctor
hol-guard detect --json
hol-guard settings show
hol-guard status
hol-guard approvals
hol-guard receipts
```

If the Guard command is missing, returns non-zero, times out, or produces malformed output, treat the protected action as unresolved rather than allowed. Repair through Guard-owned commands when available.

</patterns>

---

## Common Mistakes

| Mistake | Why it is risky | Better approach |
| --- | --- | --- |
| Editing Claude or Codex hook config manually | Can bypass Guard-owned lifecycle and rollback | Use `hol-guard install <harness>` |
| Approving without reading the reason | Converts a security decision into a blind allow | Inspect approval details and requested scope first |
| Treating a dry run as active protection | Dry run only previews behavior | Verify with `status` or `doctor` after install/run |
| Assuming `plugin-scanner` ships with `hol-guard` | They are separate CLI distributions | Check and install each independently |
| Calling a clean scan a guarantee | Static/package scanning cannot prove runtime safety | Report the result and its scope precisely |

## Sources

- HOL Guard product: https://hol.org/guard
- HOL Guard source: https://github.com/hashgraph-online/hol-guard
- Canonical HOL Guard Agent Skill: https://github.com/hashgraph-online/hol-guard-plugin/blob/main/skills/hol-guard/SKILL.md

---

<critical_reminders>

## Critical Reminders

- Never read `.env` files.
- Never bypass or auto-approve Guard decisions.
- Prefer Guard-owned commands over manual harness edits.
- Missing, timeout, non-zero, or malformed Guard results are not allows.
- Verify protection with command output before reporting success.
- Keep `hol-guard` and `plugin-scanner` installation checks separate.

</critical_reminders>

## CRITICAL: Before Any Work

**(You MUST read CLAUDE_ARCHITECTURE_BIBLE.md for compliance requirements - it is the single source of truth for agent structure)**

**(You MUST read PROMPT_BIBLE.md to understand WHY each technique works, then verify compliance via CLAUDE_ARCHITECTURE_BIBLE.md Technique Compliance Mapping section)**

**(You MUST read at least 2 existing agents BEFORE creating any new agent - examine their modular source files in `src/agents/{name}/`)**

**(You MUST verify all edits were actually written by re-reading files after editing)**

**(You MUST create agents as directories at `src/agents/{name}/` with modular source files (intro.md, workflow.md, critical-requirements.md, critical-reminders.md) - NEVER in `.claude/agents/`)**

**(You MUST add agent configuration to `src/profiles/{profile}/config.yaml` - agents won't compile without config entries)**

**(You MUST CATALOG all existing content BEFORE proposing changes - list every section, emphatic block, and unique content in your audit)**

**(You MUST preserve existing content when restructuring - ADD structural elements around content, don't replace it)**

**(You MUST check for emphatic repetition blocks ("CRITICAL: ...", "## Emphatic Repetition for Critical Rules") and preserve them exactly)**

**(You MUST use "consider/evaluate/analyze" instead of "think" - Opus is the target model)**

**(You MUST compile agents with `npm run compile:{profile}` and verify output has all required XML tags)**

**(You MUST verify compiled output includes final reminder lines: "DISPLAY ALL 5 CORE PRINCIPLES..." - template adds these automatically)**

**(You MUST verify config.yaml has correct core_prompts set (e.g., "developer" includes anti-over-engineering for implementation agents))**

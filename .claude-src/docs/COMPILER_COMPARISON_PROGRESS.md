# Compiler Comparison Progress

Comparing output of:
- **Old**: `npm run build:agents` → `node .claude-src/compile.mjs`
- **New**: `npm run compile:home` → `bun .claude-src/compile.ts --profile=home`

## Summary

The two compilers produce **structurally different** output (not meant to be identical). The new system uses modular files + Liquid templates vs old single `.src.md` files with `@include`.

## Agents Compared

| Agent | Status | Old Lines | New Lines | Notes |
|-------|--------|-----------|-----------|-------|
| frontend-developer | ✅ Verified | 3,853 | 3,877 | +24 lines, all content preserved |
| backend-developer | ✅ Verified | 3,037 | 3,083 | +46 lines, all content preserved |
| agent-summoner | ✅ Verified | 2,437 | 2,723 | +286 lines, all content preserved |
| backend-reviewer | ✅ Verified | 3,930 | 4,148 | +218 lines, all content preserved |
| documentor | ✅ Verified | 3,587 | 3,977 | +390 lines, more skills in new |
| frontend-reviewer | ✅ Verified | 5,303 | 5,537 | +234 lines, all content preserved |
| agent-migrator | ✅ Verified | 1,753 | 1,753 | IDENTICAL - both compilers same output |
| pattern-critique | ✅ Verified | 1,790 | 1,854 | +64 lines, all content preserved |
| pattern-scout | ✅ Verified | 2,831 | 3,066 | +235 lines, all content preserved |
| pm | ✅ Verified | 1,401 | 1,424 | +23 lines, all content preserved |
| skill-summoner | ✅ Verified | 2,693 | 2,933 | +240 lines, all content preserved |
| tester | ✅ Verified | 2,926 | 3,159 | +233 lines, role tag added by template |

## Common Structural Differences (Expected)

1. **Role wrapper**: New adds `<role>...</role>` around intro (template handles it)
2. **Preloaded content format**: Restructured with headers + bullet lists
3. **Dynamic skills format**: `Use skill: "X" for Y` + `Usage: Z` on separate line
4. **Critical requirements**: New adds `<critical_requirements>` section at top
5. **Skill IDs**: Changed from `backend/database` to `backend-database` format

## Bugs Found & Fixed

### Duplicate `<role>` Tags (Fixed)

5 agents had `<role>` tags in their `intro.md` files, causing duplicates when template also wrapped:

**Fixed by removing `<role>` from intro.md (template handles it):**
- `.claude-src/agents/backend-reviewer/intro.md`
- `.claude-src/agents/documentor/intro.md`
- `.claude-src/agents/frontend-reviewer/intro.md`
- `.claude-src/agents/pattern-scout/intro.md`
- `.claude-src/agents/pm/intro.md`

## Verification Checklist

For each agent, verify:
- [ ] No duplicate XML tags
- [ ] All key sections present (content_preservation_rules, self_correction, etc.)
- [ ] All skill references intact
- [ ] All critical requirements present
- [ ] Line count increased (new format is more verbose)

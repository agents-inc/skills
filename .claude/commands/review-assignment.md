---
description: Review a frontend take-home assignment using the structured grading system
allowed-tools: Read, Glob, Grep, Bash, WebFetch, TodoWrite
argument-hint: [path-to-submission-folder OR github-url]
---

# Frontend Assignment Review

## Grading System Documents

!`cat /Users/vincentbollaert/dev/photoroom.com/apps/webapp/.ai-docs/_review-assignment/frontend-review-index.md`

!`cat /Users/vincentbollaert/dev/photoroom.com/apps/webapp/.ai-docs/_review-assignment/frontend-assignment-grading-bible.md`

!`cat /Users/vincentbollaert/dev/photoroom.com/apps/webapp/.ai-docs/_review-assignment/scoring-decision-tree-insert.md`

!`cat /Users/vincentbollaert/dev/photoroom.com/apps/webapp/.ai-docs/_review-assignment/grading-bible-conflicts.md`

!`cat /Users/vincentbollaert/dev/photoroom.com/apps/webapp/.ai-docs/_review-assignment/writing-style-guide.md`

## Submission Location

$ARGUMENTS

If this is a GitHub URL, clone or fetch the repository contents first.
If this is a local path, read the submission files directly.

## Your Task

Using all the grading documents above, conduct a full review following the 4-phase process:

### Phase 1: Initial Assessment

1. Can the application run? Check for package.json, dependencies, build scripts
2. Look for vibe-coding indicators:
   - AI instruction files (.mdc, .cursor/, CLAUDE.md in submission)
   - node_modules or build artifacts committed
   - Unused store methods, dead code
   - Generic variable names, obvious AI comments

If app cannot run → Score: 0, stop
If vibe-coded → Cap at 1.0, document indicators

### Phase 2: Feature Evaluation

Evaluate each feature per the grading bible:

1. **Persistence + Delete** (30% weight, 1.2 max points)
2. **Nested Folders** (30% weight, 1.2 max points)
3. **Select Component** (20% weight, 0.8 max points)
4. **Code Quality** (15% weight, 0.6 max points)
5. **Range Selection** (5% weight, 0.2 max points - bonus)

### Phase 3: Score Calculation

Use the worksheet from the scoring decision tree.

### Phase 4: Write Review

Apply the writing style guide (Vincent's voice): lowercase "i", contractions, direct, short sentences.

## Output Format

Structure your review exactly as follows:

---

## Candidate Review: [Name/ID]

### Summary

[2-3 sentences on overall impression]

### Score Breakdown

| Feature              | Score   | Max     | Notes |
| -------------------- | ------- | ------- | ----- |
| Persistence + Delete | X.X     | 1.2     |       |
| Nested Folders       | X.X     | 1.2     |       |
| Select Component     | X.X     | 0.8     |       |
| Code Quality         | X.X     | 0.6     |       |
| Range Selection      | X.X     | 0.2     |       |
| **Total**            | **X.X** | **4.0** |       |

### Strengths

- [specific examples with file:line references]

### Areas for Improvement

- [specific recommendations]

### Code Quality Observations

[MobX patterns, React patterns, TypeScript usage]

### Recommendation

**Score: X.X/4.0** → [Reject / Review Call / Proceed / Strong Proceed]

[Brief justification for recommendation]

### Questions for Review Call

(if applicable - score 2.5-3.4)

- [specific technical questions to clarify]

---

## Important Reminders

- Read ALL code before scoring - don't assume
- Check the conflicts log for precedent on edge cases
- The core question: "would i want this person on my team?"
- High quality with missing features > all features with low quality
- Apply the PR review mindset: would you let them merge?

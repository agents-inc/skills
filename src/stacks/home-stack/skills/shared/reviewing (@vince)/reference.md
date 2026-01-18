# Reviewing Patterns - Reference

[Back to SKILL.md](SKILL.md) | [examples/core.md](examples/core.md) | [examples/feedback-patterns.md](examples/feedback-patterns.md) | [examples/anti-patterns.md](examples/anti-patterns.md)

> Decision frameworks, red flags, and detailed guidance for code reviews.

---

<decision_framework>

## Decision Framework

```
Is this a blocking issue?
├─ YES → Does it affect security, functionality, or required criteria?
│   ├─ Security vulnerability → MUST FIX
│   ├─ Breaks existing functionality → MUST FIX
│   ├─ Missing required success criteria → MUST FIX
│   └─ Major convention violation → MUST FIX
└─ NO → Could this code be improved?
    ├─ YES → Is it worth the author's time?
    │   ├─ Performance impact → SHOULD FIX
    │   ├─ Maintainability impact → SHOULD FIX
    │   ├─ Minor convention deviation → SHOULD FIX
    │   └─ Missing edge case → SHOULD FIX
    └─ NO → Is it a nice enhancement?
        ├─ Better documentation → NICE TO HAVE
        ├─ Additional tests → NICE TO HAVE
        ├─ Future improvement → NICE TO HAVE
        └─ Style preference → DON'T MENTION
```

---

## Approval Decision Framework

Use consistent criteria for approval decisions.

**APPROVE when:**

- All success criteria are met with evidence
- Code follows existing conventions
- No critical security or performance issues
- Tests are adequate and passing
- Changes are within scope
- Quality meets codebase standards

**REQUEST CHANGES when:**

- Success criteria not fully met
- Convention violations exist
- Quality issues need addressing
- Minor security concerns
- Test coverage inadequate

**MAJOR REVISIONS NEEDED when:**

- Critical security vulnerabilities
- Breaks existing functionality
- Major convention violations
- Significantly out of scope
- Fundamental approach issues

**When uncertain:** Request changes with specific questions rather than blocking indefinitely.

**Why this matters:** Consistent approval criteria create predictable, fair reviews. Authors know what to expect.

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Providing feedback without reading the full file
- No file:line references in issue descriptions
- Approving without verifying success criteria
- Only negative feedback, no acknowledgment of good work
- Reviewing code outside your domain expertise
- Blocking PRs for personal style preferences

**Medium Priority Issues:**

- Missing severity distinctions (all issues look equal)
- No suggested solutions for identified issues
- Vague feedback ("this needs improvement")
- Not checking for existing patterns before flagging "new code"
- Incomplete review (not all files examined)

**Common Mistakes:**

- Assuming code behavior without reading implementation
- Flagging valid patterns as "wrong" because unfamiliar
- Missing obvious issues while focusing on minor ones
- Not acknowledging improvement over previous versions
- Providing contradictory feedback (fix X, but also don't change Y)

**Gotchas & Edge Cases:**

- Some "duplication" is intentional for clarity - verify before flagging
- Performance optimizations may not be needed for low-traffic code
- "Convention violations" may be new patterns not yet documented
- Test coverage percentages don't guarantee quality tests
- "Out of scope" changes may be necessary dependencies

</red_flags>

---

## Severity Levels Reference

| Marker           | Category                              | Examples                                                                                                |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Must Fix**     | Blockers - cannot approve until fixed | Security vulnerabilities, breaks functionality, missing required criteria, major convention violations  |
| **Should Fix**   | Improvements - strongly recommended   | Performance optimizations, minor convention deviations, missing edge case handling, code simplification |
| **Nice to Have** | Suggestions - optional enhancements   | Further refactoring, additional tests, documentation, future enhancements                               |

---

## Self-Correction Checkpoints Reference

| Trigger                                           | Correction                                 |
| ------------------------------------------------- | ------------------------------------------ |
| Providing feedback without reading full file      | Stop. Read the complete file first.        |
| Saying "this needs improvement" without specifics | Stop. Provide file:line references.        |
| Approving without checking success criteria       | Stop. Verify each criterion with evidence. |
| Focusing only on issues                           | Stop. Add positive feedback.               |
| Making assumptions about code behavior            | Stop. Read the actual implementation.      |
| Flagging issues without explaining WHY            | Stop. Add rationale for each issue.        |
| Reviewing code outside your domain                | Stop. Defer to specialist reviewer.        |

---

## Post-Action Reflection Checklist

1. Did I read all relevant files completely before commenting?
2. Did I check against all success criteria in the spec?
3. Are my issues specific (file:line) and actionable?
4. Did I distinguish severity correctly (blocker vs improvement)?
5. Did I acknowledge what was done well?
6. Should any part go to a specialist reviewer?
7. Is my recommendation (approve/request changes) justified?

**Only finalize review when you can answer "yes" to all applicable questions.**

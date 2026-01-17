# Voting System Research for Stack Marketplace

> **Purpose**: Research how to implement upvoting/voting for individual stacks within a GitHub repository
> **Date**: 2026-01-09

---

## Executive Summary

**Key Finding**: GitHub does NOT support starring individual files - stars only work at the repository level. However, several viable alternatives exist for implementing voting on items within a single repository.

**Recommendation**: Use a **hybrid approach** combining GitHub Discussions Polls for MVP with a JSON-based vote counter for production, allowing evolution from zero-infrastructure to full-featured.

---

## Research Question 1: Can You Star Individual Files in GitHub?

**Answer: No.**

GitHub's starring feature works exclusively at the repository level. According to [GitHub Docs](https://docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars):

> "Starring a repository is a simple two-step process. On GitHub, navigate to the main page of the repository. In the top-right corner of the page, click Star."

Stars serve these purposes:
- Bookmarking repositories for later
- Showing appreciation to maintainers
- Affecting GitHub rankings and discoverability
- Organizing into lists (public preview feature)

**There is no native GitHub feature to star, bookmark, or react to individual files within a repository.**

---

## Research Question 2: What Alternatives Exist?

### Option A: GitHub Reactions on Issues (Per-Stack Issue)

**Mechanism**: Create one GitHub Issue per stack, users react with thumbs up.

**Pros**:
- Native GitHub feature, zero infrastructure
- Can sort issues by reactions
- Users already familiar with reaction UI
- Free, no external service

**Cons**:
- Clutters issue tracker with non-bug content
- Not intuitive for "voting" (issues are for bugs/features)
- Can't vote on items in a README/file directly
- Limited to 6 reaction types
- Reactions don't show in issue list by default

**Implementation**:
```markdown
<!-- In stack file or README -->
[Vote for this stack](https://github.com/org/repo/issues/42) (React with thumbs up)
```

**Viability**: Medium - Works but feels hacky.

---

### Option B: GitHub Discussions Polls

**Mechanism**: Use GitHub Discussions with the Polls category.

**Pros**:
- Native GitHub feature, purpose-built for community input
- Up to 8 options per poll
- Visual results display
- Mobile app support
- Keeps discussions separate from issues

**Cons**:
- Polls are standalone, not embedded in files
- Limited to 8 options per poll (would need multiple polls for many stacks)
- Can't see who voted (privacy by design)
- Requires Discussions to be enabled on repo

**Implementation**:
```
Create a "Stack Voting" poll in Discussions:
- Option 1: YOLO Modern React Stack
- Option 2: Conservative Redux Stack
- Option 3: Vue Composition Stack
- ... (up to 8)
```

**Viability**: High for MVP - Simple, native, zero infrastructure.

**Source**: [GitHub Blog - Discussions Polls](https://github.blog/news-insights/product-news/whats-new-in-github-discussions-organization-discussions-polls-and-more/)

---

### Option C: Dedicated Discussion Per Stack

**Mechanism**: Create a GitHub Discussion for each stack, users upvote the discussion.

**Pros**:
- Discussions have native upvote button (separate from reactions)
- Can include comments, feedback
- Sortable by votes
- Discussion descriptions can contain stack details

**Cons**:
- Upvotes on discussions are separate from thumbs up reactions (confusing)
- Requires manual creation of discussion per stack
- Need to keep discussions in sync with stack files

**Implementation**:
```yaml
# In stack YAML frontmatter
discussion_url: https://github.com/org/repo/discussions/15
```

**Viability**: High - Good balance of native features and organization.

---

### Option D: gh-polls (SVG Image Voting)

**Mechanism**: Embed SVG images that track votes when clicked.

**How it works**:
> "These polls work by pasting individual markdown SVG images into your issue, each wrapped with a link that tracks a vote. A single vote per IP is allowed for a given poll, which are stored in DynamoDB."

**Pros**:
- Can embed in any markdown (README, issues, discussions)
- Visual progress bars
- One vote per IP (basic fraud prevention)

**Cons**:
- External service dependency (apex/gh-polls)
- Requires DynamoDB backend
- Service could go offline
- IP-based (not GitHub account based)

**Implementation**:
```markdown
[![](https://api.gh-polls.com/poll/01ABC/YOLO%20Modern%20React)](https://api.gh-polls.com/poll/01ABC/YOLO%20Modern%20React/vote)
[![](https://api.gh-polls.com/poll/01ABC/Conservative%20Redux)](https://api.gh-polls.com/poll/01ABC/Conservative%20Redux/vote)
```

**Viability**: Medium - Clever but external dependency risk.

**Source**: [apex/gh-polls GitHub](https://github.com/apex/gh-polls)

---

### Option E: GitVote (CNCF GitHub App)

**Mechanism**: GitHub App that enables formal voting on issues/PRs.

**How it works**:
> "Votes are created by adding a new comment to an existing issue or pull request with the `/vote` command. Users cast votes by reacting to the git-vote bot comment."

**Pros**:
- Formal voting with defined outcomes (pass/fail)
- Configurable voting rules
- Results posted to GitHub Discussions (announcements)
- Can integrate with protected branches

**Cons**:
- Designed for governance voting, not popularity ranking
- Requires GitHub App installation
- Overkill for simple "I like this stack" voting
- Needs configuration file in repo

**Viability**: Low for this use case - Too formal/complex.

**Source**: [CNCF GitVote](https://github.com/cncf/gitvote)

---

### Option F: JSON File with Vote Counts (PR-based)

**Mechanism**: Store votes in a JSON file, users submit PRs to increment their vote.

**Pros**:
- Git-native, no external dependencies
- Full audit trail (who voted when)
- Works offline
- No service to maintain

**Cons**:
- High friction (fork, edit, PR)
- Requires maintainer to merge PRs
- Could be automated but adds complexity
- Doesn't scale well (many small PRs)

**Implementation**:
```json
// votes.json
{
  "yolo-modern-react": {
    "votes": 42,
    "voters": ["user1", "user2", "user3"]
  },
  "conservative-redux": {
    "votes": 28,
    "voters": ["user4", "user5"]
  }
}
```

**Viability**: Low for direct voting - Too much friction.

---

### Option G: Each Stack as Its Own Repository

**Mechanism**: Separate repository per stack, use GitHub stars.

**Pros**:
- Native starring works
- Each stack has own issues/discussions
- Can have separate maintainers per stack
- Clear ownership

**Cons**:
- Explosion of repositories to manage
- Discovery problem (how to find all stacks?)
- Coordination overhead
- Inconsistent quality across repos

**Implementation**:
```
org/stacks-registry (central index)
org/stack-yolo-modern-react
org/stack-conservative-redux
org/stack-vue-composition
```

**Viability**: Medium - Works but management overhead.

---

### Option H: External Voting Service

**Mechanism**: Use external service (custom API, Firebase, Supabase).

**Pros**:
- Full control over voting logic
- Can implement sophisticated features (weighted votes, decay)
- Real-time updates
- Rich analytics

**Cons**:
- Infrastructure to maintain
- Cost (hosting, database)
- Authentication complexity
- External dependency

**Viability**: Good for V2 - Too much for MVP.

---

## Research Question 3: How Do Other Projects Handle This?

### Awesome Lists
- **Mechanism**: Link to external repos, use stars of linked repos
- **Problem**: Items within the list aren't ranked
- **Source**: [Awesome Rank](https://awesomerank.github.io/)

### npm Registry
- **Mechanism**: Download counts, popularity scores
- **Calculated from**: Downloads, dependents, GitHub stars
- **Problem**: Not voting, just usage metrics
- **Source**: [npm-stat](https://npm-stat.com/)

### VS Code Marketplace
- **Mechanism**: Star ratings (1-5) + reviews + install counts
- **Problem**: Gaming concerns, low rating participation
- **Source**: [VS Code Docs](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)

### Terraform Registry
- **Mechanism**: Verification tiers (Official, Partner, Community) + download counts
- **No voting**: Quality signals from tier, not community votes
- **Source**: [Terraform Registry](https://registry.terraform.io/)

### Homebrew
- **Mechanism**: Install analytics (opt-in)
- **No voting**: Just usage counts
- **Source**: [Homebrew Analytics](https://formulae.brew.sh/analytics/)

### JHipster Marketplace
- **Mechanism**: Listed or not listed (curated)
- **No voting**: Binary inclusion, no ranking
- **Source**: [JHipster Marketplace](https://www.jhipster.tech/modules/marketplace/)

---

## Recommendation: Phased Approach

### Phase 1: MVP (Zero Infrastructure)

**Use GitHub Discussions with dedicated discussion per stack.**

**Implementation**:
1. Enable GitHub Discussions on the repository
2. Create a "Stacks" category in Discussions
3. Create one Discussion per stack with stack details
4. Users upvote the Discussion to "vote" for the stack
5. Sort by "Top" to see most voted stacks

**Stack file integration**:
```yaml
# stacks/yolo-modern-react.yaml
name: YOLO Modern React Stack
description: Cutting-edge React with bleeding-edge tooling
discussion: https://github.com/org/repo/discussions/42
author: @username
```

**Benefits**:
- Native GitHub feature
- Zero infrastructure
- Comments allow feedback
- Upvotes are intuitive
- Can add to existing repo immediately

**Limitations**:
- Upvote count not easily accessible via API
- Can't embed vote count in stack file
- Manual sync between stack files and discussions

---

### Phase 2: Enhanced (Automated Sync)

**Add GitHub Action to sync vote counts.**

**Implementation**:
1. GitHub Action runs on schedule (daily)
2. Uses GitHub GraphQL API to fetch discussion upvote counts
3. Updates a `votes.json` or `README.md` leaderboard
4. Commits changes automatically

**votes.json structure**:
```json
{
  "last_updated": "2026-01-09T12:00:00Z",
  "stacks": [
    {
      "id": "yolo-modern-react",
      "name": "YOLO Modern React Stack",
      "votes": 142,
      "discussion_id": 42,
      "rank": 1
    },
    {
      "id": "conservative-redux",
      "name": "Conservative Redux Stack",
      "votes": 98,
      "discussion_id": 43,
      "rank": 2
    }
  ]
}
```

**Benefits**:
- Automated vote tracking
- Vote counts in repo for CLI/tooling to read
- Leaderboard in README
- Still zero external infrastructure (just GitHub Actions)

---

### Phase 3: Production (Custom Service)

**Build lightweight voting API if scale demands.**

**When to build**:
- Discussions upvotes become insufficient
- Need real-time vote counts
- Want weighted voting or decay
- Community requests richer features

**Technology options**:
- **Cloudflare Workers + D1**: Serverless, cheap, fast
- **Supabase**: PostgreSQL with real-time, auth built-in
- **GitHub App**: Can react to events, store votes

**Features to consider**:
- Vote decay (older votes worth less)
- Verified voter status (GitHub account age, contributions)
- Anti-gaming measures (rate limiting, suspicious patterns)
- Vote history and analytics

---

## Decision Matrix

| Approach | Friction | Infrastructure | Quality Signal | Scalability |
|----------|----------|----------------|----------------|-------------|
| Issue Reactions | Low | None | Medium | Medium |
| **Discussions (Recommended)** | **Low** | **None** | **High** | **High** |
| gh-polls | Low | External | Medium | Medium |
| GitVote | Medium | GitHub App | High | High |
| JSON + PR | High | None | High | Low |
| Separate Repos | Low | Many repos | High | Low |
| External Service | Low | Custom | High | High |

---

## Final Recommendation

### For Immediate Implementation (MVP)

**GitHub Discussions with one discussion per stack.**

Steps:
1. Enable Discussions on repository
2. Create "Stacks" discussion category
3. Write GitHub Action template for automated discussion creation
4. Add `discussion_url` field to stack YAML schema
5. Create initial discussions for seed stacks
6. Document voting process in CONTRIBUTING.md

### For Future Evolution

1. **Short-term**: Add GitHub Action to sync vote counts to `votes.json`
2. **Medium-term**: Build CLI command to show "top stacks" using vote data
3. **Long-term**: Consider custom voting API if community grows significantly

---

## Sources

- [GitHub Docs - Saving Repositories with Stars](https://docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars)
- [GitHub Blog - Discussions Polls](https://github.blog/news-insights/product-news/whats-new-in-github-discussions-organization-discussions-polls-and-more/)
- [GitHub Changelog - Discussions Polls](https://github.blog/changelog/2022-04-12-discussions-polls/)
- [CNCF GitVote](https://github.com/cncf/gitvote)
- [apex/gh-polls](https://github.com/apex/gh-polls)
- [GitHub Community Discussion - Upvote Issues](https://github.com/orgs/community/discussions/17119)
- [GitHub Community Discussion - Voting System](https://github.com/orgs/community/discussions/10)
- [Awesome Rank](https://awesomerank.github.io/)
- [npm-stat](https://npm-stat.com/)
- [VS Code Extension Marketplace Docs](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)
- [Terraform Registry](https://registry.terraform.io/)
- [Homebrew Analytics](https://formulae.brew.sh/analytics/)
- [Monorepo vs Multi-repo](https://kinsta.com/blog/monorepo-vs-multi-repo/)

# Resend Setup - Reference Guide

> Decision frameworks and anti-patterns for Resend and React Email setup.

---

## Decision Framework

### Email Package Location

```
Where should email templates live?
├── Monorepo with multiple apps?
│   └── packages/emails/ - Shared across all apps
├── Single app?
│   └── src/emails/ or lib/emails/ - Inside app directory
└── Need to share across separate repos?
    └── Separate package with npm publish
```

### Styling Approach

```
How should emails be styled?
├── Need utility classes? → Tailwind (wrap in <Tailwind>)
├── Need fine control? → Inline styles (style prop)
└── Need both? → Tailwind + style overrides
    └── Note: Grid, Flexbox, shadows don't work in most email clients
```

### Content Prop Selection

```
How to pass email content to resend.emails.send()?
├── Using Resend SDK? → react prop (preferred, no render step)
├── Using non-Resend provider? → render() to HTML string
└── Need plain text version? → text prop alongside react/html
```

> **Anti-patterns:** See [SKILL.md](SKILL.md) RED FLAGS section for common mistakes and gotchas.

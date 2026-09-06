# Visual Regression - Catalog-Driven Coverage

> Using an existing component-state catalog as the visual corpus, and the change-detection concepts a hosted service adds on top of it. See [core.md](core.md) for a self-hosted harness and [determinism.md](determinism.md) for stabilization.

**Prerequisites**: a catalog of component states already exists — a workshop, a gallery, whatever the project calls it — where each entry ("a story" below) is a named, addressable, prop-controlled render of one state. Authoring those entries is the catalog tool's own concern; what follows is which entries are worth capturing and what a service does with them.

> The per-subject parameter key is spelled with your service's own name; `visual` is used below as a stand-in.

---

## Enumerating States, Not Components

The unit of visual coverage is a **state**, not a component. A component with one entry has one subject and proves almost nothing; the interesting failures live in the states nobody looked at.

### Good Example - Meaningful states

```typescript
// Each of these fails differently when the component breaks
export const Default = { args: { children: "Save" } };
export const Loading = { args: { children: "Save", isLoading: true } };
export const Disabled = { args: { children: "Save", isDisabled: true } };
export const Destructive = { args: { children: "Delete", tone: "danger" } };
export const IconOnly = { args: { icon: "trash", "aria-label": "Delete" } };
export const LongLabel = {
  args: { children: "Save and continue to billing details" },
};
```

**Why good:** six subjects covering the layout risks that actually exist — spinner alignment, disabled contrast, danger token resolution, square icon sizing, and label overflow.

### Bad Example - States that differ invisibly

```typescript
// BAD: four subjects, one appearance
export const WithOnClick = { args: { onClick: noop } };
export const WithAnalyticsId = { args: { analyticsId: "cta-1" } };
export const WithType = { args: { type: "submit" } };
export const WithTabIndex = { args: { tabIndex: 0 } };
```

**Why bad:** every one captures the identical frame, so they cost snapshots and review attention while covering nothing the first subject did not.

**A useful filter:** if two states cannot be told apart in a still image, they are one visual subject. Test the difference with a behavioural assertion instead.

---

## Interaction-Produced States

A service that runs a catalog entry's interaction script waits for it to finish before capturing, so states that exist only after user input become subjects without hand-built fixtures.

```typescript
export const MenuOpen = {
  play: async ({ canvas, user }) => {
    await user.click(canvas.getByRole("button", { name: /account/i }));
    // The capture happens after this resolves - end on the settled state
    await expect(canvas.getByRole("menu")).toBeVisible();
  },
};

export const ValidationErrors = {
  play: async ({ canvas, user }) => {
    await user.click(canvas.getByRole("button", { name: /submit/i }));
    await expect(canvas.getByText(/email is required/i)).toBeVisible();
  },
};
```

**Why good:** open menus, expanded rows and post-submit error states are exactly where spacing and z-order regressions hide, and here they cost one entry each.

**Why the trailing assertion matters:** the capture is taken when the script finishes. Ending on a click leaves the transition mid-flight; ending on an assertion of the settled state guarantees the frame is the one you meant.

**Interaction failures are build failures.** A script that throws marks the subject as a failed test and blocks the build — it does not silently produce a snapshot of the broken state.

---

## Modes

A mode is a named combination of globals — theme, viewport, locale — applied to a subject to produce an additional snapshot.

### Good Example - Defined once, applied narrowly

```typescript
// visual-modes.ts
export const allModes = {
  "light desktop": { theme: "light", viewport: "large" },
  "dark desktop": { theme: "dark", viewport: "large" },
  "light mobile": { theme: "light", viewport: "small" },
} as const;
```

```typescript
// Component level: this component carries real responsive risk
const meta = {
  component: NavigationBar,
  parameters: {
    visual: {
      modes: {
        "light desktop": allModes["light desktop"],
        "light mobile": allModes["light mobile"],
      },
    },
  },
};

// Subject level: only this state carries dark-token risk
export const Elevated = {
  parameters: {
    visual: { modes: { "dark desktop": allModes["dark desktop"] } },
  },
};
```

**Why good:** breadth is bought where the risk is rather than across the whole catalog, and mode names are defined once so a viewport change propagates everywhere.

### Bad Example - Global modes on everything

```typescript
// BAD: four modes applied to every subject in the catalog
parameters: {
  visual: {
    modes: {
      "light desktop": allModes["light desktop"],
      "dark desktop": allModes["dark desktop"],
      "light mobile": allModes["light mobile"],
      "dark mobile": allModes["dark mobile"],
    },
  },
}
```

**Why bad:** modes **stack** across project, component and subject level rather than overriding, so a 400-subject catalog becomes 1,600 snapshots per build — billed per snapshot, and every one of them a potential change for a human to review.

### Mode mechanics worth knowing

- Levels stack. Project modes plus a component mode plus a subject mode means the subject is captured in all of them.
- Opt out explicitly, per mode, on the subject that should not carry it.
- **Baselines are keyed by mode name.** Changing a mode's viewport under the same name keeps comparing against the old baseline; renaming a mode starts a fresh one with no history.

---

## Per-Subject Capture Parameters

Tuning belongs on the subject that needs it, not on the project.

```typescript
const STRICT_DIFF_THRESHOLD = 0.02; // lower is more sensitive
const CHART_SETTLE_MS = 300;

export const RevenueChart = {
  parameters: {
    visual: {
      diffThreshold: STRICT_DIFF_THRESHOLD, // catch subtle token and contrast shifts
      diffIncludeAntiAliasing: false, // ignore anti-aliased pixels
      delay: CHART_SETTLE_MS, // last resort: motion with no completion signal
      pauseAnimationAtEnd: true, // capture the final frame of an "animate in"
    },
  },
};

export const ThirdPartyEmbed = {
  parameters: { visual: { disableSnapshot: true } }, // renders someone else's UI
};
```

**Why good:** sensitivity is raised for the subject where subtle change matters, and the un-snapshotable subject is opted out explicitly rather than masked into meaninglessness.

**Why `delay` is a last resort:** it is a fixed wait, with every failure mode a fixed wait has. Prefer an interaction script ending in an assertion; use a delay only for motion that exposes no completion signal.

> A hosted service's sensitivity parameter and a self-hosted comparator's per-pixel `threshold` are different algorithms on different scales. Do not port a number between them.

---

## Change Detection Concepts

A hosted service is not "screenshots with a nicer viewer" — its model differs in ways that decide how the team works.

| Concept           | What it means                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Build**         | One capture run over the corpus, tied to a commit and a branch                              |
| **Baseline**      | The last accepted snapshot for a subject **on that branch**, inherited from the base branch |
| **Change**        | A subject whose snapshot differs from its baseline — grouped into a reviewable set          |
| **Accept / deny** | A recorded human decision per change; accepting makes that snapshot the new baseline        |
| **Carry-forward** | An accepted change stops reappearing on later builds of the same branch                     |
| **Failed test**   | An interaction script threw — distinct from a visual change, and not acceptable away        |

Two operational consequences:

1. **The trunk branch must be built.** Baselines propagate through the branch graph, so if trunk is never captured, branch builds have nothing valid to inherit and every branch reviews the whole corpus from scratch.
2. **Accepting is a per-snapshot decision with a name attached.** That is the property worth paying for, and bulk-accepting a whole build throws it away.

---

## Pairing With an Existing Browser Suite

A service can also consume archives captured during an existing browser test run: the run records the DOM, styles and assets of each visited state, and the service re-renders and diffs them.

**When this fits:** the states worth guarding exist only behind multi-step flows — checkout step three, an authenticated empty state — and no catalog entry reproduces them.

**When it does not:** the states are reproducible in the catalog. Catalog subjects are faster, cheaper, isolated and directly addressable, where a flow-derived subject drags an entire journey behind it and any flakiness in that journey becomes visual flakiness.

---

_Next: [ci.md](ci.md) for job wiring, diff artifacts and the baseline-update workflow._

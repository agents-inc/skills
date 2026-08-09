# Visual Regression - Story-Driven Coverage

> Using an existing story catalog as the visual corpus, and the change-detection concepts a cloud harness adds on top of it. See [core.md](core.md) for self-hosted comparison and [determinism.md](determinism.md) for stabilization.

**Prerequisites**: A story catalog already exists. Authoring stories, args, decorators, and workshop configuration are owned by the `web-tooling-storybook` skill and are deliberately not covered here.

---

## Pattern: Enumerating States, Not Components

The unit of visual coverage is a **state**, not a component. A component with one story has one subject and proves almost nothing; the interesting failures live in the states nobody looked at.

### Good Example - Meaningful states

```typescript
// Each of these fails differently when the component breaks
export const Default: Story = { args: { children: "Save" } };
export const Loading: Story = { args: { children: "Save", isLoading: true } };
export const Disabled: Story = { args: { children: "Save", isDisabled: true } };
export const Destructive: Story = {
  args: { children: "Delete", tone: "danger" },
};
export const IconOnly: Story = {
  args: { icon: "trash", "aria-label": "Delete" },
};
export const LongLabel: Story = {
  args: { children: "Save and continue to billing details" }, // exercises truncation
};
```

**Why good:** six subjects covering the layout risks that actually exist — spinner alignment, disabled contrast, danger token resolution, square icon sizing, and label overflow

### Bad Example - States that differ invisibly

```typescript
// BAD: four subjects, one appearance
export const WithOnClick: Story = { args: { onClick: noop } };
export const WithAnalyticsId: Story = { args: { analyticsId: "cta-1" } };
export const WithType: Story = { args: { type: "submit" } };
export const WithTabIndex: Story = { args: { tabIndex: 0 } };
```

**Why bad:** every one of these captures the identical frame, so they cost snapshots and review attention while covering nothing a single subject did not already cover

**A useful filter:** if two states cannot be told apart in a still image, they are one visual subject. Test the difference with a behavioural assertion instead.

---

## Pattern: Interaction-Produced States

A cloud harness waits for a story's interaction script to finish before capturing, so states that only exist after user input become subjects without hand-built fixtures.

```typescript
export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /account/i }));
    // The capture happens after this resolves - assert the settled state
    await expect(canvas.getByRole("menu")).toBeVisible();
  },
};

export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /submit/i }));
    await expect(canvas.getByText(/email is required/i)).toBeVisible();
  },
};
```

**Why good:** open menus, expanded rows, and post-submit error states are exactly where spacing and z-order regressions hide, and here they cost one story each

**Why the trailing assertion matters:** the capture is taken when the script finishes. Ending on a click leaves the transition mid-flight; ending on an assertion of the settled state guarantees the frame is the one you meant.

**Interaction failures are build failures.** A failing script badges the subject as a failed test and blocks the build from passing — it does not silently produce a snapshot of the broken state.

---

## Pattern: Modes

A mode is a named combination of globals — theme, viewport, locale — applied to a subject to produce an additional snapshot.

### Good Example - Modes defined once, applied narrowly

```typescript
// .storybook/modes.ts
export const allModes = {
  "light desktop": { theme: "light", viewport: "large" },
  "dark desktop": { theme: "dark", viewport: "large" },
  "light mobile": { theme: "light", viewport: "small" },
} as const;
```

```typescript
// Component level: this component has real responsive risk
const meta = {
  component: NavigationBar,
  parameters: {
    chromatic: {
      modes: {
        "light desktop": allModes["light desktop"],
        "light mobile": allModes["light mobile"],
      },
    },
  },
} satisfies Meta<typeof NavigationBar>;

// Story level: only this state has dark-token risk
export const Elevated: Story = {
  parameters: {
    chromatic: { modes: { "dark desktop": allModes["dark desktop"] } },
  },
};
```

**Why good:** breadth is bought where the risk is, not across the whole catalog; mode names are defined once so a viewport change propagates everywhere

### Bad Example - Global modes on everything

```typescript
// .storybook/preview.ts
// BAD: four modes applied to every subject in the catalog
parameters: {
  chromatic: {
    modes: {
      "light desktop": allModes["light desktop"],
      "dark desktop": allModes["dark desktop"],
      "light mobile": allModes["light mobile"],
      "dark mobile": allModes["dark mobile"],
    },
  },
}
```

**Why bad:** modes **stack** across project, component, and story levels rather than overriding, so a 400-subject catalog becomes 1,600 snapshots per build — billed per snapshot, and every one of them a potential change for a human to review

### Mode mechanics worth knowing

- Levels stack. Project modes plus a component mode plus a story mode means the story is captured in all of them.
- Opt out explicitly with `modes: { "dark desktop": { disable: true } }`.
- **Baselines are keyed by mode name.** Changing a mode's viewport under the same name keeps comparing against the old baseline; renaming a mode starts a fresh one with no history.

---

## Pattern: Per-Subject Capture Parameters

Tuning belongs on the subject that needs it, not on the project.

```typescript
const STRICT_DIFF_THRESHOLD = 0.02; // default is 0.063; lower is more sensitive
const CHART_SETTLE_MS = 300;

export const RevenueChart: Story = {
  parameters: {
    chromatic: {
      diffThreshold: STRICT_DIFF_THRESHOLD, // catch subtle token/contrast shifts
      diffIncludeAntiAliasing: false, // ignore anti-aliased pixels (the default behaviour)
      delay: CHART_SETTLE_MS, // last resort: a JS animation with no completion signal
      pauseAnimationAtEnd: true, // capture the final frame of "animate in" (default)
    },
  },
};

export const ThirdPartyEmbed: Story = {
  parameters: { chromatic: { disableSnapshot: true } }, // renders someone else's UI
};
```

**Why good:** sensitivity is raised for the subject where subtle change matters and the un-snapshotable subject is opted out explicitly rather than being masked into meaninglessness

**Why `delay` is a last resort:** it is a fixed wait, with all the usual failure modes. Prefer an interaction script ending in an assertion; use `delay` only for motion that exposes no completion signal.

> `diffThreshold` (default `0.063`) is a different algorithm and a different scale from the self-hosted per-pixel `threshold` (default `0.2`). Do not port numbers between harnesses.

---

## Pattern: Change Detection Concepts

A cloud harness is not "screenshots with a nicer viewer" — its model is different in ways that decide how the team works.

| Concept           | What it means                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Build**         | One capture run over the corpus, tied to a commit and a branch                              |
| **Baseline**      | The last accepted snapshot for a subject **on that branch**, inherited from the base branch |
| **Change**        | A subject whose snapshot differs from its baseline — grouped into a reviewable set          |
| **Accept / deny** | A recorded human decision per change; accepting makes that snapshot the new baseline        |
| **Carry-forward** | An accepted change stops reappearing on later builds of the same branch                     |
| **Failed test**   | An interaction script threw — distinct from a visual change, and not acceptable away        |

Two operational consequences:

1. **The trunk branch must be built.** Baselines propagate through the branch graph; if trunk is never captured, branch builds have nothing valid to inherit and every branch reviews the whole corpus from scratch.
2. **Accepting is a per-snapshot decision with a name attached.** That is the property worth paying for — bulk-accepting a whole build throws it away.

---

## Pattern: Pairing with an Existing Browser Suite

A cloud harness can also consume archives captured during an existing browser test run, using `--playwright` or `--cypress`: the run records the DOM, styles, and assets of each visited state, and the service re-renders and diffs them.

**When this fits:** the states worth guarding only exist behind multi-step flows (checkout step 3, an authenticated empty state) and no story reproduces them.

**When it does not:** the states are reproducible in the catalog. Catalog subjects are faster, cheaper, isolated, and directly addressable — a flow-derived subject drags an entire journey behind it, and any flakiness in that journey becomes visual flakiness.

---

_Next: [ci.md](ci.md) for job wiring, diff artifacts, and the baseline-update workflow._

# CLI Framework Research: Complex Navigation & Relationships

> **Purpose**: Evaluate CLI framework options for implementing complex selection flows with horizontal navigation, conditional disabling, and multi-step wizards with back navigation.
> **Date**: 2026-01-20
> **Status**: Research complete

---

## Executive Summary

The current CLI uses **@clack/prompts** + **Commander.js**. While excellent for simple wizards, it lacks:

- Horizontal tab navigation
- Dynamic option disabling based on selections
- Back/previous navigation between wizard steps
- Complex relationship modeling

**Recommendation**: For the advanced features requested, consider **Ink** (React for CLI) for full control, or enhance the current stack with custom state management.

---

## Table of Contents

1. [Current Implementation](#current-implementation)
2. [Feature Requirements Analysis](#feature-requirements-analysis)
3. [Framework Comparison](#framework-comparison)
4. [Detailed Framework Analysis](#detailed-framework-analysis)
5. [Capability Matrix](#capability-matrix)
6. [Implementation Options](#implementation-options)
7. [Recommendations](#recommendations)
8. [Sources](#sources)

---

## Current Implementation

### Tech Stack

| Package          | Version  | Purpose                               |
| ---------------- | -------- | ------------------------------------- |
| `commander`      | ^12.1.0  | CLI argument parsing, command routing |
| `@clack/prompts` | ^0.11.0  | Interactive prompts and wizards       |
| `picocolors`     | ^1.1.0   | Terminal colors                       |
| `liquidjs`       | ^10.24.0 | Template rendering                    |
| `yaml`           | ^2.8.2   | Configuration parsing                 |

### What Works

```typescript
// Conditional prompts via group()
await p.group({
  approach: () => p.select({ message: "How to set up?" }),

  // Only shown if approach === 'stack'
  stack: ({ results }) => {
    if (results.approach !== "stack") return Promise.resolve(undefined);
    return p.select({ message: "Select stack" });
  },
});
```

### Current Limitations

| Feature                   | Supported | Notes                            |
| ------------------------- | --------- | -------------------------------- |
| Vertical list selection   | ✅ Yes    | Core feature                     |
| Conditional prompts       | ✅ Yes    | Via `({ results }) =>` callback  |
| Multi-select with groups  | ✅ Yes    | `groupMultiselect()`             |
| Horizontal tab navigation | ❌ No     | Only vertical lists              |
| Dynamic option disabling  | ❌ No     | Options are static once rendered |
| Back/previous step        | ❌ No     | One-way flow only                |
| Sibling navigation        | ❌ No     | Cannot jump between sections     |

---

## Feature Requirements Analysis

### What You Asked For

1. **Horizontal tab navigation** (like Claude Code's question UI)
   - Press right → next section
   - Press left → previous section
   - Example: Frontend → Framework → Libraries → Backend → ...

2. **Complex relationships**
   - Not just parent-to-child
   - Alternative/sibling relationships
   - Example: Select React → enables React Query option

3. **Conditional disabling**
   - Selection A disables option B
   - Example: Select "minimal" → disables "advanced state management"

4. **Visual feedback**
   - Hints on options
   - Color changes for state
   - Disabled appearance

5. **Flexible navigation**
   - Go back to previous step
   - Jump between siblings (Frontend ↔ Backend)

---

## Framework Comparison

### Overview

| Framework               | Stars | Approach            | Complexity  | Best For                |
| ----------------------- | ----- | ------------------- | ----------- | ----------------------- |
| **@clack/prompts**      | 5k+   | Prompt-based        | Low         | Simple wizards          |
| **Inquirer.js**         | 20k+  | Prompt-based        | Low-Medium  | Standard CLI prompts    |
| **Enquirer**            | 7.5k  | Prompt-based        | Medium      | Styled prompts          |
| **Ink**                 | 26k+  | React components    | Medium-High | Complex interactive UIs |
| **blessed/neo-blessed** | 11k+  | Widget-based        | High        | Full TUI applications   |
| **terminal-kit**        | 3k+   | Low-level + widgets | High        | Custom terminal UIs     |

### Quick Decision Tree

```
Need complex navigation (tabs, back button)?
├─ YES → Do you know React?
│   ├─ YES → Use Ink
│   └─ NO → Use blessed/neo-blessed
└─ NO → Is prompt flow linear?
    ├─ YES → Keep @clack/prompts
    └─ NO (conditional) → Use Inquirer.js
```

---

## Detailed Framework Analysis

### 1. @clack/prompts (Current)

**Strengths:**

- Beautiful, minimal UI
- Simple API
- `group()` for conditional flows
- Used by Astro, SvelteKit, create-t3-app

**Limitations:**

- No back navigation
- No dynamic option updates
- No horizontal/tab navigation
- Cannot disable options after render

```typescript
// What it CAN do
p.group({
  step1: () => p.select({ ... }),
  step2: ({ results }) => {
    // Conditional based on previous
    if (results.step1 === 'x') return p.select({ ... });
    return Promise.resolve(undefined);
  }
});

// What it CANNOT do
// - Go back to step1 after step2
// - Disable options within a select based on other selections
// - Horizontal navigation
```

---

### 2. Inquirer.js / @inquirer/prompts

**Strengths:**

- Industry standard (ESLint, Webpack, Yarn use it)
- Dynamic `choices` as function
- `disabled` property (static or function in legacy)
- `when` for conditional questions

**Limitations:**

- No built-in back navigation
- No horizontal tabs
- Disabled function only in legacy package

```typescript
// Dynamic choices
const answer = await select({
  message: 'Select:',
  choices: previousAnswers.map(a => ({
    name: a.name,
    value: a.value,
    disabled: someCondition(a) ? 'Not available' : false
  }))
});

// Conditional questions (legacy inquirer)
{
  type: 'list',
  name: 'stateManagement',
  when: (answers) => answers.framework === 'react'
}
```

**For back navigation**, you need external state management:

```typescript
let step = 0;
const answers = {};

while (step < totalSteps) {
  const result = await runStep(step, answers);

  if (result === "BACK" && step > 0) {
    step--;
  } else {
    answers[step] = result;
    step++;
  }
}
```

---

### 3. Ink (React for CLI)

**Strengths:**

- Full React component model
- `useFocus` for tab navigation
- `useFocusManager` for programmatic focus
- `useInput` for keyboard handling
- `ink-tab` package for tab components
- Complete control over rendering

**Limitations:**

- Requires React knowledge
- More setup than prompt libraries
- Bundle size larger

```tsx
import { render, Box, Text, useFocus, useFocusManager, useInput } from "ink";
import { Tabs, Tab } from "ink-tab";

function Wizard() {
  const [section, setSection] = useState("frontend");
  const { focus } = useFocusManager();

  useInput((input, key) => {
    if (key.rightArrow) setSection(getNextSection(section));
    if (key.leftArrow) setSection(getPrevSection(section));
  });

  return (
    <Box flexDirection="column">
      <Tabs onChange={setSection}>
        <Tab name="frontend">Frontend</Tab>
        <Tab name="backend">Backend</Tab>
        <Tab name="database">Database</Tab>
      </Tabs>

      {section === "frontend" && <FrontendOptions />}
      {section === "backend" && <BackendOptions />}
    </Box>
  );
}

function Option({ label, disabled, onSelect }) {
  const { isFocused } = useFocus({ isActive: !disabled });

  return (
    <Text
      color={disabled ? "gray" : isFocused ? "cyan" : "white"}
      dimColor={disabled}
    >
      {isFocused ? ">" : " "} {label}
      {disabled && " (disabled)"}
    </Text>
  );
}
```

**Key Ink Features for Your Requirements:**

| Feature          | Ink Solution                              |
| ---------------- | ----------------------------------------- |
| Horizontal tabs  | `ink-tab` package or custom `<Tabs>`      |
| Back navigation  | React state + `useInput` for key handling |
| Disable options  | `useFocus({ isActive: !disabled })`       |
| Color/hints      | `<Text color="..." dimColor={...}>`       |
| Focus management | `useFocusManager().focus(id)`             |

---

### 4. blessed / neo-blessed

**Strengths:**

- Full TUI framework (like ncurses)
- `blessed-tab-container` for tabs
- `blessed-contrib` for advanced widgets
- Carousel layout for view switching
- Grid layout for complex arrangements

**Limitations:**

- Steep learning curve
- Less maintained (neo-blessed is fork)
- Verbose API

```javascript
const blessed = require("neo-blessed");
const contrib = require("blessed-contrib");

const screen = blessed.screen();

// Tab container
const tabs = require("blessed-tab-container")({
  parent: screen,
  tabs: [
    { name: "Frontend", content: frontendWidget },
    { name: "Backend", content: backendWidget },
  ],
});

// Carousel for switching views
const carousel = new contrib.carousel(
  [frontendPage, backendPage, databasePage],
  { screen, interval: 0, controlKeys: true },
);
```

---

### 5. terminal-kit

**Strengths:**

- Low-level terminal control
- High-level widgets available
- `terminal-kit-plugins` for actions list
- Full color and styling control

**Limitations:**

- Less community adoption
- Documentation gaps
- More DIY required

```javascript
const term = require("terminal-kit").terminal;

// Scrollable action list
const actions = require("terminal-kit-plugins").actions;

await actions(term, {
  items: [
    { label: "Option 1", action: () => {} },
    { label: "Option 2", disabled: true },
  ],
});
```

---

## Capability Matrix

| Capability              | @clack | Inquirer  | Ink          | blessed | terminal-kit |
| ----------------------- | ------ | --------- | ------------ | ------- | ------------ |
| **Horizontal tabs**     | ❌     | ❌        | ✅ `ink-tab` | ✅      | ⚠️ Custom    |
| **Back navigation**     | ❌     | ⚠️ Manual | ✅ State     | ✅      | ⚠️ Manual    |
| **Disable options**     | ❌     | ✅ Static | ✅ Dynamic   | ✅      | ✅           |
| **Dynamic disable**     | ❌     | ⚠️ Legacy | ✅           | ✅      | ✅           |
| **Sibling navigation**  | ❌     | ❌        | ✅           | ✅      | ⚠️ Custom    |
| **Hints/colors**        | ✅     | ✅        | ✅           | ✅      | ✅           |
| **Multi-select groups** | ✅     | ✅        | ⚠️ Custom    | ✅      | ⚠️ Custom    |
| **Conditional flow**    | ✅     | ✅        | ✅           | ✅      | ✅           |
| **Learning curve**      | Low    | Low       | Medium       | High    | Medium       |
| **Bundle size**         | Small  | Small     | Medium       | Large   | Medium       |
| **TypeScript**          | ✅     | ✅        | ✅           | ⚠️      | ⚠️           |

Legend: ✅ Native | ⚠️ Possible with effort | ❌ Not supported

---

## Implementation Options

### Option A: Enhance @clack/prompts (Minimal Change)

**Approach**: Keep @clack for simple flows, add state machine for complex navigation.

```typescript
// State machine for navigation
type WizardState = {
  currentSection: 'frontend' | 'backend' | 'database';
  selections: Record<string, unknown>;
  history: string[]; // For back navigation
};

async function runWizard() {
  const state: WizardState = { ... };

  while (!isComplete(state)) {
    const section = await renderSection(state.currentSection, state);

    if (section.action === 'back') {
      state.currentSection = state.history.pop();
    } else if (section.action === 'next') {
      state.history.push(state.currentSection);
      state.currentSection = getNextSection(state);
    }

    state.selections = { ...state.selections, ...section.data };
  }
}
```

**Pros**: Minimal changes, reuse existing code
**Cons**: Still no horizontal tabs, awkward UX

---

### Option B: Migrate to Ink (Recommended for Full Features)

**Approach**: Build wizard as React components with full control.

```
src/cli/
├── commands/
│   └── init/
│       ├── index.tsx          # Main wizard component
│       ├── sections/
│       │   ├── frontend.tsx   # Frontend section
│       │   ├── backend.tsx    # Backend section
│       │   └── database.tsx   # Database section
│       ├── components/
│       │   ├── tabs.tsx       # Tab navigation
│       │   ├── option.tsx     # Selectable option
│       │   └── section.tsx    # Section wrapper
│       └── state.ts           # Wizard state management
```

**Example Implementation:**

```tsx
// index.tsx
import { render, Box, useInput } from "ink";
import { Tabs, Tab } from "ink-tab";

const SECTIONS = ["frontend", "backend", "database"] as const;

function InitWizard() {
  const [sectionIndex, setSectionIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  useInput((input, key) => {
    if (key.rightArrow && sectionIndex < SECTIONS.length - 1) {
      setSectionIndex((i) => i + 1);
    }
    if (key.leftArrow && sectionIndex > 0) {
      setSectionIndex((i) => i - 1);
    }
  });

  const currentSection = SECTIONS[sectionIndex];

  // Compute disabled options based on selections
  const disabledOptions = computeDisabled(selections);

  return (
    <Box flexDirection="column">
      <Tabs onChange={(name) => setSectionIndex(SECTIONS.indexOf(name))}>
        {SECTIONS.map((s) => (
          <Tab key={s} name={s}>
            {s}
          </Tab>
        ))}
      </Tabs>

      <SectionRenderer
        section={currentSection}
        selections={selections}
        disabledOptions={disabledOptions}
        onSelect={(key, value) =>
          setSelections((s) => ({ ...s, [key]: value }))
        }
      />

      <Text dimColor>
        ← → to navigate sections | ↑ ↓ to select | Enter to confirm
      </Text>
    </Box>
  );
}

render(<InitWizard />);
```

**Pros**: Full feature set, clean architecture, React ecosystem
**Cons**: Learning curve, more code

---

### Option C: Hybrid (Ink for Complex, @clack for Simple)

**Approach**: Use Ink only for the stack creation wizard, keep @clack for everything else.

```typescript
// Simple commands stay with @clack
export const compileCommand = new Command('compile')
  .action(async () => {
    const s = p.spinner();
    // ... simple flow
  });

// Complex wizard uses Ink
export const createStackCommand = new Command('create stack')
  .action(async () => {
    // Launch Ink app
    const { waitUntilExit } = render(<StackWizard />);
    await waitUntilExit();
  });
```

**Pros**: Best of both worlds, incremental migration
**Cons**: Two paradigms to maintain

---

## Recommendations

### For Your Specific Needs

Given your requirements (horizontal tabs, complex relationships, back navigation, conditional disabling), **Ink is the best choice**.

### Implementation Priority

1. **Phase 1**: Add `ink` and `ink-tab` to dependencies
2. **Phase 2**: Build core wizard components (`Tabs`, `Option`, `Section`)
3. **Phase 3**: Implement state management for relationships
4. **Phase 4**: Integrate with existing CLI commands

### Suggested Dependencies

```json
{
  "dependencies": {
    "ink": "^5.0.1",
    "ink-tab": "^5.2.0",
    "react": "^18.3.1",
    "@inkjs/ui": "^2.0.0"
  }
}
```

### Alternative: If Ink is Too Much

If you want to stay closer to the current implementation:

1. **Use Inquirer.js** for dynamic disabled options
2. **Build custom state machine** for back navigation
3. **Accept limitation** of no horizontal tabs (use numbered sections instead)

```typescript
// Numbered sections as alternative to tabs
[1] Frontend  [2] Backend  [3] Database
    ^^^^^^^^

Select section (1-3) or press Enter to continue: _
```

---

## Sources

### Official Documentation

- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [Inquirer.js GitHub](https://github.com/SBoudrias/Inquirer.js)
- [blessed GitHub](https://github.com/chjj/blessed)
- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts)

### Research Articles

- [Ink 3 Release Notes](https://vadimdemedes.com/posts/ink-3)
- [Using Ink UI - LogRocket](https://blog.logrocket.com/using-ink-ui-react-build-interactive-custom-clis/)
- [Ink v3 Advanced Components](https://developerlife.com/2021/11/25/ink-v3-advanced-ui-components/)
- [Building Terminal Interfaces with Node.js](https://blog.openreplay.com/building-terminal-interfaces-nodejs/)

### Packages

- [ink-tab](https://github.com/jdeniau/ink-tab) - Tab component for Ink
- [blessed-tab-container](https://www.npmjs.com/package/blessed-tab-container) - Tabs for blessed
- [@inkjs/ui](https://www.npmjs.com/package/@inkjs/ui) - UI component library for Ink
- [wizard-state-machine](https://www.npmjs.com/package/wizard-state-machine) - State machine for wizards

### Community Discussions

- [Inquirer.js #118 - Checkbox disable other choices](https://github.com/SBoudrias/Inquirer.js/issues/118)
- [prompt-wizard - Multi-step prompts](https://github.com/lennym/prompt-wizard)

---

## Next Steps

1. **Decision**: Choose between Ink (full features) or enhanced @clack (simpler)
2. **Prototype**: Build proof-of-concept for the most complex flow
3. **Migrate**: Incrementally update CLI commands
4. **Test**: Verify all navigation patterns work as expected

---

_Created: 2026-01-20_

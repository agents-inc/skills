## Example Documentation Sessions

### Example 1: Initial Session (No Map Exists)

**User Request:** "Document the codebase for other agents"

**Your Response:**

```xml
<documentation_session>
**Mode:** new
**Target Area:** Create documentation map
**Progress:** 0 of [estimated] areas documented

<map_status>
**Documentation Map:** `.claude/docs/DOCUMENTATION_MAP.md`
**Last Updated:** not exists

**Action:** Creating initial documentation map
</map_status>
</documentation_session>
```

**You would:**

1. Use Glob to find major areas (features, stores, components)
2. Create initial DOCUMENTATION_MAP.md with all areas marked "not started"
3. Recommend starting with most critical area (likely stores)
4. Update map with initial structure

---

### Example 2: Documenting Stores

**User Request:** "Document the state management"

**Your Response:**

```xml
<documentation_session>
**Mode:** new
**Target Area:** State Management (Stores)
**Progress:** 1 of 8 areas documented (12.5%)

<map_status>
**Documentation Map:** `.claude/docs/DOCUMENTATION_MAP.md`
**Last Updated:** 2025-01-24

**Documented Areas:**
- None yet

**Undocumented Areas:**
- State Management ⏳ (starting now)
- Component Patterns
- Anti-Patterns
- [5 more...]

**Next Priority:** State Management
</map_status>
</documentation_session>
```

**You would:**

1. Use Glob to find all stores: `**/*Store.ts`
2. Read each store file completely
3. Identify patterns (MobX? Redux? Context?)
4. Map relationships between stores
5. Note actions, observables, patterns
6. Create `store-map.md` using template
7. Update `DOCUMENTATION_MAP.md` marking stores as complete
8. Report what was documented

---

### Example 3: Validating Documentation

**User Request:** "Validate the component patterns documentation"

**Your Response:**

```xml
<documentation_session>
**Mode:** validate
**Target Area:** Component Patterns
**Progress:** 2 of 8 areas documented (25%), validating 1

<map_status>
**Documentation Map:** `.claude/docs/DOCUMENTATION_MAP.md`
**Last Updated:** 2025-01-24

**Action:** Validating `component-patterns.md` (last updated 14 days ago)
</map_status>
</documentation_session>
```

**You would:**

1. Read `component-patterns.md`
2. Extract all file path claims
3. Verify each path exists
4. Extract pattern claims (e.g., "all components use SCSS Modules")
5. Use Glob/Grep to verify claims
6. Check for new patterns since doc was created
7. Update doc with findings
8. Report drift and updates

---

### Example 4: Progressive Documentation

**Session 1:** Create map, document stores
**Session 2:** Document component patterns
**Session 3:** Document anti-patterns
**Session 4:** Validate stores (1 week later)
**Session 5:** Document Editor feature
**Session 6:** Document Auth feature
**Session 7:** Validate component patterns (2 weeks later)

Each session builds on previous work. The map tracks it all.

---

## Example Output: Store/State Map

```markdown
# Store/State Map

**Last Updated:** 2025-01-24
**Coverage:** EditorStore, UserStore, LayerStore

## State Management Library

**Library:** MobX
**Pattern:** Root store with individual stores

## Stores

| Store       | File Path                    | Purpose              | Key Observables                     | Key Actions                      |
| ----------- | ---------------------------- | -------------------- | ----------------------------------- | -------------------------------- |
| EditorStore | `/src/stores/EditorStore.ts` | Manages editor state | `layers`, `selectedTool`, `history` | `addLayer()`, `undo()`, `redo()` |
| UserStore   | `/src/stores/UserStore.ts`   | User session         | `currentUser`, `isAuthenticated`    | `login()`, `logout()`            |

## Store Relationships

- RootStore: `/src/stores/RootStore.ts` - Initializes and provides all stores
- EditorStore imports LayerStore for layer management
- UserStore is independent

## Usage Pattern

**How stores are accessed:**

```typescript
import { useStore } from "@/contexts/StoreContext";
const { editorStore } = useStore();
```

**Example files using this pattern:**
- `/src/components/Editor/EditorCanvas.tsx:15`
- `/src/components/Toolbar/ToolSelector.tsx:8`
```

---

## Example Output: Anti-Patterns

```markdown
# Anti-Patterns

**Last Updated:** 2025-01-24

## State Management

### Direct Store Mutation

**What it is:**
Mutating store state directly without using actions

**Where it exists:**
- `/src/legacy/OldEditor.tsx:123` - `editorStore.layers.push(newLayer)`

**Why it's wrong:**
- Breaks MobX reactivity tracking
- No history/undo support

**Do this instead:**
```typescript
// Use store actions
editorStore.addLayer(newLayer)
```

**Files following correct pattern:**
- `/src/components/Editor/EditorCanvas.tsx`
```

---

## Example Output: Feature Map

```markdown
# Feature: Editor

**Last Updated:** 2025-01-24

## Overview

**Purpose:** Image editing with layers, tools, and export
**User-Facing:** yes
**Status:** active

## Entry Points

**Route:** `/editor/:imageId`
**Main Component:** `/src/features/editor/EditorPage.tsx`
**API Endpoints:**
- `POST /api/editor/save`
- `GET /api/editor/load/:id`

## File Structure

```
src/features/editor/
├── components/
│   ├── EditorCanvas.tsx      # Main canvas component
│   ├── Toolbar.tsx           # Tool selection
│   └── LayerPanel.tsx        # Layer management
├── hooks/
│   ├── useEditorState.ts     # Editor state management
│   └── useCanvasInteraction.ts # Mouse/touch handling
├── stores/
│   └── EditorStore.ts        # MobX store
└── types/
    └── editor.types.ts       # TypeScript types
```

## Key Files

| File               | Lines | Purpose            | Dependencies                |
| ------------------ | ----- | ------------------ | --------------------------- |
| `EditorPage.tsx`   | 234   | Main page component | EditorStore, Canvas, Toolbar |
| `EditorCanvas.tsx` | 456   | Rendering engine   | EditorStore, canvas-helpers |
| `EditorStore.ts`   | 189   | State management   | RootStore, api-client       |
```

---

These examples demonstrate:
- Specific file paths with line numbers
- Concrete examples from actual code
- Clear structure for AI parsing
- Actionable patterns to follow
- Progressive session-based documentation

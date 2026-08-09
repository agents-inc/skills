# TipTap - Custom Extensions

> Custom nodes, marks, extensions, input rules, keyboard shortcuts, and React node views. See [core.md](core.md) for editor setup, [menus.md](menus.md) for bubble/floating menus.

---

## Pattern 1: Custom Block Node with Commands

### Good Example - Callout Node

```typescript
import { Node, mergeAttributes } from "@tiptap/core";

type CalloutType = "info" | "warning" | "error" | "success";

const DEFAULT_CALLOUT_TYPE: CalloutType = "info";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { type?: CalloutType }) => ReturnType;
      toggleCallout: (attrs?: { type?: CalloutType }) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",

  addOptions() {
    return {
      HTMLAttributes: {},
      types: ["info", "warning", "error", "success"] as CalloutType[],
    };
  },

  addAttributes() {
    return {
      type: {
        default: DEFAULT_CALLOUT_TYPE,
        parseHTML: (element) =>
          element.getAttribute("data-callout-type") ?? DEFAULT_CALLOUT_TYPE,
        renderHTML: (attributes) => ({
          "data-callout-type": attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": "callout" },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-c": () => this.editor.commands.toggleCallout(),
    };
  },
});
```

**Why good:** `declare module` adds type-safe commands to editor, `mergeAttributes` preserves user-added attributes, `data-*` attributes for HTML serialization, keyboard shortcut for quick access, configurable options with `.configure()`

### Bad Example

```typescript
const BadCallout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",

  // Missing parseHTML -- content won't load from saved HTML/JSON
  renderHTML() {
    return ["div", { class: "callout" }, 0]; // No mergeAttributes -- loses custom attrs
  },
  // No commands -- users can't insert this node
  // No addAttributes -- type info not persisted
});
```

**Why bad:** missing `parseHTML` means content cannot be restored from saved data, no `mergeAttributes` drops user attributes, hardcoded `class` instead of data attributes, no commands or keyboard shortcuts for inserting the node

---

## Pattern 2: Custom Inline Node (Mention)

```typescript
import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mention: {
      insertMention: (attrs: { id: string; label: string }) => ReturnType;
    };
  }
}

export const Mention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true, // Cannot edit content inside -- single unit

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-type": "mention", "data-id": node.attrs.id },
        HTMLAttributes,
      ),
      `@${node.attrs.label}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.label}`;
  },

  addCommands() {
    return {
      insertMention:
        (attrs) =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name, attrs }).run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          // Delete entire mention on backspace (atom behavior)
          const { selection } = state;
          const { empty, anchor } = selection;
          if (!empty) return false;

          const nodeBefore = state.doc.resolve(anchor).nodeBefore;
          if (nodeBefore?.type.name !== this.name) return false;

          tr.delete(anchor - nodeBefore.nodeSize, anchor);
          return true;
        }),
    };
  },
});
```

**Why good:** `atom: true` makes the mention a single selectable unit, `renderText` provides plain-text fallback for `getText()`, custom backspace deletes entire mention, type-safe command declaration

---

## Pattern 3: Custom Mark with Input Rule

```typescript
import {
  Mark,
  mergeAttributes,
  markInputRule,
  markPasteRule,
} from "@tiptap/core";

const HIGHLIGHT_INPUT_REGEX = /(?:==)((?:[^=]+))(?:==)$/;
const HIGHLIGHT_PASTE_REGEX = /(?:==)((?:[^=]+))(?:==)/g;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customHighlight: {
      setHighlight: (attrs?: { color?: string }) => ReturnType;
      toggleHighlight: (attrs?: { color?: string }) => ReturnType;
      unsetHighlight: () => ReturnType;
    };
  }
}

export const CustomHighlight = Mark.create({
  name: "customHighlight",

  addOptions() {
    return {
      HTMLAttributes: {},
      multicolor: false,
    };
  },

  addAttributes() {
    if (!this.options.multicolor) return {};

    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-color"),
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return { "data-color": attributes.color };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setHighlight:
        (attrs) =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs);
        },
      toggleHighlight:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attrs);
        },
      unsetHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-h": () => this.editor.commands.toggleHighlight(),
    };
  },

  addInputRules() {
    return [
      markInputRule({
        find: HIGHLIGHT_INPUT_REGEX,
        type: this.type,
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: HIGHLIGHT_PASTE_REGEX,
        type: this.type,
      }),
    ];
  },
});
```

**Why good:** input rule converts `==text==` to highlight as user types (regex ends with `$`), paste rule applies on paste (uses `/g` flag), configurable multicolor via options, all three commands (set/toggle/unset) for full control

**Input rule vs paste rule regex:**

- Input rules: regex must end with `$` (matches at cursor position as you type)
- Paste rules: regex must NOT end with `$` but must use `/g` (matches all occurrences in pasted content)

---

## Pattern 4: React Node View

```tsx
import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
} from "@tiptap/react";

// Step 1: The React component
interface CounterViewProps {
  node: { attrs: { count: number } };
  updateAttributes: (attrs: { count: number }) => void;
  deleteNode: () => void;
  selected: boolean;
}

const INITIAL_COUNT = 0;

function CounterView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: CounterViewProps) {
  return (
    <NodeViewWrapper
      className="counter-widget"
      data-selected={selected || undefined}
    >
      <div contentEditable={false}>
        <span>Count: {node.attrs.count}</span>
        <button
          onClick={() => updateAttributes({ count: node.attrs.count + 1 })}
        >
          +1
        </button>
        <button onClick={() => updateAttributes({ count: INITIAL_COUNT })}>
          Reset
        </button>
        <button onClick={deleteNode}>Remove</button>
      </div>
      {/* NodeViewContent renders editable child content */}
      <NodeViewContent as="p" className="counter-description" />
    </NodeViewWrapper>
  );
}

// Step 2: The node extension
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    counter: {
      insertCounter: () => ReturnType;
    };
  }
}

export const Counter = Node.create({
  name: "counter",
  group: "block",
  content: "inline*",
  atom: false, // Has editable content via NodeViewContent

  addAttributes() {
    return {
      count: { default: INITIAL_COUNT },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="counter"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "counter" }, HTMLAttributes),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CounterView);
  },

  addCommands() {
    return {
      insertCounter:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { count: INITIAL_COUNT },
          });
        },
    };
  },
});
```

**Why good:** `NodeViewWrapper` is required as outer element, `contentEditable={false}` on interactive controls prevents TipTap from capturing button clicks, `NodeViewContent` renders editable area, `selected` prop for visual feedback, `deleteNode` for self-removal, `updateAttributes` persists changes to document

---

## Pattern 5: Extending Built-In Extensions

```typescript
import Heading from "@tiptap/extension-heading";

// Add a custom ID attribute to headings for anchor links
export const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(), // Preserve parent attributes (level)
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) => {
          if (!attributes.id) return {};
          return { id: attributes.id };
        },
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(), // Preserve parent shortcuts
      "Mod-Alt-1": () => this.editor.commands.toggleHeading({ level: 1 }),
      "Mod-Alt-2": () => this.editor.commands.toggleHeading({ level: 2 }),
    };
  },
});
```

**Why good:** `this.parent?.()` preserves all existing behavior from the base extension, only adds what's new -- avoids reimplementing the entire extension

---

## Pattern 6: Functionality Extension (No Schema)

```typescript
import { Extension } from "@tiptap/core";
import { Plugin } from "prosemirror-state";

const MAX_CHARS_DEFAULT = 5000;

export const WordCount = Extension.create({
  name: "wordCount",

  addOptions() {
    return {
      limit: MAX_CHARS_DEFAULT,
    };
  },

  addStorage() {
    return {
      characters: 0,
      words: 0,
    };
  },

  onUpdate() {
    const text = this.editor.state.doc.textContent;
    this.storage.characters = text.length;
    this.storage.words = text.split(/\s+/).filter(Boolean).length;
  },

  addProseMirrorPlugins() {
    const limit = this.options.limit;
    return [
      new Plugin({
        filterTransaction: (transaction) => {
          if (!transaction.docChanged) return true;
          const newSize = transaction.doc.textContent.length;
          return newSize <= limit;
        },
      }),
    ];
  },
});

// Usage:
// editor.storage.wordCount.characters
// editor.storage.wordCount.words
```

**Why good:** `addStorage` provides reactive state accessible from components, `filterTransaction` enforces character limit at the ProseMirror level, no schema changes needed for functionality-only extensions

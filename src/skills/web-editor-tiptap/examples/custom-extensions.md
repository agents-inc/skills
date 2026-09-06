# TipTap - Custom Extensions

> Custom nodes and marks, input and paste rules, keyboard shortcuts, node views, extending
> built-ins. See [SKILL.md](../SKILL.md) for which extension type to reach for, [core.md](core.md)
> for editor setup, [menus.md](menus.md) for menus.

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

**Why good:** the `declare module` block is what makes `editor.commands.toggleCallout()` type-check
at every call site; the attribute round-trips through matching `parseHTML`/`renderHTML` on
`data-callout-type`, and `mergeAttributes` keeps whatever the caller passed

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

**Why bad:** without `parseHTML` the node renders once and can never be parsed back, so saved
content loses it; without `mergeAttributes` the hardcoded `class` overwrites anything the caller
passed; and with no command there is no way to insert the node at all

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

**Why good:** `atom: true` makes the mention one unit rather than editable text, `renderText` is what
`getText()` uses so search indexes see `@name` instead of nothing, and the backspace handler returns
`false` whenever the node before the cursor is not a mention, leaving normal deletion alone

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

**Why good:** `addAttributes` returns `{}` when `multicolor` is off, so the schema carries no
attribute the editor cannot use; set, toggle and unset are all present, which a toolbar and a
keyboard shortcut need between them.

**Input rule vs paste rule regex:** an input rule matches at the cursor, so its regex ends with `$`;
a paste rule matches every occurrence in the pasted text, so its regex carries `/g` and must not end
with `$`.

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

**Why good:** `updateAttributes` writes through a transaction, so the count is part of the document
and survives undo and serialization rather than living in component state; `contentEditable={false}`
keeps the editor from treating the buttons as text, and `NodeViewContent` marks the one region that
is editable

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

**Why good:** `this.parent?.()` spreads the base extension's own result, so omitting it silently
replaces every attribute and shortcut Heading already defined rather than adding to them

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

**Why good:** `filterTransaction` rejects the transaction before it applies, which is why the limit
cannot be exceeded even momentarily; `addStorage` gives components a place to read the counts from
without a schema change

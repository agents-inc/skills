---
name: web-editor-tiptap
description: Headless rich text editor framework built on ProseMirror. Use when building an editor with TipTap — setup, extensions, custom nodes and marks, menus, node views, serialization.
---

# TipTap Editor Patterns

> **Quick Guide:** TipTap is a headless editor: it owns the schema, the state and the behaviour, and
> hands the UI entirely to you. Everything is an extension — Nodes define content that lives in the
> document, Marks define formatting applied to ranges of text, and Extensions add behaviour without
> touching the schema. Commands are chained and applied by `.run()`. JSON is the persistence format.
> **Current: v3.x** — Floating UI replaced Tippy.js, menus moved to a `/menus` sub-path, and
> StarterKit now includes Link and Underline.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — editor setup, toolbars, serialization and persistence, `useEditorState`, `EditorContext`
- [examples/custom-extensions.md](examples/custom-extensions.md) — custom nodes and marks, input and paste rules, keyboard shortcuts, node views, extending built-ins
- [examples/menus.md](examples/menus.md) — BubbleMenu, FloatingMenu, multiple menus, slash commands, fixed toolbars
- [reference.md](reference.md) — StarterKit contents, schema and extension API tables, content expressions, v2 → v3 migration

---

## Which path applies

- **React** — `useEditor` returns the editor and `EditorContent` renders the editable area. Start at
  [examples/core.md](examples/core.md).
- **Vue or vanilla** — construct the `Editor` class from `@tiptap/core` directly. Every extension in
  [examples/custom-extensions.md](examples/custom-extensions.md) is unchanged; only the adapter and
  the node-view renderer differ.
- **Server-rendered** — the editor cannot render on the server at all. Set
  `immediatelyRender: false` and let it mount on the client.

---

<critical_requirements>

## Before writing TipTap code

**Set `immediatelyRender: false` in `useEditor` under any server-rendering framework.** The editor
builds a DOM view on construction, so rendering it on the server produces a hydration mismatch.

**Import `BubbleMenu` and `FloatingMenu` from the `/menus` sub-path** — `@tiptap/react/menus` in v3.
The root export no longer carries them.

**Give every custom Node a `name`, a `group`, a `parseHTML` and a `renderHTML`.** Schema resolution
needs all four; content saved by a node missing `parseHTML` cannot be loaded back.

**Write chained commands as `editor.chain().focus()...run()`.** `.focus()` returns the cursor to the
editor before the command applies, and `.run()` is what dispatches the transaction — a chain without
it builds a transaction and discards it.

</critical_requirements>

---

**Auto-detection:** TipTap, tiptap, `@tiptap/core`, `@tiptap/react`, `@tiptap/vue-3`, `@tiptap/starter-kit`, `@tiptap/pm`, useEditor, useEditorState, EditorContent, EditorContext, BubbleMenu, FloatingMenu, Node.create, Mark.create, Extension.create, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, editor.chain, editor.commands, editor.isActive, mergeAttributes, addKeyboardShortcuts, addInputRules, addPasteRules, addNodeView, addProseMirrorPlugins

**Applies to:**

- Rich text editors with custom formatting and block types
- Custom content types — embeds, mentions, callouts, syntax-highlighted code — as extensions
- Contextual editing UI: bubble menus, floating menus, slash commands
- Interactive blocks rendered as framework components through node views
- Automatic formatting through input rules and paste rules
- Serializing the document to JSON or HTML

**Handled elsewhere:**

- Everything the editor renders around itself — TipTap is headless, so buttons, popovers, layout and
  visual design are settled by whatever owns components and styling
- Where the document goes after `getJSON()` — the transport and the store are not the editor's
  concern
- Real-time sync between clients — the editor exposes the state to bind and settles none of the
  transport
- Sanitizing HTML before `setContent` — the parser maps what it is given onto the schema and does
  not clean it

---

<philosophy>

**Headless.** TipTap provides behaviour, schema and state, and imposes no UI. Every toolbar, menu
and control in this skill is ordinary component code reading `editor.isActive(...)` and dispatching
commands.

**Everything is an extension**, including paragraphs, bold and undo. So the schema is exactly what
you assembled: nothing is present that you did not add, and any built-in can be configured or
extended rather than worked around.

**ProseMirror underneath.** The schema system, transaction model and plugin architecture are
ProseMirror's, reached through `@tiptap/pm/*`. Where TipTap's API runs out, `addProseMirrorPlugins()`
is the escape hatch rather than a rewrite.

**One core, several adapters.** `@tiptap/core` is framework-free; `@tiptap/react` and
`@tiptap/vue-3` add hooks and components over the same editor.

</philosophy>

---

<decision_framework>

### Which extension type

```
New content that lives in the document?
├─ Block-level (paragraph, heading, image)?  → Node, group: "block"
├─ Inline element (mention, emoji)?          → Node, group: "inline", inline: true
└─ Formatting over a text range?             → Mark

Behaviour with no schema change?
├─ Keyboard shortcut?                        → Extension + addKeyboardShortcuts
├─ Character count, placeholder, focus?      → Extension
└─ Lower-level control?                      → Extension + addProseMirrorPlugins
```

### How interactive is the node

```
Just renders HTML?                    → renderHTML alone, no node view
Needs editable child content?         → node view with NodeViewContent inside NodeViewWrapper
Buttons, inputs, live UI?             → node view, contentEditable={false} on the controls
```

### StarterKit or individual extensions

```
Do you need most of the standard formatting?
├─ YES → StarterKit, disabling what you do not want: StarterKit.configure({ codeBlock: false })
└─ NO  → Individual extensions, for a schema with nothing spare in it
```

### Which menu

```
On text selection?          → BubbleMenu
On empty lines?             → FloatingMenu
Always visible?             → an ordinary component reading editor state, no menu primitive
On a trigger character?     → an Extension wrapping the suggestion plugin
```

### How the content is stored

```
Database or API?            → getJSON()  — structured, diffable, migratable
Rendered elsewhere as HTML? → getHTML()  — for display outside the editor
Search index?               → getText()  — plain text
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Editor setup

`useEditor` builds the editor from a list of extensions; `EditorContent` renders the editable area.
The editor is `null` on the first render, so every consumer guards it.

```typescript
const editor = useEditor({
  extensions: [StarterKit],
  content: "<p>Start typing...</p>",
  immediatelyRender: false,
});

if (!editor) return null;
return <EditorContent editor={editor} />;
```

Options worth knowing: `editable`, `autofocus` (`"start" | "end" | "all" | number | boolean`),
`editorProps.attributes` for classes on the editable element, and `onUpdate`.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: The three extension types

| Type          | Defines                            | Examples                                     |
| ------------- | ---------------------------------- | -------------------------------------------- |
| **Node**      | Content blocks and inline elements | Paragraph, Heading, Image, CodeBlock, Table  |
| **Mark**      | Formatting over a text range       | Bold, Italic, Link, Highlight, Code          |
| **Extension** | Behaviour, with no schema change   | UndoRedo, CharacterCount, Placeholder, Focus |

```typescript
const CustomNode = Node.create({ name: "customNode" /* ... */ });
const CustomMark = Mark.create({ name: "customMark" /* ... */ });
const CustomExt = Extension.create({ name: "customExt" /* ... */ });
```

Nodes and Marks carry `parseHTML`/`renderHTML` because they are part of the schema. Extensions do
not.

Full code: [examples/custom-extensions.md](examples/custom-extensions.md)

---

### Pattern 3: Commands and chaining

A chain builds one transaction and `.run()` dispatches it.

```typescript
editor.chain().focus().toggleBold().run();
editor.chain().focus().toggleHeading({ level: 2 }).run();

editor.can().toggleBold(); // would it apply here — use it to disable the button
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Serialization

```typescript
const json = editor.getJSON(); // persistence
const html = editor.getHTML(); // display outside the editor
const text = editor.getText({ blockSeparator: "\n\n" }); // indexing

editor.commands.setContent(jsonData);
```

JSON maps straight onto the document tree, so it diffs, validates and migrates. HTML has to be
re-parsed against the current schema, and anything the schema no longer recognises is dropped.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Custom nodes

A node's schema is its `group`, its `content` expression and its HTML mapping. `mergeAttributes` is
what preserves attributes the caller added.

```typescript
const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  addAttributes: () => ({ type: { default: "info" } }),
  parseHTML: () => [{ tag: 'div[data-type="callout"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes({ "data-type": "callout" }, HTMLAttributes),
    0,
  ],
});
```

The `0` is the content hole where children render — omit it on atom and leaf nodes. Other schema
keys: `inline`, `atom` (a non-editable unit), `selectable`, `draggable`.

Full code: [examples/custom-extensions.md](examples/custom-extensions.md)

---

### Pattern 6: Custom marks

Marks look like nodes minus the content expression, and gain the boundary options.

```typescript
const Highlight = Mark.create({
  name: "highlight",
  addAttributes: () => ({ color: { default: "yellow" } }),
  parseHTML: () => [{ tag: "mark" }],
  renderHTML: ({ HTMLAttributes }) => [
    "mark",
    mergeAttributes(HTMLAttributes),
    0,
  ],
  addCommands() {
    return {
      toggleHighlight:
        (attrs) =>
        ({ commands }) =>
          commands.toggleMark(this.name, attrs),
    };
  },
});
```

`inclusive` decides whether typing at the boundary extends the mark, `excludes` names marks that
cannot coexist with it, and `spanning` whether it crosses node boundaries.

Full code: [examples/custom-extensions.md](examples/custom-extensions.md)

---

### Pattern 7: BubbleMenu and FloatingMenu

BubbleMenu follows a text selection; FloatingMenu appears on empty lines. Both position through
Floating UI in v3.

```typescript
import { BubbleMenu } from "@tiptap/react/menus";

<BubbleMenu editor={editor} shouldShow={({ state }) => !state.selection.empty}>
  <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
</BubbleMenu>;
```

`shouldShow` is what keeps a menu off selections it has nothing to offer, and `pluginKey`
distinguishes several menus on one editor.

Full code: [examples/menus.md](examples/menus.md)

---

### Pattern 8: Node views

A node view replaces a node's rendering with a component, for blocks that need live UI.

```tsx
function CalloutView({ node, updateAttributes }) {
  return (
    <NodeViewWrapper className="callout">
      <select
        contentEditable={false}
        value={node.attrs.type}
        onChange={(e) => updateAttributes({ type: e.target.value })}
      >
        <option value="info">Info</option>
      </select>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}

Node.create({
  name: "callout",
  addNodeView: () => ReactNodeViewRenderer(CalloutView),
});
```

`NodeViewWrapper` is the outer element the editor expects, `NodeViewContent` marks the editable
region, and `contentEditable={false}` keeps the editor's hands off the controls. Props available:
`editor`, `node`, `selected`, `extension`, `getPos()`, `updateAttributes()`, `deleteNode()`,
`decorations`.

Full code: [examples/custom-extensions.md](examples/custom-extensions.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `immediatelyRender` left unset under a server-rendering framework — hydration mismatch and server
  render errors — set it to `false`
- `BubbleMenu`/`FloatingMenu` imported from `@tiptap/react` in v3 — the export is not there — use
  `@tiptap/react/menus`
- `editor` used before a null guard — it is `null` on the first render and during SSR — return early
  until it exists
- A chain with no `.run()` — the transaction is built and dropped, so the command silently does
  nothing
- A custom node or mark missing `parseHTML`/`renderHTML` — its content cannot be loaded back or
  exported
- `Link` or `Underline` added beside StarterKit v3 — duplicate extension error, since StarterKit now
  includes both — configure them through StarterKit, or disable them there first
- Mutating `editor.state.doc`, or writing into the rendered `.ProseMirror` DOM, directly — both
  bypass the transaction pipeline, so the view and the state diverge and the next transaction
  overwrites the change — go through commands

**Surprising behaviour:**

- A command chain without `.focus()` runs against a stale cursor once focus has left the editor, so
  a toolbar click lands somewhere the user did not select
- `getPos()` can return `undefined` in v3 — check it before using the position
- `NodeViewContent`'s tag is fixed at mount; `as` cannot change at runtime
- `renderHTML` without `mergeAttributes` silently drops the class, style and `data-*` attributes the
  caller passed
- Input-rule regexes must end with `$`; paste-rule regexes must not, and must carry `/g`
- When several input rules match the same text, only the first in extension order fires
- A `content` expression mismatch — `"block+"`, `"inline*"`, `"text*"` — surfaces as a schema
  validation error rather than as a rendering problem
- `editor.getJSON()` on every keystroke serializes the whole document each time; debounce it on
  large documents
- A toolbar button that ignores `editor.can()` looks clickable while the command would fail

</red_flags>

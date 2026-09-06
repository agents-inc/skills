---
name: web-editor-lexical
description: Extensible text editor framework by Meta. Use when building a rich text editor on Lexical — editor setup, custom nodes, commands, transforms, and serialization.
---

# Lexical Editor Patterns

> **Quick Guide:** Lexical is an editor framework rather than an editor: the core gives you a node
> tree, a selection model, a reconciler, a command bus and an update lifecycle, and everything else
> is a plugin. EditorState is immutable, so every read and every mutation happens inside an
> `editor.update()` or `editor.read()` closure, and the `$`-prefixed functions are the ones that
> require that context. Extend the tree through `ElementNode`, `TextNode` or `DecoratorNode`, and
> react to content through transforms rather than listeners. **Current: v0.42.x, pre-1.0 — APIs
> still move between minors.**

**Detailed Resources:**

- [examples/core.md](examples/core.md) — editor setup, plugins with cleanup, toolbars, transforms, persistence
- [examples/custom-nodes.md](examples/custom-nodes.md) — ElementNode, TextNode and DecoratorNode classes, the NodeState and `$config` APIs
- [examples/serialization.md](examples/serialization.md) — JSON and HTML round trips, `exportDOM`/`importDOM`, headless editors
- [reference.md](reference.md) — package map, command priorities, built-in commands, node hierarchy, plugin list, custom-node checklist

---

## Which path applies

- **A React app** — `LexicalComposer` owns the editor and every plugin is a child component
  reaching it through `useLexicalComposerContext()`. Start at
  [examples/core.md](examples/core.md).
- **A server or a build step, with no DOM** — `createHeadlessEditor` from `@lexical/headless` runs
  the same node classes for search indexing, email rendering and content transforms. Register the
  same nodes as the client. See [examples/serialization.md](examples/serialization.md).
- **Adding a content type** — the work is a node class plus its registration, and the branch that
  matters is which base node it extends. See the decision framework below and
  [examples/custom-nodes.md](examples/custom-nodes.md).

---

<critical_requirements>

## Before writing Lexical code

**Call `$`-prefixed functions inside an `editor.update()` or `editor.read()` closure.** `$getRoot`,
`$getSelection`, `$createTextNode` and their siblings read the active editor state from a context
that only exists inside those closures; outside one they throw at runtime, and nothing catches it at
compile time.

**Register every custom node in `initialConfig.nodes`.** An unregistered node throws or silently
drops content the moment the editor meets it, including on deserialization of previously saved
documents.

**Return the unsubscribe function from the `useEffect` that registers a command, transform or
listener.** Every `register*` method hands one back, and dropping it leaks a listener per render.

**Open every transform with a precondition that the mutation makes false.** A transform that
mutates its target unconditionally marks the node dirty, which re-triggers the transform and freezes
the editor.

</critical_requirements>

---

**Auto-detection:** Lexical, `@lexical/react`, `@lexical/rich-text`, `@lexical/list`, `@lexical/code`, `@lexical/link`, `@lexical/html`, `@lexical/headless`, LexicalComposer, EditorState, LexicalNode, ElementNode, TextNode, DecoratorNode, createCommand, dispatchCommand, registerCommand, COMMAND_PRIORITY, `$getRoot`, `$getSelection`, `$createParagraphNode`, `$createTextNode`, RichTextPlugin, OnChangePlugin, HistoryPlugin, useLexicalComposerContext, editor.update, editor.read, registerNodeTransform, exportJSON, importJSON, exportDOM, importDOM, NodeState, createState

**Applies to:**

- Rich text editing with custom formatting and embedded content
- Custom content types — mentions, embeds, callouts, polls — as node classes
- Structured document output rather than an HTML string
- Server-side or build-time processing of editor content
- Collaborative editing, where Lexical supplies the binding point

**Handled elsewhere:**

- Visual design of the editor — the theme maps class names onto nodes, and what those classes
  contain is settled by whatever owns styling
- Where the serialized document goes — the editor hands back JSON, and the transport and store are
  not its concern
- Real-time sync between clients — Lexical exposes the state to bind, and the sync layer itself is
  a separate concern
- Sanitizing HTML entering or leaving the editor — `$generateNodesFromDOM` trusts what it is given

---

<philosophy>

Lexical ships a core and no editor. The tree, selection, reconciler, command bus and update
lifecycle are the product; toolbars, lists, links, embeds and formatting are all plugins, including
the ones Meta writes.

**EditorState is immutable.** The editor holds a frozen snapshot. `editor.update()` clones it,
applies the closure's changes, and reconciles the difference to the DOM — which is why a stale read
outside a closure has no state to read and throws.

**A plugin is a React component.** It renders as a child of `<LexicalComposer>`, reaches the editor
through `useLexicalComposerContext()`, and registers its commands, transforms and listeners in a
`useEffect` that returns their unsubscribes. Many plugins render `null`.

**Commands are the bus.** Typed commands with priority-ordered listeners let one plugin intercept
or augment another's behaviour without either knowing about the other.

**Content is typed nodes.** A new kind of content is a new node class, not a new attribute.

Lexical is pre-1.0, so a project that needs a frozen API surface should weigh that before adopting
it. Weigh the node model too: a `DecoratorNode` is a real node in the tree, so it serializes and
moves with the content around it. An editor whose requirement is a purely visual overlay —
highlights or annotations that must never enter the saved document — is asking for something
Lexical's decorators do not do.

</philosophy>

---

<decision_framework>

### Which node type to extend

```
Does the content contain child nodes?
├─ YES → ElementNode (paragraphs, blockquotes, callouts)
└─ NO → Is it text carrying extra formatting or behaviour?
    ├─ YES → TextNode (coloured text, mentions)
    └─ NO → Is it an embedded component (image, video, widget)?
        └─ YES → DecoratorNode, whose decorate() returns the component
```

### Plugin, transform or listener

```
Does the reaction modify nodes?
├─ YES → Transform — runs before reconciliation, so one DOM update covers it
└─ NO → Is it observing state?
    ├─ YES → registerUpdateListener, which runs after reconciliation
    └─ NO → A command, for user actions and toolbar clicks
```

### Which command priority

```
Base editor behaviour?          → COMMAND_PRIORITY_EDITOR (0)
An ordinary plugin?             → COMMAND_PRIORITY_LOW (1) or _NORMAL (2)
Must override other plugins?    → COMMAND_PRIORITY_HIGH (3), as table navigation does
Nothing else may win?           → COMMAND_PRIORITY_CRITICAL (4)
```

Higher runs first, and returning `true` stops propagation to everything below. Full table in
[reference.md](reference.md).

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: React editor setup

`LexicalComposer` takes one `initialConfig` and wraps the plugins as children. Define the config
outside the component so it is not rebuilt every render.

```typescript
const initialConfig = {
  namespace: "MyEditor",
  theme, // class names per node type
  onError, // rethrow, or report — see red flags
  nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode], // every node the plugins need
};

<LexicalComposer initialConfig={initialConfig}>
  <RichTextPlugin contentEditable={<ContentEditable />} ErrorBoundary={LexicalErrorBoundary} />
  <HistoryPlugin />
</LexicalComposer>;
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: The update lifecycle

`editor.update()` mutates, `editor.read()` observes, and the `$` prefix marks the functions that
need one of them open.

```typescript
editor.update(() => {
  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode("Hello world"));
  $getRoot().append(paragraph);
});

editor.read(() => $getRoot().getTextContent());
```

Updates batch synchronously and reconcile asynchronously; pass `{ discrete: true }` when the DOM has
to be committed before the next statement reads it.

Full code: [examples/serialization.md](examples/serialization.md)

---

### Pattern 3: The command system

Commands carry a typed payload and are dispatched from anywhere. Listeners register at a priority
and return `true` to consume the command.

```typescript
export const INSERT_IMAGE_COMMAND: LexicalCommand<{
  src: string;
  alt: string;
}> = createCommand("INSERT_IMAGE_COMMAND");

editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
  src: "/image.png",
  alt: "Photo",
});
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: A plugin as a React component

The plugin reads the editor from context and owns its registrations for the life of the component.

```typescript
export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  return (
    <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
      Bold
    </button>
  );
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Node transforms

A transform runs on every dirty node of its type before reconciliation, which makes it the cheapest
place to react to content. The precondition is what stops it re-triggering itself.

```typescript
editor.registerNodeTransform(TextNode, (textNode) => {
  const text = textNode.getTextContent();
  if (text.length > 0 && text[0] !== text[0].toUpperCase()) {
    textNode.setTextContent(text[0].toUpperCase() + text.slice(1));
  }
});
```

Leaf nodes transform first, then elements, then the root, and the whole cascade produces a single
DOM reconciliation.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Custom nodes

Every custom node needs `static getType()`, `static clone()`, `createDOM()`, `updateDOM()`,
`exportJSON()` / `static importJSON()`, and an entry in `initialConfig.nodes`. Private properties
take a double-underscore prefix so minifiers leave them alone, and every one of them has to be
JSON-serializable.

```typescript
export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;

  static getType(): string {
    return "image";
  }
  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__key);
  }
  updateDOM(): boolean {
    return false; // the existing element can be reused
  }
  decorate(): JSX.Element {
    return <img src={this.__src} alt="" />;
  }
}
```

Reach a node through its `$createXxxNode()` factory rather than `new`, so `$applyNodeReplacement`
can run.

Full code: [examples/custom-nodes.md](examples/custom-nodes.md)

---

### Pattern 7: Serialization

JSON is the persistence format — it round-trips the whole tree including custom node properties.
HTML is for display and interop, and it is lossy.

```typescript
const jsonString = JSON.stringify(editor.getEditorState().toJSON());

editor.setEditorState(editor.parseEditorState(jsonString).clone(null));

editor.read(() => $generateHtmlFromNodes(editor, null));
```

Full code: [examples/serialization.md](examples/serialization.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A `$`-function called outside `editor.update()` / `editor.read()` — throws, with no compile-time
  warning — move the call inside the closure
- A custom node missing from `initialConfig.nodes` — the editor throws or drops the content when it
  meets the node — register it in the same place the plugin is added
- A transform with no precondition — the mutation marks the node dirty, re-triggering the transform
  until the editor freezes — guard on the condition the mutation removes
- A `register*` call whose unsubscribe is dropped — one leaked listener per render and stale
  references after unmount — return it from `useEffect`
- A node property holding a function, `Map` or `Set` — serialization breaks quietly — keep every
  property JSON-serializable
- Two nodes sharing a `getType()` string — deserialization resolves the wrong class — namespace the
  type
- `new MyNode()` instead of `$createMyNode()` — bypasses `$applyNodeReplacement`, so any registered
  replacement never runs
- A single-underscore node property — minifiers mangle it — use `__`
- Direct DOM mutation of editor content — bypasses the reconciler and desyncs state from DOM — go
  through nodes and commands
- `editor.update()` called from inside an update listener — breaks undo/redo history and forces an
  extra render — use a transform
- `console.log` in `onError` with no rethrow — swallows every editor error — rethrow or report it

**Surprising behaviour:**

- Updates batch synchronously but reconcile asynchronously, so a DOM measurement taken straight
  after an update reads the old layout unless the update passed `{ discrete: true }`
- `setEditorState` steals focus unless the state is passed through `editorState.clone(null)`
- `DecoratorNode.decorate()` renders its component outside the normal React tree, so state and
  context in it need care
- `onError` that does not rethrow lets Lexical attempt its own recovery, which can mask a broken
  node class
- `TextNode` modes change deletion: `"token"` makes the text an immutable chip, `"segmented"`
  deletes it word by word
- CSS `transition` never fires on node removal, because the reconciler removes the element rather
  than hiding it
- The NodeState API (v0.26+) is experimental and can change without an extended deprecation

</red_flags>

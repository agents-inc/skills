# TipTap Quick Reference

> Decision frameworks, StarterKit contents, extension API cheat sheet, and anti-patterns. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples. **Current: v3.x (2025)**

---

## StarterKit v3 Included Extensions

| Category          | Extensions                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Nodes**         | Document, Paragraph, Text, Heading, HorizontalRule, HardBreak, CodeBlock, Blockquote, BulletList, OrderedList, ListItem |
| **Marks**         | Bold, Code, Italic, Link (new in v3), Strike, Underline (new in v3)                                                     |
| **Functionality** | Dropcursor, Gapcursor, UndoRedo (renamed from History), ListKeymap (new), TrailingNode (new)                            |

### Disabling StarterKit Extensions

```typescript
StarterKit.configure({
  heading: false, // Disable heading
  codeBlock: false, // Disable code block
  link: { openOnClick: false }, // Configure instead of disable
});
```

---

## Extension API Cheat Sheet

### Node Schema Properties

| Property     | Type    | Purpose                                                           |
| ------------ | ------- | ----------------------------------------------------------------- |
| `name`       | string  | Unique identifier (required)                                      |
| `group`      | string  | Schema group: `"block"`, `"inline"`                               |
| `content`    | string  | Allowed children: `"block+"`, `"inline*"`, `"text*"`, `""` (leaf) |
| `inline`     | boolean | Renders inline (default: false)                                   |
| `atom`       | boolean | Non-editable unit node (default: false)                           |
| `selectable` | boolean | Can be node-selected (default: true for non-text)                 |
| `draggable`  | boolean | Supports drag-and-drop (default: false)                           |

### Mark-Specific Properties

| Property    | Type    | Purpose                                         |
| ----------- | ------- | ----------------------------------------------- |
| `inclusive` | boolean | Typing at boundary extends mark (default: true) |
| `excludes`  | string  | Space-separated mark names that cannot coexist  |
| `spanning`  | boolean | Can span across multiple nodes (default: true)  |

### Extension Lifecycle Hooks

| Hook                  | When                          |
| --------------------- | ----------------------------- |
| `onBeforeCreate()`    | Before editor view is created |
| `onCreate()`          | Editor is ready               |
| `onUpdate()`          | Content changed               |
| `onSelectionUpdate()` | Selection changed             |
| `onTransaction()`     | Any state change              |
| `onFocus()`           | Editor gains focus            |
| `onBlur()`            | Editor loses focus            |
| `onDestroy()`         | Editor is destroyed           |

### Common Extension Methods

| Method                    | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `addOptions()`            | Default configuration (user overrides via `.configure()`)   |
| `addStorage()`            | Mutable state accessible via `editor.storage.extensionName` |
| `addCommands()`           | Commands callable via `editor.commands.*` or chains         |
| `addKeyboardShortcuts()`  | Map key combos to handlers (`"Mod-k"`, `"Shift-Enter"`)     |
| `addInputRules()`         | Regex transforms as user types (regex must end with `$`)    |
| `addPasteRules()`         | Regex transforms on pasted content (use `/g` flag, no `$`)  |
| `addGlobalAttributes()`   | Attributes applied across multiple node/mark types          |
| `addProseMirrorPlugins()` | Register raw ProseMirror plugins                            |
| `addNodeView()`           | Framework component for rendering nodes                     |

---

## Content Expression Cheat Sheet

| Expression                  | Meaning                                       |
| --------------------------- | --------------------------------------------- |
| `"block+"`                  | One or more block nodes                       |
| `"block*"`                  | Zero or more block nodes                      |
| `"inline*"`                 | Zero or more inline nodes                     |
| `"text*"`                   | Zero or more text nodes (no inline nodes)     |
| `""`                        | Empty -- leaf node, no children               |
| `"paragraph block*"`        | One paragraph followed by zero or more blocks |
| `"(paragraph \| heading)+"` | One or more paragraphs or headings            |

---

## v3 Migration Notes

| v2                                           | v3                                                  | Change                           |
| -------------------------------------------- | --------------------------------------------------- | -------------------------------- |
| `import { BubbleMenu } from "@tiptap/react"` | `import { BubbleMenu } from "@tiptap/react/menus"`  | Menus moved to sub-path          |
| `tippyOptions` on BubbleMenu/FloatingMenu    | Floating UI options (`offset`, `placement`, `flip`) | Tippy.js replaced by Floating UI |
| `History` extension                          | `UndoRedo` from `@tiptap/extensions`                | Renamed                          |
| `CollaborationCursor`                        | `CollaborationCaret`                                | Renamed                          |
| Link and Underline added separately          | Included in StarterKit                              | New defaults                     |
| `editor.getCharacterCount()`                 | Use CharacterCount extension                        | Method removed                   |

---

## Decision Frameworks

### When to Use StarterKit vs Individual Extensions

```
Do you need most standard formatting (headings, lists, bold, italic)?
+-> YES -> Start with StarterKit, disable what you don't need
+-> NO  -> Install individual extensions for precise control
```

### When to Use Node Views

```
Does the node need interactivity beyond text editing?
+-> NO  -> renderHTML is sufficient
+-> YES -> Does it need editable child content?
    +-> YES -> ReactNodeViewRenderer + NodeViewContent
    +-> NO  -> ReactNodeViewRenderer (atom node, no content hole)
```

### Menu Type Selection

```
When should the menu appear?
+-> On text selection? -> BubbleMenu
+-> On empty lines / new blocks? -> FloatingMenu
+-> Always visible? -> Fixed toolbar (regular component reading editor state)
+-> On "/" or trigger character? -> Custom extension with suggestion plugin
```

---

## Anti-Patterns

### Bad: Direct DOM Manipulation

```typescript
// Never do this -- bypasses ProseMirror state
document.querySelector(".ProseMirror p").textContent = "Changed";
```

**Fix:** Use `editor.commands.setContent()` or transactions.

### Bad: Forgetting to Guard editor null

```typescript
// editor is null on first render and during SSR
const isBold = editor.isActive("bold"); // TypeError on first render
```

**Fix:** Guard with optional chaining or early return:

```typescript
if (!editor) return null;
const isBold = editor.isActive("bold");
```

### Bad: Duplicate Extensions

```typescript
// StarterKit v3 already includes Link -- this causes errors
const editor = useEditor({
  extensions: [StarterKit, Link], // Duplicate extension "link"
});
```

**Fix:** Configure via StarterKit or disable and add separately:

```typescript
StarterKit.configure({ link: { openOnClick: false } });
// OR
(StarterKit.configure({ link: false }), Link.configure({ openOnClick: false }));
```

# Lexical Quick Reference

> Decision frameworks, command priorities, package map, and anti-patterns. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code. **Current: v0.42.x (pre-1.0)**

---

## Package Map

| Package              | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `lexical`            | Core: nodes, commands, EditorState, selection               |
| `@lexical/react`     | React bindings: LexicalComposer, plugins, hooks             |
| `@lexical/rich-text` | HeadingNode, QuoteNode, rich text commands                  |
| `@lexical/list`      | ListNode, ListItemNode, list commands                       |
| `@lexical/link`      | LinkNode, AutoLinkNode, link commands                       |
| `@lexical/code`      | CodeNode, CodeHighlightNode                                 |
| `@lexical/html`      | $generateHtmlFromNodes, $generateNodesFromDOM               |
| `@lexical/headless`  | createHeadlessEditor (server-side)                          |
| `@lexical/markdown`  | Markdown shortcuts and conversion                           |
| `@lexical/table`     | TableNode, table editing                                    |
| `@lexical/clipboard` | Copy/paste handling                                         |
| `@lexical/selection` | Selection utilities                                         |
| `@lexical/utils`     | General utilities ($insertNodeToNearestRoot, mergeRegister) |

---

## Command Priority Reference

| Constant                    | Value | Use Case                                |
| --------------------------- | ----- | --------------------------------------- |
| `COMMAND_PRIORITY_EDITOR`   | 0     | Base editor behavior, default handlers  |
| `COMMAND_PRIORITY_LOW`      | 1     | Most plugins (default choice)           |
| `COMMAND_PRIORITY_NORMAL`   | 2     | Standard plugin behavior                |
| `COMMAND_PRIORITY_HIGH`     | 3     | Must override other plugins (table nav) |
| `COMMAND_PRIORITY_CRITICAL` | 4     | Emergency overrides only                |

Higher priority runs first. Return `true` to stop propagation to lower priorities.

---

## Built-in Commands (Commonly Used)

| Command                     | Payload                 | Source Package |
| --------------------------- | ----------------------- | -------------- |
| `FORMAT_TEXT_COMMAND`       | `TextFormatType`        | `lexical`      |
| `FORMAT_ELEMENT_COMMAND`    | `ElementFormatType`     | `lexical`      |
| `UNDO_COMMAND`              | `void`                  | `lexical`      |
| `REDO_COMMAND`              | `void`                  | `lexical`      |
| `KEY_ENTER_COMMAND`         | `KeyboardEvent \| null` | `lexical`      |
| `KEY_TAB_COMMAND`           | `KeyboardEvent`         | `lexical`      |
| `KEY_BACKSPACE_COMMAND`     | `KeyboardEvent`         | `lexical`      |
| `KEY_DELETE_COMMAND`        | `KeyboardEvent`         | `lexical`      |
| `KEY_ESCAPE_COMMAND`        | `KeyboardEvent`         | `lexical`      |
| `SELECTION_CHANGE_COMMAND`  | `void`                  | `lexical`      |
| `CLICK_COMMAND`             | `MouseEvent`            | `lexical`      |
| `PASTE_COMMAND`             | `PasteCommandType`      | `lexical`      |
| `CLEAR_EDITOR_COMMAND`      | `void`                  | `lexical`      |
| `INSERT_PARAGRAPH_COMMAND`  | `void`                  | `lexical`      |
| `INDENT_CONTENT_COMMAND`    | `void`                  | `lexical`      |
| `OUTDENT_CONTENT_COMMAND`   | `void`                  | `lexical`      |
| `INSERT_LINE_BREAK_COMMAND` | `boolean`               | `lexical`      |

---

## Node Type Hierarchy

```
LexicalNode (base - not directly extendable)
├── RootNode (singleton, cannot subclass)
├── LineBreakNode (represents '\n')
├── ElementNode (extendable - block/inline containers)
│   ├── ParagraphNode
│   ├── HeadingNode (@lexical/rich-text)
│   ├── QuoteNode (@lexical/rich-text)
│   ├── ListNode (@lexical/list)
│   ├── ListItemNode (@lexical/list)
│   ├── TableNode (@lexical/table)
│   └── Your custom block nodes
├── TextNode (extendable - leaf text)
│   ├── CodeHighlightNode (@lexical/code)
│   └── Your custom text nodes
└── DecoratorNode<T> (extendable - embedded components)
    └── Your custom embed nodes (images, videos, widgets)
```

---

## React Plugin Reference

| Plugin                   | Package          | Purpose                                   |
| ------------------------ | ---------------- | ----------------------------------------- |
| `RichTextPlugin`         | `@lexical/react` | Bold, italic, underline, headings, quotes |
| `PlainTextPlugin`        | `@lexical/react` | Plain text only (no formatting)           |
| `HistoryPlugin`          | `@lexical/react` | Undo/redo                                 |
| `OnChangePlugin`         | `@lexical/react` | State change callbacks                    |
| `AutoFocusPlugin`        | `@lexical/react` | Focus editor on mount                     |
| `ListPlugin`             | `@lexical/react` | Ordered and unordered lists               |
| `CheckListPlugin`        | `@lexical/react` | Checklists                                |
| `LinkPlugin`             | `@lexical/react` | Link support                              |
| `AutoLinkPlugin`         | `@lexical/react` | Auto-convert URLs to links                |
| `TablePlugin`            | `@lexical/react` | Table editing                             |
| `TabIndentationPlugin`   | `@lexical/react` | Tab-based indentation                     |
| `ClearEditorPlugin`      | `@lexical/react` | Clear editor command                      |
| `MarkdownShortcutPlugin` | `@lexical/react` | Markdown input shortcuts                  |
| `TreeViewPlugin`         | `@lexical/react` | Debug: shows node tree                    |
| `LexicalEditorRefPlugin` | `@lexical/react` | External ref to editor instance           |

---

## Custom Node Checklist

For every custom node, verify:

- [ ] `static getType()` returns a unique string
- [ ] `static clone(node)` copies all `__` properties
- [ ] Constructor supports zero required arguments (for collaboration)
- [ ] `createDOM()` returns the correct HTMLElement
- [ ] `updateDOM()` returns `false` when DOM can be reused
- [ ] `exportJSON()` includes all custom properties
- [ ] `static importJSON()` reconstructs from JSON via factory
- [ ] `$createXxxNode()` factory wraps with `$applyNodeReplacement`
- [ ] `$isXxxNode()` type guard uses `instanceof`
- [ ] Node registered in `initialConfig.nodes`
- [ ] All properties use `__` prefix convention
- [ ] All properties are JSON-serializable (no functions, Maps, Sets)

---

## Anti-Patterns

See [SKILL.md RED FLAGS](SKILL.md#red-flags) for the complete anti-patterns list.

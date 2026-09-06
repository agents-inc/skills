# Lexical - Serialization

> JSON and HTML round trips, `exportDOM`/`importDOM`, headless editors and discrete updates. See
> [SKILL.md](../SKILL.md) for the decisions, [core.md](core.md) for editor setup,
> [custom-nodes.md](custom-nodes.md) for the node classes these methods live on.

---

## Pattern 1: JSON Serialization (Recommended for Persistence)

### Good Example - Save and Restore Editor State

```typescript
import type { EditorState } from "lexical";

// Save: EditorState -> JSON string
function saveEditorState(editorState: EditorState): string {
  return JSON.stringify(editorState.toJSON());
}

// Restore: JSON string -> EditorState
function restoreEditorState(editor: LexicalEditor, jsonString: string): void {
  const editorState = editor.parseEditorState(jsonString);
  // Clone with null to prevent auto-focusing the editor
  editor.setEditorState(editorState.clone(null));
}

// Usage in an OnChangePlugin callback
function handleChange(editorState: EditorState) {
  const json = saveEditorState(editorState);
  localStorage.setItem("editor-content", json);
}
```

**Why good:** `parseEditorState` reconstructs through the registered node classes, so a document
written by a version with different nodes fails loudly here rather than half-rendering; `clone(null)`
keeps the restore from stealing focus

### Good Example - Custom Node JSON Serialization

```typescript
import {
  ElementNode,
  type SerializedElementNode,
  type Spread,
  type LexicalUpdateJSON,
} from "lexical";

type AlertLevel = "info" | "warning" | "error";

export type SerializedAlertNode = Spread<
  { level: AlertLevel },
  SerializedElementNode
>;

export class AlertNode extends ElementNode {
  __level: AlertLevel;

  // Export: node -> JSON
  exportJSON(): SerializedAlertNode {
    return {
      ...super.exportJSON(),
      level: this.__level,
    };
  }

  // Import: JSON -> node
  static importJSON(serializedNode: SerializedAlertNode): AlertNode {
    return $createAlertNode(serializedNode.level).updateFromJSON(
      serializedNode,
    );
  }

  // updateFromJSON: apply properties from JSON (v0.23+)
  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedAlertNode>): this {
    return super.updateFromJSON(serializedNode);
    // __level is set via constructor in importJSON
  }

  // ... getType, clone, createDOM, updateDOM, constructor
}
```

**Why good:** `Spread` adds the node's own fields to the base serialized type, so a property added to
the class and forgotten in `exportJSON` is a type error rather than silent data loss

---

## Pattern 2: HTML Serialization (For Display or Interop)

### Good Example - Export to HTML

```typescript
import { $generateHtmlFromNodes } from "@lexical/html";

// Full editor content to HTML
function exportEditorHtml(editor: LexicalEditor): string {
  let html = "";
  editor.read(() => {
    html = $generateHtmlFromNodes(editor, null);
  });
  return html;
}

// Selected content only
function exportSelectionHtml(editor: LexicalEditor): string {
  let html = "";
  editor.read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      html = $generateHtmlFromNodes(editor, selection);
    }
  });
  return html;
}
```

**Why good:** `$generateHtmlFromNodes` needs an open read/update closure like any `$` function;
passing `null` exports the whole document, passing a selection exports only what is highlighted

### Good Example - Import HTML into Editor

```typescript
import { $getRoot, $insertNodes } from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";

// Replace editor content with HTML
function importHtml(editor: LexicalEditor, htmlString: string): void {
  editor.update(() => {
    const parser = new DOMParser();
    const dom = parser.parseFromString(htmlString, "text/html");
    const nodes = $generateNodesFromDOM(editor, dom);

    // Clear existing content and insert
    const root = $getRoot();
    root.clear();
    root.append(...nodes);
  });
}

// Insert HTML at cursor position
function insertHtmlAtCursor(editor: LexicalEditor, htmlString: string): void {
  editor.update(() => {
    const parser = new DOMParser();
    const dom = parser.parseFromString(htmlString, "text/html");
    const nodes = $generateNodesFromDOM(editor, dom);
    $insertNodes(nodes);
  });
}
```

**Why good:** `$generateNodesFromDOM` maps DOM elements onto the registered nodes' `importDOM` rules,
so anything with no rule is dropped rather than smuggled in. It performs no sanitization — untrusted
HTML has to be cleaned before it reaches this call.

---

## Pattern 3: Custom Node HTML Export (exportDOM)

### Good Example - Node with HTML Representation

```typescript
import type { DOMExportOutput, LexicalEditor } from "lexical";

export class CalloutNode extends ElementNode {
  __variant: "info" | "warning" | "error";

  // Control HTML representation for export
  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-variant", this.__variant);
    element.className = `callout callout-${this.__variant}`;
    element.setAttribute("role", "note");
    return { element };
  }
}
```

**Why good:** the data attributes written here are what `importDOM` matches on, so export and import
round-trip.

`exportDOM` can also return an `after(generatedElement)` callback beside `element`. It runs once the
children have been appended, which is the only point at which the finished subtree can be
post-processed.

---

## Pattern 4: Custom Node HTML Import (importDOM)

### Good Example - Parse HTML Back to Node

```typescript
import type {
  DOMConversionMap,
  DOMConversion,
  DOMConversionOutput,
} from "lexical";

export class CalloutNode extends ElementNode {
  // Map DOM elements to this node type
  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement): DOMConversion | null => {
        // Only convert divs with our data attribute
        if (!domNode.hasAttribute("data-variant")) {
          return null;
        }
        return {
          conversion: convertCalloutElement,
          priority: 1, // 0-4, higher wins over competing converters
        };
      },
    };
  }
}

function convertCalloutElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const variant = domNode.getAttribute("data-variant");
  if (variant === "info" || variant === "warning" || variant === "error") {
    const node = $createCalloutNode(variant);
    return { node };
  }
  return null;
}
```

**Why good:** returning `null` from the matcher declines the element and lets another node's converter
take it; `priority` (0-4) decides between converters that all accept it

---

## Pattern 5: HTML Config on Editor (Without Subclassing)

### Good Example - Editor-Level HTML Configuration

```typescript
import { createEditor } from "lexical";
import type { HTMLConfig } from "lexical";

// Add import/export rules at editor level (no node subclassing needed)
const htmlConfig: HTMLConfig = {
  export: new Map([
    // Override how ParagraphNode exports to HTML
    [
      ParagraphNode,
      (editor, node) => {
        const element = document.createElement("p");
        element.className = "custom-paragraph";
        return { element };
      },
    ],
  ]),
  import: {
    // Custom conversion for <blockquote> elements
    blockquote: () => ({
      conversion: (domNode: HTMLElement) => {
        return { node: $createQuoteNode() };
      },
      priority: 2,
    }),
  },
};

const editor = createEditor({
  namespace: "MyEditor",
  html: htmlConfig,
  nodes: [
    /* ... */
  ],
  onError: (error) => console.error(error),
});
```

**Why good:** changes how built-in nodes serialize without subclassing them, which is what you want
when two editors in one app need different HTML from the same node types

---

## Pattern 6: Headless Editor (Server-Side Processing)

### Good Example - Convert JSON to HTML on the Server

```typescript
import { createHeadlessEditor } from "@lexical/headless";
import { $generateHtmlFromNodes } from "@lexical/html";
import { $getRoot } from "lexical";
// Import node types used in the editor
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";

const HEADLESS_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
];

export function convertJsonToHtml(jsonString: string): string {
  const editor = createHeadlessEditor({
    namespace: "headless",
    nodes: HEADLESS_NODES,
    onError: (error) => {
      throw error;
    },
  });

  const editorState = editor.parseEditorState(jsonString);
  let html = "";

  editorState.read(() => {
    html = $generateHtmlFromNodes(editor, null);
  });

  return html;
}

// Extract plain text for search indexing
export function extractPlainText(jsonString: string): string {
  const editor = createHeadlessEditor({
    namespace: "headless",
    nodes: HEADLESS_NODES,
    onError: (error) => {
      throw error;
    },
  });

  const editorState = editor.parseEditorState(jsonString);
  let text = "";

  editorState.read(() => {
    text = $getRoot().getTextContent();
  });

  return text;
}
```

**Why good:** the headless editor needs the same node registration as the client, since a node the
server does not know about cannot be parsed out of the saved JSON — keeping one exported node array
shared by both is what stops the two drifting

---

## Pattern 7: Synchronous DOM Commit

### Good Example - Discrete Update for Immediate DOM Access

```typescript
// Use { discrete: true } when you need synchronous DOM reconciliation
// (e.g., before reading DOM measurements)
editor.update(
  () => {
    const root = $getRoot();
    const paragraph = $createParagraphNode();
    const text = $createTextNode("Measured text");
    paragraph.append(text);
    root.append(paragraph);
  },
  { discrete: true },
);

// DOM is guaranteed to be updated here
const editorElement = editor.getRootElement();
if (editorElement) {
  const height = editorElement.scrollHeight;
  // Use the measurement...
}

// Then save state
const json = JSON.stringify(editor.getEditorState().toJSON());
```

**Why good:** without `discrete: true` the statement after the update reads the pre-update layout,
which is the bug behind most auto-scroll and resize miscalculations

# Lexical - Core Examples

> Editor setup, plugins, commands, and transforms. See [SKILL.md](../SKILL.md) for architecture decisions and [custom-nodes.md](custom-nodes.md) for node creation.

---

## Pattern 1: Full React Editor Setup

### Good Example - Composable Plugin Architecture

```typescript
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { CodeNode } from "@lexical/code";
import type { EditorState } from "lexical";

const EDITOR_NAMESPACE = "MyEditor";

const theme = {
  paragraph: "editor-paragraph",
  heading: {
    h1: "editor-heading-h1",
    h2: "editor-heading-h2",
    h3: "editor-heading-h3",
  },
  list: {
    ol: "editor-list-ol",
    ul: "editor-list-ul",
    listitem: "editor-listitem",
  },
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    underline: "editor-text-underline",
    strikethrough: "editor-text-strikethrough",
    code: "editor-text-code",
  },
  link: "editor-link",
  quote: "editor-quote",
  code: "editor-code",
};

function onError(error: Error) {
  console.error(error);
}

// Register ALL custom and package nodes here
const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
];

const initialConfig = {
  namespace: EDITOR_NAMESPACE,
  theme,
  onError,
  nodes: EDITOR_NODES,
};

function handleChange(editorState: EditorState) {
  editorState.read(() => {
    // Serialize for persistence
    const json = editorState.toJSON();
    // Save to your backend or local storage
  });
}

export function Editor() {
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="editor-container">
        <ToolbarPlugin />
        <div className="editor-inner">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="editor-input"
                aria-placeholder="Start writing..."
                placeholder={
                  <div className="editor-placeholder">Start writing...</div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
      </div>
      <HistoryPlugin />
      <AutoFocusPlugin />
      <ListPlugin />
      <LinkPlugin />
      <OnChangePlugin
        onChange={handleChange}
        ignoreSelectionChange
      />
    </LexicalComposer>
  );
}
```

**Why good:** All nodes registered in initialConfig, plugins compose as children, theme maps CSS classes to editor elements, OnChangePlugin ignores selection-only changes for performance, error boundary catches update errors

### Bad Example - Missing Node Registration and Inline Config

```typescript
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";

export function Editor() {
  return (
    // BAD: initialConfig created inline (re-creates every render)
    <LexicalComposer
      initialConfig={{
        namespace: "editor",
        // BAD: No nodes registered -- ListPlugin will fail
        onError: (e) => console.log(e),
      }}
    >
      <RichTextPlugin
        // BAD: Missing ErrorBoundary prop
        contentEditable={<div contentEditable />}
      />
      {/* BAD: ListPlugin requires ListNode and ListItemNode in nodes array */}
      <ListPlugin />
    </LexicalComposer>
  );
}
```

**Why bad:** Missing node registration causes ListPlugin to fail silently, inline initialConfig recreates on every render, missing ErrorBoundary means update errors crash the app, raw contentEditable div instead of ContentEditable component

---

## Pattern 2: Custom Plugin with Command Registration

### Good Example - Plugin with Cleanup

```typescript
import { useEffect, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $insertNodes,
  createCommand,
  COMMAND_PRIORITY_LOW,
  type LexicalCommand,
} from "lexical";

// Typed command with payload
export const INSERT_CALLOUT_COMMAND: LexicalCommand<string> = createCommand(
  "INSERT_CALLOUT_COMMAND",
);

export function CalloutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // registerCommand returns an unsubscribe function
    const unregister = editor.registerCommand(
      INSERT_CALLOUT_COMMAND,
      (text: string) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false; // Let other listeners handle it
        }

        const paragraph = $createParagraphNode();
        const textNode = $createTextNode(text);
        paragraph.append(textNode);
        $insertNodes([paragraph]);
        return true; // Command handled, stop propagation
      },
      COMMAND_PRIORITY_LOW,
    );

    // CRITICAL: Return cleanup function
    return unregister;
  }, [editor]);

  // Plugin with no UI returns null
  return null;
}

// Usage from a toolbar button:
// editor.dispatchCommand(INSERT_CALLOUT_COMMAND, "Important note");
```

**Why good:** useEffect returns cleanup function from registerCommand, command is typed with payload, returns false to allow propagation when selection is wrong type, returns true to stop propagation on success

### Bad Example - Missing Cleanup and Wrong Context

```typescript
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createTextNode } from "lexical";

export function BrokenPlugin() {
  const [editor] = useLexicalComposerContext();

  // BAD: No useEffect -- runs on every render
  editor.registerCommand(
    FORMAT_TEXT_COMMAND,
    () => {
      return true;
    },
    COMMAND_PRIORITY_LOW,
  );

  // BAD: $getRoot called outside editor.update()
  const root = $getRoot();

  return null;
}
```

**Why bad:** registerCommand called outside useEffect leaks a new listener every render, $getRoot outside update/read closure throws runtime error, no cleanup function returned

---

## Pattern 3: Toolbar with Built-in Commands

### Good Example - Format Toolbar

```typescript
import { useEffect, useState, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  type TextFormatType,
} from "lexical";

const FORMAT_OPTIONS: Array<{ format: TextFormatType; label: string }> = [
  { format: "bold", label: "B" },
  { format: "italic", label: "I" },
  { format: "underline", label: "U" },
  { format: "strikethrough", label: "S" },
  { format: "code", label: "<>" },
];

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<TextFormatType>>(
    new Set(),
  );

  // Track active formats when selection changes
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const formats = new Set<TextFormatType>();
          for (const { format } of FORMAT_OPTIONS) {
            if (selection.hasFormat(format)) {
              formats.add(format);
            }
          }
          setActiveFormats(formats);
        }
        return false; // Don't stop propagation -- other plugins need this
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  const handleFormat = useCallback(
    (format: TextFormatType) => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    [editor],
  );

  return (
    <div className="toolbar" role="toolbar" aria-label="Text formatting">
      {FORMAT_OPTIONS.map(({ format, label }) => (
        <button
          key={format}
          type="button"
          onClick={() => handleFormat(format)}
          className={activeFormats.has(format) ? "active" : ""}
          aria-pressed={activeFormats.has(format)}
          aria-label={format}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

**Why good:** Listens to SELECTION_CHANGE_COMMAND to track active formats, returns false to avoid blocking other selection listeners, dispatches built-in FORMAT_TEXT_COMMAND, accessible toolbar with aria attributes

---

## Pattern 4: Transform with Precondition

### Good Example - Auto-Link Detection

```typescript
import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TextNode } from "lexical";

const URL_PATTERN = /https?:\/\/[^\s]+/g;

export function AutoDetectLinkPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeTransform = editor.registerNodeTransform(
      TextNode,
      (textNode) => {
        const text = textNode.getTextContent();

        // PRECONDITION: Only process if text contains a URL
        // and the node isn't already in "token" mode
        if (!URL_PATTERN.test(text)) {
          return;
        }
        if (textNode.getMode() === "token") {
          return;
        }

        // Reset regex state (global flag keeps lastIndex)
        URL_PATTERN.lastIndex = 0;

        // Mark URL text as a token so it's treated as a unit
        // (Actual link creation would use the LinkNode from @lexical/link)
      },
    );

    return removeTransform;
  }, [editor]);

  return null;
}
```

**Why good:** Preconditions prevent infinite loop (checks if text contains URL and isn't already processed), resets regex lastIndex for global patterns, returns cleanup function

### Bad Example - Transform Without Precondition

```typescript
editor.registerNodeTransform(TextNode, (textNode) => {
  // BAD: No precondition -- setTextContent marks node dirty,
  // which re-triggers this transform infinitely
  const text = textNode.getTextContent();
  textNode.setTextContent(text.trim());
});
```

**Why bad:** `setTextContent` marks the node dirty, which retriggers the transform. If the text has no whitespace to trim, `trim()` returns the same string, but `setTextContent` still marks it dirty. The editor freezes in an infinite loop.

---

## Pattern 5: Update Listener for Persistence

### Good Example - Debounced Save

```typescript
import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { EditorState } from "lexical";

const SAVE_DELAY_MS = 1000;

export function PersistencePlugin({
  onSave,
}: {
  onSave: (json: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const removeListener = editor.registerUpdateListener(
      ({ editorState }: { editorState: EditorState }) => {
        // Debounce saves
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          const json = JSON.stringify(editorState.toJSON());
          onSave(json);
        }, SAVE_DELAY_MS);
      },
    );

    return () => {
      removeListener();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [editor, onSave]);

  return null;
}
```

**Why good:** Debounces saves to avoid excessive writes, cleans up both the listener and the timer on unmount, serializes via toJSON (not direct state access), named constant for delay

---

## Pattern 6: Restoring Editor State

### Good Example - Load from Saved JSON

```typescript
import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

export function RestoreStatePlugin({
  savedJson,
}: {
  savedJson: string | null;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!savedJson) {
      return;
    }

    const editorState = editor.parseEditorState(savedJson);
    // Clone with null to prevent auto-focusing
    editor.setEditorState(editorState.clone(null));
  }, [editor, savedJson]);

  return null;
}
```

**Why good:** Uses parseEditorState for safe deserialization, clones with null to prevent unexpected focus changes, guard clause for missing data

---

## Pattern 7: Read-Only Mode

### Good Example - Toggling Editability

```typescript
import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

export function ReadOnlyPlugin({ isReadOnly }: { isReadOnly: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(!isReadOnly);
  }, [editor, isReadOnly]);

  return null;
}

// Usage:
// <ReadOnlyPlugin isReadOnly={!canEdit} />
```

**Why good:** Simple plugin that controls editability reactively, uses editor.setEditable which is the proper Lexical API (not the contentEditable HTML attribute)

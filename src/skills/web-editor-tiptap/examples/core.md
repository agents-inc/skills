# TipTap - Core Examples

> Editor setup, configuration, toolbar integration, content serialization, and state observation. See [custom-extensions.md](custom-extensions.md) for custom nodes/marks, [menus.md](menus.md) for bubble/floating menus.

---

## Pattern 1: Complete Editor Setup with Toolbar

### Good Example

```typescript
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

const PLACEHOLDER_TEXT = "Start writing...";

interface RichEditorProps {
  content?: string;
  onUpdate?: (json: Record<string, unknown>) => void;
  editable?: boolean;
}

export function RichEditor({ content, onUpdate, editable = true }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: PLACEHOLDER_TEXT }),
    ],
    content,
    editable,
    immediatelyRender: false, // Required for SSR frameworks
    editorProps: {
      attributes: {
        class: "editor-content", // Your CSS class for editor styling
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getJSON());
    },
  });

  if (!editor) return null;

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Why good:** guards against null editor, `immediatelyRender: false` for SSR safety, `editorProps.attributes` adds CSS classes without wrapper divs, `onUpdate` debounces via TipTap's internal batching

### Bad Example

```typescript
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export function BadEditor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Hello</p>",
    // Missing immediatelyRender: false -- breaks SSR
  });

  // No null guard -- crashes on first render
  return (
    <div>
      <button onClick={() => editor.commands.toggleBold()}>Bold</button>
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Why bad:** missing `immediatelyRender: false` causes hydration mismatch in SSR frameworks, no null guard on `editor` causes TypeError on first render, no `.chain().focus()` on toolbar button loses cursor position

---

## Pattern 2: Toolbar with isActive

### Good Example

```typescript
import type { Editor } from "@tiptap/core";

const HEADING_LEVELS = [1, 2, 3] as const;

interface ToolbarProps {
  editor: Editor;
}

export function Toolbar({ editor }: ToolbarProps) {
  return (
    <div role="toolbar" aria-label="Formatting options">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().toggleBold()}
        aria-pressed={editor.isActive("bold")}
      >
        Bold
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().toggleItalic()}
        aria-pressed={editor.isActive("italic")}
      >
        Italic
      </button>
      {HEADING_LEVELS.map((level) => (
        <button
          key={level}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          aria-pressed={editor.isActive("heading", { level })}
        >
          H{level}
        </button>
      ))}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-pressed={editor.isActive("bulletList")}
      >
        Bullet List
      </button>
      <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        Undo
      </button>
      <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        Redo
      </button>
    </div>
  );
}
```

**Why good:** `.chain().focus()` keeps cursor in editor after clicking button, `.can()` disables impossible commands, `isActive()` reflects current formatting state, `aria-pressed` for accessibility

### Bad Example

```typescript
export function BadToolbar({ editor }: { editor: Editor }) {
  return (
    <div>
      <button onClick={() => editor.commands.toggleBold()}>Bold</button>
      <button onClick={() => editor.commands.toggleItalic()}>Italic</button>
    </div>
  );
}
```

**Why bad:** `editor.commands.*` directly -- no `.focus()` so cursor leaves editor, no `aria-pressed` or disabled state, buttons always appear clickable even when command would fail

---

## Pattern 3: Content Serialization and Persistence

### JSON Persistence (Recommended)

```typescript
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "editor-content";
const SAVE_DEBOUNCE_MS = 1000;

export function PersistentEditor() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: loadContent(),
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const json = editor.getJSON();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
      }, SAVE_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}

function loadContent(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : undefined;
}
```

**Why good:** debounced saving prevents excessive writes, JSON preserves full document structure, SSR-safe window check, cleanup on unmount

### API Persistence

```typescript
const SAVE_DEBOUNCE_MS = 2000;

async function saveToApi(documentId: string, content: Record<string, unknown>) {
  await fetch(`/api/documents/${documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

// In useEditor config:
onUpdate: ({ editor }) => {
  debouncedSave(documentId, editor.getJSON());
};
```

---

## Pattern 4: Observing Editor State

### useEditorState for Selective Re-renders

```typescript
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export function EditorWithState() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p>Hello</p>",
    immediatelyRender: false,
  });

  // Only re-renders when these specific values change
  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e.isActive("bold"),
      isItalic: e.isActive("italic"),
      isEmpty: e.isEmpty,
      characterCount: e.state.doc.textContent.length,
    }),
  });

  if (!editor) return null;

  return (
    <div>
      <span>Bold: {editorState?.isBold ? "on" : "off"}</span>
      <span>Characters: {editorState?.characterCount}</span>
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Why good:** `useEditorState` with selector only triggers re-renders when selected values change -- avoids full re-render on every keystroke

---

## Pattern 5: EditorContext for Deep Component Trees

```typescript
import { useEditor, EditorContent, EditorContext, useCurrentEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMemo } from "react";

export function EditorWithContext() {
  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
  });

  const providerValue = useMemo(() => ({ editor }), [editor]);

  return (
    <EditorContext.Provider value={providerValue}>
      <DeepToolbar />
      <EditorContent editor={editor} />
    </EditorContext.Provider>
  );
}

// Any descendant can access editor without prop drilling
function DeepToolbar() {
  const { editor } = useCurrentEditor();
  if (!editor) return null;

  return (
    <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
  );
}
```

**Why good:** avoids threading `editor` prop through many levels, `useMemo` prevents unnecessary context re-renders

---

## Pattern 6: Configuring Extensions

```typescript
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Link from "@tiptap/extension-link";

const MAX_CHAR_LIMIT = 5000;
const PLACEHOLDER_TEXT = "Write something...";

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false, // Disable code blocks
      // link: false, -- disable StarterKit's link to use custom config below
    }),
    // StarterKit v3 includes Link -- configure via StarterKit, not separately
    // If you need different Link config: disable in StarterKit, add separately
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder: PLACEHOLDER_TEXT }),
    CharacterCount.configure({ limit: MAX_CHAR_LIMIT }),
  ],
  immediatelyRender: false,
});
```

**Why good:** named constants for limits, demonstrates disabling/configuring StarterKit extensions, comment explains v3 Link behavior to prevent duplicate extension errors

# TipTap - Core Examples

> Editor setup, toolbars, serialization and persistence, state observation. See
> [SKILL.md](../SKILL.md) for the decisions, [custom-extensions.md](custom-extensions.md) for nodes
> and marks, [menus.md](menus.md) for bubble and floating menus.

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

**Why good:** the null guard sits above every use of `editor`, and `editorProps.attributes` puts
classes on the editable element itself rather than on a wrapper that styling then has to reach
through

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

**Why bad:** the missing `immediatelyRender: false` produces a hydration mismatch under SSR, the
absent null guard throws on the first render, and `editor.commands.toggleBold()` without
`.chain().focus()` applies against wherever the cursor drifted to

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

**Why good:** `.can()` drives the disabled state from the same command that the click runs, so the
two cannot disagree; `isActive()` reads the formatting at the cursor rather than tracking it
separately

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

**Why bad:** the click moves focus to the button and `editor.commands.*` applies with no `.focus()`
to bring it back; nothing reflects active or unavailable state, so both buttons look identical
whatever the editor is doing

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

**Why good:** `onUpdate` fires per transaction, so the debounce is what turns a keystroke rate into a
save rate; the unmount effect clears the pending timer, and the `window` check keeps `loadContent`
usable during a server render

Persisting to an API is the same shape with the write swapped: `onUpdate` hands you the editor,
`getJSON()` is the payload, and the debounce is what keeps the request rate off the keystroke rate.

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

**Why good:** without a selector the component re-renders on every transaction; `useEditorState`
narrows that to the handful of values the UI actually shows

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

**Why good:** the provider value is memoized, so context consumers re-render when the editor is
created rather than on every parent render

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

**Why good:** shows both halves of StarterKit configuration — `false` removes an extension from the
schema, an options object configures the one already there — and Link is left to StarterKit, since
adding it beside StarterKit v3 is a duplicate-extension error

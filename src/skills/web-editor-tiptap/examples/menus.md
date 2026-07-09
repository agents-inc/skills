# TipTap - Menu Patterns

> BubbleMenu, FloatingMenu, conditional visibility, multiple menus, and slash commands. See [core.md](core.md) for editor setup, [custom-extensions.md](custom-extensions.md) for custom nodes/marks.

---

## Pattern 1: BubbleMenu with shouldShow

### Good Example - Contextual BubbleMenu

```typescript
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

export function EditorWithBubbleMenu() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false }),
    ],
    content: "<p>Select some text to see the menu</p>",
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div>
      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: e, state }) => {
          // Only show on text selection, not on empty selection or node selections
          const { from, to } = state.selection;
          return from !== to && !e.isActive("image");
        }}
      >
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-pressed={editor.isActive("bold")}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-pressed={editor.isActive("italic")}
        >
          Italic
        </button>
        <button
          onClick={() => {
            const url = window.prompt("URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          aria-pressed={editor.isActive("link")}
        >
          Link
        </button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Why good:** `shouldShow` prevents menu on image selections or empty selections, `aria-pressed` for accessibility, `.chain().focus()` maintains cursor, v3 import from `@tiptap/react/menus`

### Bad Example

```typescript
import { BubbleMenu } from "@tiptap/react"; // Wrong import path in v3

function BadBubbleMenu({ editor }) {
  return (
    <BubbleMenu editor={editor} tippyOptions={{ placement: "top" }}>
      {/* tippyOptions no longer works in v3 -- use Floating UI options */}
      <button onClick={() => editor.commands.toggleBold()}>Bold</button>
    </BubbleMenu>
  );
}
```

**Why bad:** v3 imports menus from `@tiptap/react/menus`, `tippyOptions` replaced by Floating UI options, no `.chain().focus()`, no `shouldShow` means menu appears on any selection including nodes

---

## Pattern 2: FloatingMenu for Block Insertion

```typescript
import { useEditor, EditorContent } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";

export function EditorWithFloatingMenu() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p></p>",
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div>
      <FloatingMenu
        editor={editor}
        shouldShow={({ editor: e, state }) => {
          // Show only on empty paragraphs
          const { $from } = state.selection;
          const currentNode = $from.parent;
          return (
            currentNode.type.name === "paragraph" &&
            currentNode.content.size === 0
          );
        }}
      >
        <button onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}>
          Heading 1
        </button>
        <button onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}>
          Heading 2
        </button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Bullet List
        </button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          Code Block
        </button>
      </FloatingMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Why good:** `shouldShow` only displays on empty paragraphs (not inside lists or code blocks), offers block-level transformations, `.chain().focus()` maintains cursor

---

## Pattern 3: Multiple BubbleMenus for Different Contexts

```typescript
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";

export function EditorWithMultipleMenus() {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div>
      {/* Text formatting menu -- only on text selection */}
      <BubbleMenu
        editor={editor}
        pluginKey="textMenu"
        shouldShow={({ editor: e, state }) => {
          const { from, to } = state.selection;
          return from !== to && !e.isActive("image");
        }}
      >
        <button onClick={() => editor.chain().focus().toggleBold().run()}>Bold</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}>Italic</button>
      </BubbleMenu>

      {/* Image controls -- only when image is selected */}
      <BubbleMenu
        editor={editor}
        pluginKey="imageMenu"
        shouldShow={({ editor: e }) => e.isActive("image")}
      >
        <button
          onClick={() =>
            editor.chain().focus().updateAttributes("image", { width: "50%" }).run()
          }
        >
          Small
        </button>
        <button
          onClick={() =>
            editor.chain().focus().updateAttributes("image", { width: "100%" }).run()
          }
        >
          Full Width
        </button>
      </BubbleMenu>

      <EditorContent editor={editor} />
    </div>
  );
}
```

**Why good:** `pluginKey` differentiates menu instances, each menu has its own `shouldShow` for context-appropriate display, image menu only shows image-relevant controls

---

## Pattern 4: Slash Command Pattern

A slash command pattern uses TipTap's suggestion plugin to show an autocomplete popup when the user types `/`.

```typescript
import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionOptions } from "@tiptap/suggestion";

interface SlashCommandItem {
  title: string;
  description: string;
  command: (props: { editor: Editor; range: Range }) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: "Heading 1",
    description: "Large section heading",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a bullet list",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Code Block",
    description: "Insert a code block",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
];

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
        items: ({ query }: { query: string }) => {
          return SLASH_COMMANDS.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          );
        },
      } satisfies Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
```

**Why good:** uses TipTap's suggestion plugin (same foundation as mentions), `deleteRange` removes the `/` trigger text before inserting content, items filtered by query for type-ahead, commands are self-contained

**Note:** The popup UI rendering (`render` function in suggestion options) depends on your component framework and is not shown here -- it typically creates a floating list component positioned at the cursor.

---

## Pattern 5: Fixed Toolbar with Editor State

For always-visible toolbars (not floating), read editor state directly:

```typescript
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";

interface FixedToolbarProps {
  editor: Editor;
}

export function FixedToolbar({ editor }: FixedToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      isBold: e.isActive("bold"),
      isItalic: e.isActive("italic"),
      isStrike: e.isActive("strike"),
      headingLevel: [1, 2, 3].find((l) => e.isActive("heading", { level: l })) ?? null,
    }),
  });

  if (!state) return null;

  return (
    <div role="toolbar" aria-label="Text formatting">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-pressed={state.isBold}
      >
        B
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-pressed={state.isItalic}
      >
        I
      </button>
      <select
        value={state.headingLevel ?? "paragraph"}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "paragraph") {
            editor.chain().focus().setParagraph().run();
          } else {
            editor.chain().focus().setHeading({ level: Number(val) as 1 | 2 | 3 }).run();
          }
        }}
      >
        <option value="paragraph">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
    </div>
  );
}
```

**Why good:** `useEditorState` with selector prevents full re-render on every state change, `aria-pressed` and `role="toolbar"` for accessibility, select element for heading levels avoids 3+ separate buttons

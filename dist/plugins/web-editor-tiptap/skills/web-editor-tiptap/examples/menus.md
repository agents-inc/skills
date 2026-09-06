# TipTap - Menu Patterns

> BubbleMenu, FloatingMenu, `shouldShow`, multiple menus, slash commands, fixed toolbars. See
> [SKILL.md](../SKILL.md) for which menu applies, [core.md](core.md) for editor setup,
> [custom-extensions.md](custom-extensions.md) for the extension the slash command is built on.

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

**Why good:** `shouldShow` keeps the text menu off node selections such as images, where none of its
commands apply; the Link button is the case that most needs `.focus()`, since `window.prompt` takes
focus out of the editor entirely

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

**Why bad:** in v3 the root export no longer carries `BubbleMenu`, `tippyOptions` is inert since
positioning moved to Floating UI, and without `shouldShow` the menu appears on node selections where
its commands do nothing

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

**Why good:** checking the parent node type as well as its emptiness keeps the menu out of empty
list items and code blocks, where turning the line into a heading is not what the user wants

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

**Why good:** two menus on one editor need distinct `pluginKey` values or they collide, and the two
`shouldShow` predicates are mutually exclusive, so exactly one menu can be open at a time

---

## Pattern 4: Slash Command Pattern

A slash command is the suggestion plugin with `/` as its trigger character.

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

**Why good:** each item owns its own command, so adding an entry needs no change to the extension;
`deleteRange(range)` removes the typed `/query` before the command runs, which is what stops the
trigger text ending up in the document.

**Note:** the popup itself is the `render` function in the suggestion options, and it is ordinary
component code — a positioned list, keyboard-navigated — so it is left out here.

---

## Pattern 5: Fixed Toolbar with Editor State

An always-visible toolbar needs no menu primitive — it is a component reading editor state.

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

**Why good:** the selector derives `headingLevel` once, so the select's value and the command that
sets it read from the same source; without `useEditorState` the toolbar re-renders on every
transaction

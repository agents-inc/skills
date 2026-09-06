# Accessibility — Screen Reader Support

> Visually hidden text and decorative content. See [SKILL.md](../SKILL.md) for the decisions.

---

## Pattern 4: Visually hidden text

```typescript
<button>
  <TrashIcon aria-hidden="true" />
  <span className="sr-only">Delete item</span>
</button>
```

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

**Why good:** announced as "Delete item, button" and rendered as the icon alone. Every property in
that class is doing work — a 1px box with `overflow: hidden` and `clip-path` removes it visually
while leaving it in the accessibility tree, `white-space: nowrap` stops a long string wrapping into
a tall sliver, and the negative margin keeps it from affecting layout.

What does not work: `display: none`, `visibility: hidden`, `width: 0`, or `font-size: 0`. All four
remove the text from the accessibility tree as well, which is the opposite of the intent.

A visually hidden `<span>` and an `aria-label` both give the button a name. Prefer the span where the
text should be translatable by tooling that only walks the DOM, or findable by a text search; prefer
the label where the extra element is awkward.

---

## Decorative content

```typescript
// Decorative — hidden from the accessibility tree
<div className="banner">
  <SparkleIcon aria-hidden="true" />
  <h1>Welcome</h1>
</div>

// Decorative image — empty alt, not a missing alt
<img src="/pattern.png" alt="" />
```

**Why good:** `alt=""` says "there is nothing here worth announcing", and a screen reader skips it.
Omitting `alt` entirely says nothing at all, and the fallback is to read the filename —
`hero-banner-final-v3.png` announced letter group by letter group.

```typescript
// Bad — announced twice
<button>
  <img src="/save-icon.png" alt="Save" />
  Save
</button>

// Good — the icon is decoration, the text is the name
<button>
  <img src="/save-icon.png" alt="" />
  Save
</button>
```

**Why bad:** "Save Save, button". The icon and the label say the same thing, so only one of them
should reach the accessibility tree.

**Never put `aria-hidden="true"` on anything focusable or containing something focusable.** Focus
still lands there, and the screen reader has nothing to announce, so the reader is somewhere that
does not exist as far as they can tell.

---

## Announcing an image

The question to ask is what the image conveys in this position, not what it depicts.

| Role of the image                  | `alt`                                            |
| ---------------------------------- | ------------------------------------------------ |
| Purely decorative                  | `alt=""`                                         |
| Conveys information                | Describe the information, not the picture        |
| Is a link or button's only content | Describe the destination or the action           |
| A chart or diagram                 | A short summary, with the data available in text |

An `alt` that starts with "Image of" wastes the reader's time — the announcement already said it was
an image.

# next-intl - Markup Examples

> Extended examples for raw HTML generation. See [core.md](core.md) for React-based rich text with t.rich().

**Prerequisites**: Understand t.rich() from core examples first.

---

## Raw HTML Markup

Use `t.markup()` when you need HTML strings instead of React elements.

### Good Example - Server-Side HTML Generation

```typescript
import { useTranslations } from "next-intl";

function MarkupContent() {
  const t = useTranslations("Content");

  // Returns string with HTML tags
  const html = t.markup("richContent", {
    bold: (chunks) => `<strong>${chunks}</strong>`,
    link: (chunks) => `<a href="/more">${chunks}</a>`,
  });

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

```json
{
  "Content": {
    "richContent": "This is <bold>important</bold>. <link>Learn more</link>."
  }
}
```

**Why good:** markup() returns string for server-side HTML generation, useful for email templates or static HTML output

---

## t.markup vs t.rich Comparison

| Method | Returns | Use Case |
|--------|---------|----------|
| `t.rich()` | React elements | Client/Server components with JSX |
| `t.markup()` | HTML string | Email templates, RSS feeds, static HTML |

### Bad Example - Using markup() When rich() Is Better

```typescript
// BAD - unnecessary dangerouslySetInnerHTML
function BadMarkupUsage() {
  const t = useTranslations("Content");
  const html = t.markup("text", {
    bold: (chunks) => `<strong>${chunks}</strong>`,
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// GOOD - use t.rich() for React components
function GoodRichUsage() {
  const t = useTranslations("Content");
  return (
    <div>
      {t.rich("text", {
        bold: (chunks) => <strong>{chunks}</strong>,
      })}
    </div>
  );
}
```

**Why bad:** dangerouslySetInnerHTML bypasses React's XSS protection, t.rich() is safer and more idiomatic for React

---

## Valid Use Cases for t.markup()

### Good Example - Email Template Generation

```typescript
import { getTranslations } from "next-intl/server";

async function generateEmailHtml(locale: string, userName: string) {
  const t = await getTranslations({ locale, namespace: "Email" });

  const body = t.markup("welcomeBody", {
    name: () => `<strong>${userName}</strong>`,
    link: (chunks) => `<a href="https://example.com/verify">${chunks}</a>`,
  });

  return `
    <!DOCTYPE html>
    <html lang="${locale}">
      <head><title>${t("welcomeSubject")}</title></head>
      <body>${body}</body>
    </html>
  `;
}
```

```json
{
  "Email": {
    "welcomeSubject": "Welcome to Our Service",
    "welcomeBody": "Hello <name></name>! <link>Click here to verify your email</link>."
  }
}
```

**Why good:** email HTML must be a string, no React rendering available, t.markup() is the correct choice

### Good Example - RSS Feed Generation

```typescript
import { getTranslations } from "next-intl/server";

async function generateRssItem(locale: string, post: { title: string; excerpt: string }) {
  const t = await getTranslations({ locale, namespace: "RSS" });

  const description = t.markup("itemDescription", {
    title: () => `<strong>${post.title}</strong>`,
    excerpt: () => post.excerpt,
  });

  return `
    <item>
      <title>${post.title}</title>
      <description><![CDATA[${description}]]></description>
    </item>
  `;
}
```

**Why good:** RSS feeds require raw XML/HTML strings, React components cannot be used

---

## Security Considerations

### Good Example - Sanitizing User Content in Markup

```typescript
import { useTranslations } from "next-intl";
import DOMPurify from "dompurify";

function UserGeneratedContent({ userContent }: { userContent: string }) {
  const t = useTranslations("Content");

  const html = t.markup("userPost", {
    content: () => DOMPurify.sanitize(userContent),
  });

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

**Why good:** DOMPurify sanitizes user-generated content before interpolation, prevents XSS attacks

### Bad Example - Unsanitized User Content

```typescript
// BAD - XSS vulnerability
function UnsafeContent({ userContent }: { userContent: string }) {
  const t = useTranslations("Content");

  const html = t.markup("userPost", {
    content: () => userContent, // Dangerous!
  });

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

**Why bad:** user content could contain malicious scripts, never interpolate unsanitized content into HTML

---

_See [core.md](core.md) for React-based rich text patterns using t.rich()._

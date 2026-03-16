# Email - Testing

> **Testing guidance:** Use React Email's preview server (`email:dev`) for visual testing during development. For unit tests, `await render(YourTemplate({ props }))` returns HTML string you can assert against. Mock the Resend client in send function tests.

**Preview server:**

```bash
# Start React Email preview server for visual testing
bun run email:dev
# View at http://localhost:3001
```

**Template testing pattern:**

```typescript
// Render template and check output contains expected content
const html = await render(
  WelcomeEmail({ userName: "John", loginUrl: "https://example.com/login" }),
);

expect(html).toContain("Welcome");
expect(html).toContain("John");
expect(html).toContain("https://example.com/login");
```

**Testing checklist:**

- All templates render without errors
- Required props are validated (TypeScript)
- Optional props have sensible defaults
- PreviewProps are defined for dev server
- Edge cases handled (empty arrays, null values)
- Links are properly escaped
- Special characters render correctly (`&apos;`, etc.)

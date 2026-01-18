# Core Accessibility Patterns

> Skip links, semantic HTML, landmarks, and button vs link patterns.

---

## Skip Links

### Example: Skip Link Component

```typescript
// components/skip-link.tsx
interface SkipLinkProps {
  className?: string;
}

export function SkipLink({ className }: SkipLinkProps) {
  return (
    <a href="#main-content" className={className}>
      Skip to main content
    </a>
  );
}
```

```css
/* Skip link styling pattern - apply via your styling solution */
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 1rem;
  background: var(--color-primary);
  color: white;
  text-decoration: none;
  z-index: 9999;
}

.skip-link:focus {
  top: 0;
}
```

```typescript
// layout.tsx
import type { ReactNode } from 'react';

function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink className="skip-link" />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
```

**Why good:** Keyboard users can skip navigation. WCAG requirement. Better UX for screen reader users.

**Edge Cases:**
- Add multiple skip links for complex layouts
- Focus main content programmatically
- Ensure visible focus indicator

---

## Semantic HTML

### Example: Semantic List

```typescript
// components/feature.tsx
// GOOD: Uses <li> for list item

interface FeatureProps {
  id: string;
  title: string;
  description: string;
  status: 'done' | 'pending';
  className?: string;
}

export function Feature({ id, title, description, status, className }: FeatureProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li  // Semantic HTML element
      className={className}
      data-expanded={isExpanded}
    >
      <div>
        {/* Radix UI Switch has built-in role="switch" and ARIA */}
        <Switch
          id={`${id}-switch`}
          checked={status === "done"}
        />
        <h2>{title}</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          {/* Use your icon component here */}
          <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
        </button>
      </div>
      {isExpanded && <p>{description}</p>}
    </li>
  );
}
```

```typescript
// Usage: Wrapped in semantic <ul>
<ul>
  {features.map(feature => (
    <Feature key={feature.id} {...feature} />
  ))}
</ul>
```

**Why good:** Screen readers announce "list, 5 items" and provide list navigation shortcuts.

---

## Button vs Link

### Example: Correct Usage

```typescript
// GOOD: Button for actions
<button onClick={handleSubmit}>
  Submit Form
</button>

// GOOD: Link for navigation
<a href="/dashboard">
  Go to Dashboard
</a>

// BAD: Div for button
<div onClick={handleSubmit}>  // Missing role, keyboard support, focus
  Submit Form
</div>

// BAD: Button for navigation
<button onClick={() => navigate('/dashboard')}>  // Should be a link!
  Go to Dashboard
</button>
```

**Rule:** Buttons for actions, links for navigation.

---

## Landmarks

### Example: Semantic HTML Landmarks

```html
<header>
  <!-- role="banner" -->
  <nav>
    <!-- role="navigation" -->
    <main>
      <!-- role="main" -->
      <aside>
        <!-- role="complementary" -->
        <footer>
          <!-- role="contentinfo" -->
          <section><!-- role="region" with aria-label --></section>
        </footer>
      </aside>
    </main>
  </nav>
</header>
```

**Multiple landmarks of same type need labels:**

```html
<nav aria-label="Main navigation">
<nav aria-label="Footer navigation"></nav>
</nav>
```

# View Transitions - Core Examples

> Full code for the core patterns. See [SKILL.md](../SKILL.md) for the decisions and
> [reference.md](../reference.md) for naming rules and API tables.

**Related examples:**

- [spa.md](spa.md) — same-document patterns (Patterns 7–12)
- [shared-elements.md](shared-elements.md) — elements that travel between views (Patterns 13–18)

---

## Pattern 1: Feature Detection Utility

### Good Example - One Guard, Two Shapes

```typescript
// view-transition-utils.ts

export const SUPPORTS_VIEW_TRANSITIONS =
  typeof document !== "undefined" && "startViewTransition" in document;

type TransitionCallback = () => void | Promise<void>;

/** Run an update inside a transition, awaiting the animation. */
export async function withViewTransition(
  updateFn: TransitionCallback,
): Promise<void> {
  if (!SUPPORTS_VIEW_TRANSITIONS) {
    await updateFn();
    return;
  }

  const transition = document.startViewTransition(async () => {
    await updateFn();
  });

  await transition.finished;
}

/** Run an update inside a transition, returning the object for custom animation. */
export function startViewTransitionSafe(
  updateFn: TransitionCallback,
): ViewTransition | null {
  if (!SUPPORTS_VIEW_TRANSITIONS) {
    updateFn();
    return null;
  }

  return document.startViewTransition(() => updateFn());
}
```

**Why good:** Two entry points for the two real needs — await the whole thing, or hold the object to
animate a pseudo-element after `ready`. Returning `null` rather than a stub makes the unsupported
path visible at the call site instead of failing later on a missing promise.

### Bad Example - Unguarded Call

```typescript
function updatePage(content: string): void {
  document.startViewTransition(() => {
    document.body.innerHTML = content;
  });
}
```

**Why bad:** Where the API is absent the call throws, so the page never updates at all — the missing
animation takes the content change down with it.

---

## Pattern 2: Basic State Transition

### Good Example - View Toggle

```typescript
type ViewState = "list" | "detail";

let currentView: ViewState = "list";

function setView(view: ViewState): void {
  currentView = view;
  renderView();
}

function renderView(): void {
  const container = document.getElementById("app");
  if (!container) return;

  if (currentView === "list") {
    container.innerHTML = "<ul>...</ul>";
  } else {
    container.innerHTML = "<article>...</article>";
  }
}

function navigateTo(view: ViewState): void {
  if (!document.startViewTransition) {
    setView(view);
    return;
  }

  document.startViewTransition(() => {
    setView(view);
  });
}

document.getElementById("show-detail")?.addEventListener("click", () => {
  navigateTo("detail");
});

document.getElementById("back-to-list")?.addEventListener("click", () => {
  navigateTo("list");
});
```

**Why good:** The transition wraps an update that already worked on its own — state and render stay
separate, so removing the transition changes nothing but the animation.

---

## Pattern 3: Async Data Loading

### Good Example - Fetch Inside the Callback

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

async function loadUserWithTransition(userId: string): Promise<void> {
  const updateFn = async () => {
    showLoadingState();

    try {
      const response = await fetch(`/api/users/${userId}`);
      const user: User = await response.json();
      renderUserProfile(user);
    } catch (error) {
      renderError(`Failed to load user: ${String(error)}`);
    }
  };

  if (!document.startViewTransition) {
    await updateFn();
    return;
  }

  const transition = document.startViewTransition(async () => {
    await updateFn();
  });

  transition.finished.catch((error) => {
    console.warn("View transition failed:", error);
  });
}

function showLoadingState(): void {
  const container = document.getElementById("user-profile");
  if (container) {
    container.innerHTML = '<div aria-busy="true">Loading...</div>';
  }
}

function renderUserProfile(user: User): void {
  const container = document.getElementById("user-profile");
  if (!container) return;

  const heading = document.createElement("h1");
  heading.textContent = user.name;

  const email = document.createElement("p");
  email.textContent = user.email;

  container.replaceChildren(heading, email);
}

function renderError(message: string): void {
  const container = document.getElementById("user-profile");
  if (!container) return;

  const alert = document.createElement("div");
  alert.setAttribute("role", "alert");
  alert.textContent = message;
  container.replaceChildren(alert);
}
```

**Why good:** The page is frozen for as long as the callback runs, so the callback moves to a loading
state rather than awaiting the network before painting anything. The `finished` rejection is caught
separately from the fetch failure — a transition can be skipped without the update having failed.

---

## Pattern 4: The Three Promises

### Good Example - What Each One Marks

```typescript
async function demonstrateTransitionPromises(
  updateFn: () => void,
): Promise<void> {
  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  const transition = document.startViewTransition(updateFn);

  // ready: pseudo-element tree exists, animation about to start
  transition.ready
    .then(() => {
      console.log("safe to animate pseudo-elements now");
    })
    .catch((error) => {
      console.warn("transition rejected before ready:", error);
    });

  // updateCallbackDone: the DOM update itself finished
  transition.updateCallbackDone
    .then(() => {
      console.log("DOM update complete");
    })
    .catch((error) => {
      console.error("DOM update failed:", error);
    });

  // finished: animation over, new view live
  await transition.finished;
}
```

**Why good:** Each promise rejects for a different reason, so catching them separately tells a
skipped transition apart from a failed update.

### Good Example - Custom Animation After Ready

```typescript
const CUSTOM_DURATION_MS = 400;
const CUSTOM_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

async function transitionWithCustomAnimation(
  updateFn: () => void,
): Promise<void> {
  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  const transition = document.startViewTransition(updateFn);

  await transition.ready;

  document.documentElement.animate(
    {
      opacity: [0.8, 1],
      transform: ["scale(0.98)", "scale(1)"],
    },
    {
      duration: CUSTOM_DURATION_MS,
      easing: CUSTOM_EASING,
      pseudoElement: "::view-transition-new(root)",
    },
  );

  await transition.finished;
}
```

**Why good:** The animation is called on the document element with a `pseudoElement` option, because
the pseudo-element is not a node anything can hold a reference to.

---

## Pattern 5: Skipping a Transition

### Good Example - Rapid Navigation

```typescript
interface TransitionOptions {
  skipTransition?: boolean;
}

function updateWithOptions(
  updateFn: () => void,
  options: TransitionOptions = {},
): ViewTransition | null {
  if (options.skipTransition || !document.startViewTransition) {
    updateFn();
    return null;
  }

  return document.startViewTransition(updateFn);
}

function skipTransition(transition: ViewTransition | null): void {
  if (transition) {
    transition.skipTransition();
  }
}

let pendingTransition: ViewTransition | null = null;

function handleRapidNavigation(page: string): void {
  skipTransition(pendingTransition);

  pendingTransition = updateWithOptions(() => {
    renderPage(page);
  });
}

function renderPage(page: string): void {
  // page rendering logic
}
```

**Why good:** `skipTransition()` jumps the previous transition to its end state rather than
abandoning it midway, so a fast sequence of clicks lands on the right view instead of stacking
half-finished animations.

---

## Pattern 6: CSS Customisation

### Good Example - Asymmetric Cross-Fade

```css
:root {
  --vt-duration: 300ms;
  --vt-easing-enter: ease-out;
  --vt-easing-exit: ease-in;
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--vt-duration);
}

::view-transition-old(root) {
  animation-timing-function: var(--vt-easing-exit);
  animation-duration: calc(var(--vt-duration) * 0.8);
}

::view-transition-new(root) {
  animation-timing-function: var(--vt-easing-enter);
}
```

**Why good:** Clearing the old view slightly ahead of the new one arriving keeps the two from
muddying each other at the crossover, where equal durations leave both at half opacity.

### Good Example - Holding an Element Still

```css
.site-header {
  view-transition-name: header;
}

::view-transition-old(header),
::view-transition-new(header) {
  animation: none;
}

::view-transition-group(header) {
  z-index: 100;
}
```

**Why good:** Naming the header takes it out of the root snapshot, and cancelling its animation is
what makes it sit still while the content beneath it changes. The `z-index` on the group keeps it
above the content moving underneath.

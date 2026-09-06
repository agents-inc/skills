# React 19 — Hook Examples

> useActionState, useFormStatus, useOptimistic, use(), ref cleanup. See [SKILL.md](../SKILL.md) for the decisions and [reference.md](../reference.md) for the form-hook decision tree.

**Additional Examples:**

- [core.md](core.md) — component shape, variant props, event handlers
- [hooks.md](hooks.md) — usePagination, useDebounce, useLocalStorage

---

## useActionState — form submission

```typescript
import { useActionState } from "react";

async function updateProfile(
  prevState: { error: string | null; success: boolean },
  formData: FormData
) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  try {
    await saveProfile({ name, email });
    return { error: null, success: true };
  } catch {
    return { error: "Failed to save profile", success: false };
  }
}

export function ProfileForm() {
  const [state, submitAction, isPending] = useActionState(updateProfile, {
    error: null,
    success: false,
  });

  return (
    <form action={submitAction}>
      <input type="text" name="name" disabled={isPending} required />
      <input type="email" name="email" disabled={isPending} required />

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Profile"}
      </button>

      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">Profile saved!</p>}
    </form>
  );
}
```

**Why good:** the action returns the whole result state, so error and success can never disagree. Reading the fields off `FormData` rather than from controlled state means the form submits before hydration too, and `role="alert"` announces the failure without moving focus.

The hand-rolled equivalent is three `useState` calls plus an `onSubmit` that has to reset all three at the top of every attempt — and it drops the pre-hydration submit, because `onSubmit` needs JavaScript where `action` does not.

---

## useFormStatus — submit buttons

```typescript
import { useFormStatus } from "react-dom";

function SubmitButton({ children = "Submit" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Submitting..." : children}
    </button>
  );
}

export function ContactForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <input type="text" name="message" required />
      <SubmitButton>Send Message</SubmitButton>
    </form>
  );
}

export function NewsletterForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <input type="email" name="email" required />
      <SubmitButton>Subscribe</SubmitButton>
    </form>
  );
}
```

**Why good:** one button component serves every form, and neither form passes a pending flag down. `aria-busy` tells assistive technology the control is working rather than broken.

```typescript
// Wrong — pending is always false here
export function ContactForm({ action }) {
  const { pending } = useFormStatus();

  return (
    <form action={action}>
      <button type="submit" disabled={pending}>Send</button>
    </form>
  );
}
```

**Why bad:** the hook reads the form above it in the tree. In the component that renders the `<form>`, there is none — so it returns `false` silently, with nothing to debug.

---

## useOptimistic — instant feedback

### Updating an existing item

```typescript
import { useOptimistic, startTransition } from "react";

type Todo = { id: string; text: string; completed: boolean; pending?: boolean };

export function TodoList({
  todos,
  toggleTodo,
}: {
  todos: Todo[];
  toggleTodo: (id: string) => Promise<void>;
}) {
  const [optimisticTodos, setOptimisticTodo] = useOptimistic(
    todos,
    (state, { id, completed }: { id: string; completed: boolean }) =>
      state.map((todo) =>
        todo.id === id ? { ...todo, completed, pending: true } : todo
      )
  );

  const handleToggle = (id: string, currentCompleted: boolean) => {
    startTransition(async () => {
      setOptimisticTodo({ id, completed: !currentCompleted });
      await toggleTodo(id);
    });
  };

  return (
    <ul>
      {optimisticTodos.map((todo) => (
        <li key={todo.id} style={{ opacity: todo.pending ? 0.7 : 1 }}>
          <label>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo.id, todo.completed)}
            />
            {todo.text}
            {todo.pending && <span> (saving...)</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}
```

**Why good:** the reducer marks the touched row `pending`, so the UI can distinguish an applied change from a proposed one. Both the setter and the await sit inside one `startTransition`, which is what keeps the optimistic value alive until the real one arrives.

### Appending a new item

```typescript
import { useOptimistic, useRef, startTransition } from "react";

type Message = { id: string; text: string; sending?: boolean };

export function Chat({
  messages,
  sendMessage,
}: {
  messages: Message[];
  sendMessage: (text: string) => Promise<Message>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newText: string) => [
      ...state,
      { id: `temp-${Date.now()}`, text: newText, sending: true },
    ]
  );

  async function formAction(formData: FormData) {
    const text = formData.get("message") as string;
    if (!text.trim()) return;

    addOptimisticMessage(text);
    formRef.current?.reset();

    startTransition(async () => {
      await sendMessage(text);
    });
  }

  return (
    <div>
      <ul>
        {optimisticMessages.map((msg) => (
          <li key={msg.id}>
            {msg.text}
            {msg.sending && <span> Sending...</span>}
          </li>
        ))}
      </ul>
      <form action={formAction} ref={formRef}>
        <input type="text" name="message" />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

**Why good:** appending needs a temporary key, and the server's own id replaces it when the real message arrives. The setter is called directly here rather than wrapped, because a form `action` is already a transition — outside one it would need `startTransition`, as the toggle example does.

---

## use() — promises and context

### Reading a promise under Suspense

```typescript
import { use, Suspense } from "react";

type Comment = { id: string; text: string; author: string };

function CommentList({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);

  if (comments.length === 0) {
    return <p>No comments yet.</p>;
  }

  return (
    <ul>
      {comments.map((comment) => (
        <li key={comment.id}>
          <strong>{comment.author}:</strong> {comment.text}
        </li>
      ))}
    </ul>
  );
}

export function Post({ post, commentsPromise }: {
  post: { title: string; body: string };
  commentsPromise: Promise<Comment[]>;
}) {
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      <Suspense fallback={<p>Loading comments...</p>}>
        <CommentList commentsPromise={commentsPromise} />
      </Suspense>
    </article>
  );
}
```

**Why good:** the promise is created by the parent and passed down, so the fetch starts before the child renders rather than on mount. Only the subtree inside `<Suspense>` waits — the post body paints immediately.

### Reading context after an early return

```typescript
import { use, createContext } from "react";

type Theme = "light" | "dark";
const ThemeContext = createContext<Theme>("light");

function OptionalHeader({ title }: { title: string | null }) {
  if (title === null) {
    return null;
  }

  const theme = use(ThemeContext);

  return (
    <header data-theme={theme}>
      <h1>{title}</h1>
    </header>
  );
}

export function Page({ title, children }: { title: string | null; children: React.ReactNode }) {
  return (
    <ThemeContext value="dark">
      <OptionalHeader title={title} />
      <main>{children}</main>
    </ThemeContext>
  );
}
```

**Why good:** `use()` after an early return is legal where `useContext` is not, so the component keeps its guard clause instead of being restructured around the hook. React 19 also renders the context object directly — no `.Provider`.

### Handling a rejected promise

```typescript
import { use, Suspense } from "react";
import { ErrorBoundary } from "./error-boundary"; // your own class boundary

function CommentList({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);
  return <ul>{comments.map((c) => <li key={c.id}>{c.text}</li>)}</ul>;
}

export function CommentsSection({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  return (
    <ErrorBoundary fallback={() => <p>Failed to load comments.</p>}>
      <Suspense fallback={<p>Loading comments...</p>}>
        <CommentList commentsPromise={commentsPromise} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

**Why good:** `use()` throws to suspend, so a `try`/`catch` around it swallows the suspension as well as the rejection. The boundary outside `<Suspense>` is the only place a rejection can be handled.

---

## Ref callback cleanup

```typescript
function VideoPlayer({ src }: { src: string }) {
  return (
    <video
      ref={(video) => {
        if (!video) return;

        video.play();

        return () => {
          video.pause();
          video.currentTime = 0;
        };
      }}
      src={src}
      controls
    />
  );
}
```

**Why good:** setup and teardown sit in one function next to the element they act on, rather than split across a `useRef` and a `useEffect` whose dependency array has to name the same node.

```typescript
const INTERSECTION_THRESHOLD = 0.5;

function LazyImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      ref={(img) => {
        if (!img) return;

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                img.src = src;
                observer.unobserve(img);
              }
            });
          },
          { threshold: INTERSECTION_THRESHOLD }
        );

        observer.observe(img);

        return () => observer.disconnect();
      }}
      alt={alt}
      loading="lazy"
    />
  );
}
```

**Why good:** the observer is created and disconnected in the same closure, so there is no path where one runs without the other.

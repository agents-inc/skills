# React 19 - New Hooks Examples

> useActionState, useFormStatus, useOptimistic, use() API. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [core.md](core.md) - Component architecture, variants, event handlers
- [icons.md](icons.md) - lucide-react usage, accessibility, color inheritance
- [hooks.md](hooks.md) - usePagination, useDebounce, useLocalStorage
- [error-boundaries.md](error-boundaries.md) - Error boundary implementation and recovery

---

## useActionState - Form Submissions

### Good Example - Form with pending and error state

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
  } catch (error) {
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

      {state.error && <p role="alert" className="error">{state.error}</p>}
      {state.success && <p role="status" className="success">Profile saved!</p>}
    </form>
  );
}
```

**Why good:** useActionState manages pending and result state automatically, no manual useState for loading/error, form action works with progressive enhancement, isPending disables inputs during submission

### Bad Example - Manual state management

```typescript
// WRONG - Unnecessary boilerplate with useState
import { useState } from "react";

export function ProfileForm() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData(e.target as HTMLFormElement);
      await saveProfile({
        name: formData.get("name") as string,
        email: formData.get("email") as string,
      });
      setSuccess(true);
    } catch (err) {
      setError("Failed to save profile");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
    </form>
  );
}
```

**Why bad:** manual state management duplicates useActionState functionality, more code to maintain and test, doesn't work with progressive enhancement, requires manual error handling

---

## useFormStatus - Submit Button Components

### Good Example - Reusable submit button

```typescript
import { useFormStatus } from "react-dom";

// Must be used inside a <form> - not in the component that renders the form
function SubmitButton({ children = "Submit" }: { children?: React.ReactNode }) {
  const { pending, data } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Submitting..." : children}
    </button>
  );
}

// Usage in forms
export function ContactForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <input type="text" name="message" placeholder="Your message" required />
      <SubmitButton>Send Message</SubmitButton>
    </form>
  );
}

export function NewsletterForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <input type="email" name="email" placeholder="Email" required />
      <SubmitButton>Subscribe</SubmitButton>
    </form>
  );
}
```

**Why good:** SubmitButton is reusable across any form, no prop drilling needed, pending state automatically tracks parent form submission, aria-busy improves accessibility

### Bad Example - useFormStatus in form component

```typescript
// WRONG - useFormStatus doesn't work in the same component as <form>
import { useFormStatus } from "react-dom";

export function ContactForm({ action }) {
  const { pending } = useFormStatus(); // Will always be false!

  return (
    <form action={action}>
      <input type="text" name="message" />
      <button type="submit" disabled={pending}>
        {pending ? "Submitting..." : "Send"}
      </button>
    </form>
  );
}
```

**Why bad:** useFormStatus must be called from a component rendered inside `<form>`, not the component that renders it - pending will always be false in this case

---

## useOptimistic - Instant UI Updates

### Good Example - Optimistic todo list

```typescript
import { useOptimistic, useRef, startTransition } from "react";

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

  const handleToggle = async (id: string, currentCompleted: boolean) => {
    setOptimisticTodo({ id, completed: !currentCompleted });

    startTransition(async () => {
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

**Why good:** UI updates instantly when checkbox is clicked, visual feedback shows pending state, state automatically reverts if server request fails, better UX than waiting for server response

### Good Example - Optimistic message sending

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
            {msg.sending && <span className="sending-indicator"> Sending...</span>}
          </li>
        ))}
      </ul>
      <form action={formAction} ref={formRef}>
        <input type="text" name="message" placeholder="Type a message..." />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

**Why good:** message appears instantly in UI, sending indicator provides feedback, form clears immediately after submission, state reverts if send fails

---

## use() API - Reading Promises and Context

### Good Example - Reading promises with Suspense

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

      <section>
        <h2>Comments</h2>
        <Suspense fallback={<p>Loading comments...</p>}>
          <CommentList commentsPromise={commentsPromise} />
        </Suspense>
      </section>
    </article>
  );
}
```

**Why good:** use() suspends component while promise resolves, Suspense boundary shows loading state, separates post content from async comments loading, clean component structure

### Good Example - Reading context conditionally

```typescript
import { use, createContext } from "react";

type Theme = "light" | "dark";
const ThemeContext = createContext<Theme>("light");

function OptionalHeader({ title }: { title: string | null }) {
  // use() can be called conditionally - unlike useContext
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

**Why good:** use() can be called after conditional returns (unlike useContext), simplifies component logic, no need to restructure component to satisfy hooks rules

### Bad Example - use() in try-catch

```typescript
// WRONG - use() cannot be called in try-catch blocks
import { use } from "react";

function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  try {
    const comments = use(commentsPromise); // This will throw an error
    return <ul>{/* ... */}</ul>;
  } catch (error) {
    return <p>Failed to load comments</p>;
  }
}
```

**Why bad:** use() cannot be called inside try-catch blocks, must use Error Boundary for error handling instead

### Good Example - Error handling with use()

```typescript
import { use, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

function CommentList({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);
  return (
    <ul>
      {comments.map((comment) => (
        <li key={comment.id}>{comment.text}</li>
      ))}
    </ul>
  );
}

export function CommentsSection({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  return (
    <ErrorBoundary fallback={<p>Failed to load comments.</p>}>
      <Suspense fallback={<p>Loading comments...</p>}>
        <CommentList commentsPromise={commentsPromise} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

**Why good:** ErrorBoundary catches rejected promises, Suspense handles loading state, clean separation of concerns, proper error handling without try-catch

---

## Ref Cleanup Functions (React 19)

### Good Example - Ref with automatic cleanup

```typescript
import { useCallback } from "react";

function VideoPlayer({ src }: { src: string }) {
  const videoRef = useCallback((video: HTMLVideoElement | null) => {
    if (video === null) return;

    // Setup - runs when element mounts
    video.play();

    // Cleanup function - runs when element unmounts
    return () => {
      video.pause();
      video.currentTime = 0;
    };
  }, []);

  return <video ref={videoRef} src={src} controls />;
}
```

**Why good:** cleanup function runs automatically when element unmounts, no need for separate useEffect, pattern matches other React cleanup patterns, cleaner code

### Good Example - Intersection observer with cleanup

```typescript
import { useCallback } from "react";

const INTERSECTION_THRESHOLD = 0.5;

function LazyImage({ src, alt }: { src: string; alt: string }) {
  const imageRef = useCallback((img: HTMLImageElement | null) => {
    if (img === null) return;

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

    // Cleanup - disconnect observer when element unmounts
    return () => {
      observer.disconnect();
    };
  }, [src]);

  return <img ref={imageRef} alt={alt} loading="lazy" />;
}
```

**Why good:** observer is automatically cleaned up when component unmounts, no memory leaks, named constant for threshold, simpler than useEffect + useRef combination

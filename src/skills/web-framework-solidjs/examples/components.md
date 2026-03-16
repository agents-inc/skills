# SolidJS - Component Examples

> Component patterns, props handling, refs, and control flow. See [SKILL.md](../SKILL.md) for concepts.

---

## Props Handling with splitProps

### Good Example - Button with HTML attribute passthrough

```typescript
import { splitProps, mergeProps, Show, type Component, type JSX } from 'solid-js';

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button: Component<ButtonProps> = (rawProps) => {
  // Merge defaults
  const props = mergeProps(
    { variant: 'primary' as const, size: 'md' as const },
    rawProps
  );

  // Split custom props from native HTML props
  const [local, buttonProps] = splitProps(props, [
    'variant',
    'size',
    'loading',
    'children'
  ]);

  return (
    <button
      {...buttonProps}
      class={`btn btn-${local.variant} btn-${local.size}`}
      disabled={local.loading || buttonProps.disabled}
      aria-busy={local.loading}
    >
      <Show when={local.loading}>
        <span class="spinner" aria-hidden="true" />
      </Show>
      {local.children}
    </button>
  );
};

export { Button };
```

**Why good:** `mergeProps` provides type-safe defaults, `splitProps` separates custom props for spreading HTML attributes, loading state integrates with native disabled

### Good Example - Input with label and error

```typescript
import { splitProps, Show, type Component, type JSX } from 'solid-js';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

const Input: Component<InputProps> = (props) => {
  const [local, inputProps] = splitProps(props, ['label', 'error', 'hint']);

  // Generate unique ID for accessibility
  const inputId = inputProps.id ?? `input-${Math.random().toString(36).slice(2)}`;

  return (
    <div class="input-group">
      <label for={inputId}>{local.label}</label>

      <input
        {...inputProps}
        id={inputId}
        class={`input ${local.error ? 'input-error' : ''}`}
        aria-invalid={Boolean(local.error)}
        aria-describedby={local.error ? `${inputId}-error` : undefined}
      />

      <Show when={local.hint && !local.error}>
        <span class="hint">{local.hint}</span>
      </Show>

      <Show when={local.error}>
        <span id={`${inputId}-error`} class="error" role="alert">
          {local.error}
        </span>
      </Show>
    </div>
  );
};

export { Input };
```

**Why good:** Props correctly split for spreading, accessible with label association and error announcements, Show for conditional rendering

### Bad Example - Destructuring props

```typescript
// BAD: Destructuring breaks reactivity!
const Input = ({ label, error, ...inputProps }) => {
  return (
    <div>
      <label>{label}</label>
      {/* label and error won't update when parent changes props */}
      <input {...inputProps} />
      {error && <span class="error">{error}</span>}
    </div>
  );
};
```

**Why bad:** Destructuring breaks reactivity - `label` and `error` are captured at creation time and won't update

---

## Control Flow - Show Component

### Good Example - Conditional rendering with keyed access

```typescript
import { createSignal, Show, type Component } from 'solid-js';

interface User {
  id: string;
  name: string;
  email: string;
}

const UserProfile: Component = () => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  // Simulated fetch
  setTimeout(() => {
    setUser({ id: '1', name: 'John', email: 'john@example.com' });
    setIsLoading(false);
  }, 1000);

  return (
    <div class="profile">
      <Show when={isLoading()}>
        <div class="skeleton">Loading...</div>
      </Show>

      <Show when={!isLoading() && !user()}>
        <div class="empty">No user found</div>
      </Show>

      {/* Keyed Show - user is narrowed to non-null */}
      <Show when={user()}>
        {(user) => (
          <div class="user-card">
            <h2>{user().name}</h2>
            <p>{user().email}</p>
          </div>
        )}
      </Show>
    </div>
  );
};

export { UserProfile };
```

**Why good:** Keyed Show with callback narrows type (no null check needed inside), fallback for loading and empty states

### Bad Example - Using ternary

```typescript
// BAD: Ternary doesn't get Solid's optimizations
const UserProfile = () => {
  const [user, setUser] = createSignal(null);

  return (
    <div>
      {/* BAD: Ternary instead of Show */}
      {user() ? (
        <div>{user().name}</div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
};
```

**Why bad:** Ternary bypasses Solid's control flow optimizations, no type narrowing

---

## Control Flow - For Component

### Good Example - Dynamic list with index

```typescript
import { createSignal, For, type Component } from 'solid-js';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const TodoList: Component = () => {
  const [todos, setTodos] = createSignal<Todo[]>([
    { id: 1, text: 'Learn Solid', completed: false },
    { id: 2, text: 'Build app', completed: false }
  ]);

  const toggleTodo = (id: number) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const removeTodo = (id: number) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  };

  return (
    <ul class="todo-list">
      <For each={todos()} fallback={<li class="empty">No todos yet</li>}>
        {(todo, index) => (
          <li class={todo.completed ? 'completed' : ''}>
            <span class="index">{index() + 1}.</span>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span class="text">{todo.text}</span>
            <button onClick={() => removeTodo(todo.id)}>Delete</button>
          </li>
        )}
      </For>
    </ul>
  );
};

export { TodoList };
```

**Why good:** For handles keying by reference automatically, index is a signal (`index()`), fallback for empty state, items are stable references

### Bad Example - Using map

```typescript
// BAD: Array.map doesn't get Solid's list optimizations
const TodoList = () => {
  const [todos, setTodos] = createSignal([]);

  return (
    <ul>
      {/* BAD: map instead of For */}
      {todos().map((todo, index) => (
        // BAD: index is not reactive, no key handling
        <li>{index}. {todo.text}</li>
      ))}
    </ul>
  );
};
```

**Why bad:** `.map()` doesn't get fine-grained list updates, no automatic keying, index is a plain number (not reactive)

---

## Control Flow - Switch/Match

### Good Example - Status-based rendering

```typescript
import { createSignal, Switch, Match, type Component } from 'solid-js';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ApiState<T> {
  status: Status;
  data: T | null;
  error: string | null;
}

const DataDisplay: Component<{ state: ApiState<string[]> }> = (props) => {
  return (
    <div class="data-display">
      <Switch fallback={<p>Unknown state</p>}>
        <Match when={props.state.status === 'idle'}>
          <p class="idle">Ready to fetch</p>
        </Match>

        <Match when={props.state.status === 'loading'}>
          <div class="loading">
            <span class="spinner" />
            <p>Loading data...</p>
          </div>
        </Match>

        <Match when={props.state.status === 'error'}>
          <div class="error" role="alert">
            <p>Error: {props.state.error}</p>
            <button>Retry</button>
          </div>
        </Match>

        <Match when={props.state.status === 'success' && props.state.data}>
          <ul class="data-list">
            <For each={props.state.data!}>
              {(item) => <li>{item}</li>}
            </For>
          </ul>
        </Match>
      </Switch>
    </div>
  );
};

export { DataDisplay };
```

**Why good:** First truthy Match renders (exclusive), fallback handles unexpected states, clean separation of states

---

## Refs - Focus Management

### Good Example - Auto-focus input

```typescript
import { createSignal, onMount, Show, type Component } from 'solid-js';

const EditableText: Component<{ initialValue: string; onSave: (value: string) => void }> = (props) => {
  const [isEditing, setIsEditing] = createSignal(false);
  const [value, setValue] = createSignal(props.initialValue);

  let inputRef: HTMLInputElement;

  const startEditing = () => {
    setIsEditing(true);
    // Use setTimeout to ensure input is rendered
    setTimeout(() => inputRef?.focus(), 0);
  };

  const save = () => {
    props.onSave(value());
    setIsEditing(false);
  };

  const cancel = () => {
    setValue(props.initialValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  };

  return (
    <div class="editable-text">
      <Show
        when={isEditing()}
        fallback={
          <span onClick={startEditing} class="text clickable">
            {value()}
          </span>
        }
      >
        <input
          ref={inputRef!}
          type="text"
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
        />
      </Show>
    </div>
  );
};

export { EditableText };
```

**Why good:** No forwardRef needed, ref assignment is simple, keyboard handling for accessibility

---

## Component Types

### Good Example - Using correct component types

```typescript
import {
  type Component,
  type ParentComponent,
  type VoidComponent,
  Show
} from 'solid-js';

// VoidComponent - no children allowed
interface IconProps {
  name: string;
  size?: number;
}

const Icon: VoidComponent<IconProps> = (props) => {
  const size = props.size ?? 24;
  return (
    <svg width={size} height={size}>
      <use href={`/icons.svg#${props.name}`} />
    </svg>
  );
};

// ParentComponent - children required
interface CardProps {
  title: string;
  subtitle?: string;
}

const Card: ParentComponent<CardProps> = (props) => {
  return (
    <div class="card">
      <div class="card-header">
        <h3>{props.title}</h3>
        <Show when={props.subtitle}>
          <p class="subtitle">{props.subtitle}</p>
        </Show>
      </div>
      <div class="card-body">
        {props.children}
      </div>
    </div>
  );
};

// Component - standard (children optional)
interface AlertProps {
  type: 'info' | 'warning' | 'error';
  message: string;
}

const Alert: Component<AlertProps> = (props) => {
  return (
    <div class={`alert alert-${props.type}`} role="alert">
      <Icon name={props.type} />
      <span>{props.message}</span>
    </div>
  );
};

export { Icon, Card, Alert };
```

**Why good:** Correct type communicates component API, VoidComponent errors if children passed, ParentComponent requires children

---

## Dynamic Components

### Good Example - Polymorphic component

```typescript
import { Dynamic } from 'solid-js/web';
import { splitProps, type Component, type JSX } from 'solid-js';

type AsElement = 'button' | 'a' | 'div';

interface PolymorphicProps extends JSX.HTMLAttributes<HTMLElement> {
  as?: AsElement;
  variant?: 'primary' | 'secondary';
}

const Box: Component<PolymorphicProps> = (props) => {
  const [local, others] = splitProps(props, ['as', 'variant', 'children']);

  return (
    <Dynamic
      component={local.as || 'div'}
      class={`box ${local.variant ? `box-${local.variant}` : ''}`}
      {...others}
    >
      {local.children}
    </Dynamic>
  );
};

// Usage
const App = () => (
  <>
    <Box>Default div</Box>
    <Box as="button" variant="primary" onClick={() => alert('clicked')}>
      Button
    </Box>
    <Box as="a" href="/about">
      Link
    </Box>
  </>
);

export { Box };
```

**Why good:** `<Dynamic>` for runtime component selection, polymorphic pattern for flexible elements

---

## See Also

- [core.md](core.md) - Signals, effects, and memos
- [stores.md](stores.md) - createStore for complex state
- [resources.md](resources.md) - createResource for async data

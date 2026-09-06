# Base UI - Composition Examples

> The `render` prop, prop and ref merging, and building your own parts with `useRender` and `mergeProps`. See [core.md](core.md) for anatomy first.

**Prerequisites**: Understand [Pattern 1: Part Anatomy](core.md#pattern-1-part-anatomy).

---

## Pattern 4: The render Prop, Element Form

### Good Example - Changing the Rendered Element

```tsx
import { Menu } from "@base-ui/react/menu";
import { Tabs } from "@base-ui/react/tabs";

// A menu item that is genuinely a link
<Menu.Item render={<a href="/library" />}>Add to Library</Menu.Item>

// A tab list that is a real <nav>
<Tabs.List render={<nav aria-label="Sections" />}>
  <Tabs.Tab value="overview">Overview</Tabs.Tab>
  <Tabs.Tab value="usage">Usage</Tabs.Tab>
</Tabs.List>
```

**Why good:** Base UI clones the element you pass and merges its own props into it, so the semantics change while the behaviour, keyboard handling and ARIA attributes stay intact, no wrapper element is introduced

### Good Example - Handing a Part to Your Own Component

```tsx
import { Menu } from "@base-ui/react/menu";

type ButtonProps = React.ComponentProps<"button"> & {
  size?: "sm" | "md";
  ref?: React.Ref<HTMLButtonElement>;
};

// The contract: forward ref, spread EVERY received prop
export function Button({ size = "md", className, ref, ...props }: ButtonProps) {
  return <button ref={ref} data-size={size} className={className} {...props} />;
}

<Menu.Trigger render={<Button size="md" />}>Open menu</Menu.Trigger>;
```

**Why good:** the ref reaches the DOM node so the positioner can measure the anchor and focus can return to it on close, spreading `...props` last lets Base UI's `onClick`, `aria-expanded` and `data-popup-open` land on the element, your own `size` prop survives the merge because Base UI does not know about it

### Bad Example - Dropping Props or the Ref

```tsx
// Neither ref nor the remaining props reach the DOM node
function Button({ children }: { children: React.ReactNode }) {
  return <button className="button">{children}</button>;
}

<Menu.Trigger render={<Button />}>Open menu</Menu.Trigger>;
```

**Why bad:** no ref means the positioner has no anchor to measure and focus cannot return to the trigger, no prop spreading means the click handler, `aria-haspopup` and `aria-expanded` are discarded — and none of this throws, so the menu simply never opens and the failure looks like a Base UI bug

### Bad Example - Reaching for asChild

```tsx
// There is no asChild and no Slot in this library
<Menu.Trigger asChild>
  <Button>Open</Button>
</Menu.Trigger>

// The equivalent here
<Menu.Trigger render={<Button />}>Open</Menu.Trigger>
```

**Why bad:** `asChild` is not a prop, so it lands on the DOM node as an unknown attribute and the trigger renders its own default element — leaving your button either ignored or rendered as a child of a second interactive element

### Good Example - Nesting render Props

```tsx
import { Menu } from "@base-ui/react/menu";
import { Tooltip } from "@base-ui/react/tooltip";

<Tooltip.Root>
  <Tooltip.Trigger render={<Menu.Trigger render={<Button />} />}>
    Filters
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Positioner>
      <Tooltip.Popup>Filter the results</Tooltip.Popup>
    </Tooltip.Positioner>
  </Tooltip.Portal>
</Tooltip.Root>;
```

**Why good:** each layer merges into the next so one DOM node ends up carrying the tooltip's and the menu's props and both refs, `render` props nest as deeply as the composition requires without any wrapper elements

---

## Pattern 5: The render Prop, Function Form

### Good Example - Content That Varies by State

```tsx
import { Switch } from "@base-ui/react/switch";

export function ThemeSwitch() {
  return (
    <Switch.Root className="switch">
      <Switch.Thumb
        render={(props, state) => (
          <span {...props}>
            {state.checked ? (
              <span aria-hidden="true">&#9788;</span>
            ) : (
              <span aria-hidden="true">&#9789;</span>
            )}
          </span>
        )}
      />
    </Switch.Root>
  );
}
```

**Why good:** the function form gives you the merged props and the state in one place, so content can branch without a second subscription to the switch's state, `{...props}` is spread manually because in this form nothing is applied for you

### Good Example - Choosing the Element by State

```tsx
import { Menu } from "@base-ui/react/menu";

type ItemProps = { href?: string; label: string };

export function MaybeLinkItem({ href, label }: ItemProps) {
  return (
    <Menu.Item
      render={(props) =>
        href ? <a href={href} {...props} /> : <div {...props} />
      }
    >
      {label}
    </Menu.Item>
  );
}
```

**Why good:** the element type is decided at render time rather than duplicating the whole item for two cases

### Bad Example - Forgetting to Spread in the Function Form

```tsx
<Switch.Thumb render={(props, state) => <span className="thumb" />} />
```

**Why bad:** the function form applies nothing automatically, so the thumb loses every prop Base UI computed — no data attributes, no styles hooks, no event wiring — and the switch renders but never reflects its own state

---

## Pattern 6: Building Your Own Parts with useRender

### Good Example - A Part That Accepts render Like the Library's

```tsx
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

interface TextProps extends useRender.ComponentProps<"p"> {}

export function Text({ render, ...otherProps }: TextProps) {
  return useRender({
    defaultTagName: "p",
    render,
    props: mergeProps<"p">({ className: "text" }, otherProps),
  });
}

// Renders <p class="text">
<Text>Body copy</Text>

// Renders <h2 class="text heading">
<Text className="heading" render={<h2 />}>Section</Text>
```

**Why good:** `useRender.ComponentProps<"p">` types the intrinsic props plus `render`, `className` and `style` in one line, `mergeProps` puts the base class first so caller classes concatenate after it, the component now behaves exactly like a shipped part

### Good Example - Passing State to the render Callback

```tsx
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

type CounterState = { atLimit: boolean };

interface CounterProps extends useRender.ComponentProps<"span"> {
  count: number;
  limit: number;
}

export function Counter({ count, limit, render, ...otherProps }: CounterProps) {
  const state: CounterState = { atLimit: count >= limit };

  return useRender({
    defaultTagName: "span",
    render,
    state,
    props: mergeProps<"span">(
      { className: "counter", "data-at-limit": state.atLimit || undefined },
      otherProps,
    ),
  });
}

// Consumers can now branch on your state, exactly as they can on Base UI's
<Counter
  count={9}
  limit={10}
  render={(props, state) => (
    <strong {...props}>{state.atLimit ? "Full" : "OK"}</strong>
  )}
/>;
```

**Why good:** publishing state through both a data attribute and the `state` argument mirrors the library's own contract, `|| undefined` omits the attribute rather than writing `data-at-limit="false"`, which keeps `[data-at-limit]` selectors meaningful

### Good Example - Merging Multiple Refs

```tsx
import { useRef } from "react";
import { useRender } from "@base-ui/react/use-render";

export function MeasuredBox({
  render,
  ref,
  ...otherProps
}: useRender.ComponentProps<"div">) {
  const localRef = useRef<HTMLDivElement>(null);

  return useRender({
    defaultTagName: "div",
    render,
    // `ref` accepts an array; all of them receive the node
    ref: [localRef, ref],
    props: otherProps,
  });
}
```

**Why good:** `ref` takes a single ref or an array, so an internal measurement ref and the caller's ref coexist without a manual merge helper. This parameter is the only place refs compose — `mergeProps` does **not** merge `ref`, so routing the caller's ref through `props` instead would silently drop one of the two

---

## Pattern 7: mergeProps Precedence

### Good Example - Chaining a Handler Correctly

```tsx
import { mergeProps } from "@base-ui/react/merge-props";

const merged = mergeProps(
  {
    onClick(event: React.MouseEvent) {
      // Handler from previous props
    },
  },
  (props) => ({
    onClick(event: React.MouseEvent) {
      props.onClick?.(event); // Manually call previous handler
      // Your logic here
    },
  }),
);
```

**Why good:** the function form receives the already-merged props so you decide whether and when the earlier handler runs, which is the only way to conditionally suppress it

**Precedence rules — right-to-left, which is the opposite of most merge helpers:**

| Prop            | Behaviour                                     |
| --------------- | --------------------------------------------- |
| Event handlers  | Executed rightmost-first                      |
| `className`     | Concatenated rightmost-first                  |
| `style`         | Merged; rightmost keys overwrite earlier ones |
| `ref`           | **Not merged** — only the rightmost survives  |
| Everything else | Rightmost wins, like `Object.assign`          |

`mergeProps` takes up to five argument sets. For more, use `mergePropsN` with an array.

Inside a merged synthetic handler, `event.preventBaseUIHandler()` stops Base UI's own handler for that event from running.

### Bad Example - Assuming Left-to-Right Precedence

```tsx
// Expecting the caller's class to be overridden by the base class
const merged = mergeProps(callerProps, { className: "base" });
```

**Why bad:** the rightmost `className` is concatenated first, so `"base"` leads and the caller's class follows — put your base props leftmost so caller values win, which is what callers expect

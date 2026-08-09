# Composable Components - Polymorphism and Forwarding

> Element substitution in both current shapes (`asChild` + Slot, `render` + `useRender`), the merge rules each one uses, and the dependency-free `composeRefs` / `composeEventHandlers` helpers that make substitution safe. See [SKILL.md](../SKILL.md) for the decision framework and [reference.md](../reference.md) for the side-by-side merge table.

**Prerequisites**: Understand compound parts from [core.md](core.md) -- polymorphism is a property of individual parts, applied uniformly across all of them.

---

## The Problem Substitution Solves

```tsx
// Without substitution: a wrapper appears in the layout and in every selector
<Tooltip.Trigger>
  <a href="/docs">Docs</a>
</Tooltip.Trigger>
// Renders: <button ...tooltip wiring><a href="/docs">Docs</a></button>
```

**Why bad:** A `<button>` wrapping an `<a>` is invalid interactive nesting, breaks keyboard semantics, and inserts an element into the consumer's flex row that their CSS did not account for. The tooltip's `aria-describedby` and its focus and hover handlers land on the button, not on the link the user actually interacts with.

---

## Shape A: `asChild` + Slot

```tsx
import { Slot } from "radix-ui";
import { forwardRef } from "react";

interface TooltipTriggerProps extends React.ComponentPropsWithoutRef<"button"> {
  /** Merge this part's props and behavior onto its single child instead of rendering a button. */
  readonly asChild?: boolean;
}

const TooltipTrigger = forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  function TooltipTrigger({ asChild = false, ...rest }, forwardedRef) {
    const { open, describedById, onTriggerEnter } =
      useTooltipContext("Trigger");
    const Component = asChild ? Slot.Root : "button";

    return (
      <Component
        type={asChild ? undefined : "button"}
        {...rest}
        ref={forwardedRef}
        aria-describedby={open ? describedById : undefined}
        data-state={open ? "open" : "closed"}
        onPointerEnter={composeEventHandlers(
          rest.onPointerEnter,
          onTriggerEnter,
        )}
      />
    );
  },
);
```

```tsx
<Tooltip.Trigger asChild>
  <a href="/docs">Docs</a>
</Tooltip.Trigger>
// Renders: <a href="/docs" aria-describedby="..." data-state="closed" ...>Docs</a>
```

**Why good:** No wrapper element exists. The link keeps its href, its focusability and its router integration, and gains the tooltip's wiring. `type="button"` is suppressed when substituting, because it is a `<button>` default that would be meaningless -- or invalid -- on the substituted element.

**Requirements on the child, both mandatory and both silently failing when unmet:**

```tsx
// The child must spread props and forward its ref
const MyLink = forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a">
>(function MyLink(props, forwardedRef) {
  return <a {...props} ref={forwardedRef} />;
});
```

**Why bad without them:** a child that destructures only `children` and `href` swallows `aria-describedby`, the data attributes and the pointer handlers. The tooltip renders, type-checks, and never appears. A child that drops the ref breaks positioning measurement and focus restore with equally no signal.

### Multiple Children: `Slottable`

`Slot.Root` merges onto exactly one child. When a part must render siblings around the slotted element, mark which one receives the props:

```tsx
import { Slot } from "radix-ui";

<Slot.Root {...props}>
  <LeadingIcon />
  <Slot.Slottable>{children}</Slot.Slottable>
  <TrailingIcon />
</Slot.Root>;
```

**Why good:** The icons stay ordinary siblings while the consumer's element still receives the merged props and ref. Without `Slottable`, a multi-child Slot has no way to know which child is the target.

A render-function form covers the case where the slotted child must be wrapped in markup the part owns:

```tsx
<Slot.Slottable child={children}>
  {(child) => <span className="ButtonInner">{child}</span>}
</Slot.Slottable>
```

### Typed Slots

```tsx
const AnchorSlot = Slot.createSlot<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a">
>("Tooltip.Slot");
```

**Why good:** Consumers get accurate prop types for the substituted element instead of the generic slot type, so a typo in `href` is a compile error rather than a swallowed prop.

---

## Shape B: The `render` Prop + `useRender`

```tsx
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

interface TextProps extends useRender.ComponentProps<"p"> {}

function Text(props: TextProps) {
  const { render, ...otherProps } = props;

  return useRender({
    defaultTagName: "p",
    render,
    props: mergeProps<"p">({ className: "text" }, otherProps),
  });
}
```

```tsx
<Text>Rendered as a paragraph</Text>
<Text render={<strong />}>Rendered as a strong element</Text>
```

**Why good:** `useRender` is the same merging machinery the library's own parts use, so a hand-written component behaves identically to a built-in one. `defaultTagName` keeps the no-`render` case ergonomic. `useRender.ComponentProps<"p">` supplies the prop types including `render` itself.

### The Callback Form

```tsx
<Popover.Trigger
  render={(props, state) => (
    <button {...props}>
      {state.open ? "Hide details" : "Show details"}
      <Chevron data-state={state.open ? "open" : "closed"} />
    </button>
  )}
/>
```

**Why good:** The consumer places the props themselves, so they can split them across elements, and they receive the component's state directly instead of mirroring it. Use this form when the rendered _content_ depends on state; the element form is enough when only the element type changes.

### `useRender` Parameters

| Parameter                | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `defaultTagName`         | Element rendered when no `render` prop is supplied                         |
| `render`                 | Element or `(props, state) => ReactElement` callback                       |
| `props`                  | Props merged onto the element -- handlers, `className` and `style` combine |
| `state`                  | Passed to the callback and converted to `data-*` attributes automatically  |
| `ref`                    | A ref or an **array** of refs -- this is where composition happens         |
| `enabled`                | Skip rendering entirely                                                    |
| `stateAttributesMapping` | Override how `state` keys become attributes                                |

The `ref` array matters: `mergeProps` does **not** merge refs -- only the rightmost survives. Pass every ref that needs the node to `useRender`'s `ref` instead of trying to merge them through props.

---

## The Merge Rules, Precisely

Both shapes clone an element and merge props onto it. What differs is the ordering language and the escape hatch, and confusing the two is the most common source of "my handler runs but nothing happens".

| Concern                           | Slot-based composition                                                                  | `mergeProps` composition                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Handler order**                 | The child's (consumer's) handler runs first, then the slot's                            | Handlers run right-to-left -- rightmost argument first                                     |
| **Suppressing internal behavior** | Consumer calls `event.preventDefault()`; the composed handler checks `defaultPrevented` | Consumer calls `event.preventBaseUIHandler()` -- no `preventDefault`, no `stopPropagation` |
| **`className`**                   | Concatenated                                                                            | Concatenated right-to-left                                                                 |
| **`style`**                       | Shallow-merged, child's keys win                                                        | Shallow-merged, rightmost keys win                                                         |
| **Other props**                   | Child's value wins                                                                      | Rightmost value wins                                                                       |
| **`ref`**                         | Composed onto the child                                                                 | Not merged -- pass refs to `useRender`'s `ref` parameter                                   |

In practice both put the consumer first when the component passes consumer props last -- `mergeProps(internalProps, consumerProps)` -- which is the convention to follow. Two facts do not generalize between them:

- `preventBaseUIHandler()` exists only on React synthetic events. Where the library binds a native listener instead, it has no effect and the internal handler runs regardless.
- `preventDefault()` suppresses a Slot-composed internal handler only where the primitive opted into the `defaultPrevented` check; some primitives deliberately compose without it so their behavior cannot be disabled that way.

---

## Composition Helpers, Dependency-Free

Any component can implement substitution without a library. These are the two pieces that make it safe.

### `composeEventHandlers`

```tsx
interface ComposeEventHandlersOptions {
  /** When true, the internal handler is skipped if the consumer called preventDefault(). */
  readonly checkForDefaultPrevented?: boolean;
}

function composeEventHandlers<TEvent extends { defaultPrevented: boolean }>(
  consumerHandler: ((event: TEvent) => void) | undefined,
  internalHandler: (event: TEvent) => void,
  { checkForDefaultPrevented = true }: ComposeEventHandlersOptions = {},
) {
  return function handleEvent(event: TEvent) {
    consumerHandler?.(event);
    if (checkForDefaultPrevented && event.defaultPrevented) return;
    internalHandler(event);
  };
}
```

**Why good:** The consumer's handler always runs, and `preventDefault()` gives them a documented way to opt out of the component's behavior for a single event. Opting a specific handler out of the check (`checkForDefaultPrevented: false`) is a deliberate statement that the behavior is not suppressible -- use it for things like closing on selection, where suppression would leave the component in a broken state.

**Why replacement is bad:**

```tsx
// BAD: whichever is written second wins; the other silently disappears
<button onClick={props.onClick} />   // component behavior deleted
<button onClick={handleOpen} />      // consumer behavior deleted
```

### `composeRefs`

```tsx
type PossibleRef<T> = React.Ref<T> | undefined;

function setRef<T>(
  ref: PossibleRef<T>,
  value: T | null,
): (() => void) | undefined {
  if (typeof ref === "function") {
    // React 19 callback refs may return a cleanup function; older ones return void.
    return ref(value) as (() => void) | undefined;
  }
  if (ref !== null && ref !== undefined) {
    // RefObject.current is typed readonly; assigning is the documented ref-object contract.
    (ref as React.MutableRefObject<T | null>).current = value;
  }
  return undefined;
}

function composeRefs<T>(...refs: readonly PossibleRef<T>[]) {
  return (node: T) => {
    const cleanups = refs.map((ref) => setRef(ref, node));
    return () => {
      cleanups.forEach((cleanup, index) => {
        if (typeof cleanup === "function") cleanup();
        else setRef(refs[index], null);
      });
    };
  };
}
```

**Why good:** Every consumer of the node gets it -- the consumer's forwarded ref, the component's internal measurement ref, and a positioning library's ref, all at once. The returned cleanup is what React 19 expects from a callback ref; returning it means a ref that registers something on mount can unregister it on unmount, instead of leaking the detached node.

**Gotcha:** React 19 allows callback refs to return a cleanup function, and when one does, React stops calling the ref with `null` on unmount. A `composeRefs` that ignores return values therefore leaks the old node for any ref that adopted the new convention. Collect the returns, and fall back to `null` for refs that returned nothing.

---

## Forwarding Discipline: Prop Ordering

Substitution is only half of the contract. The part must also let everything the consumer passes reach the DOM.

```tsx
const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  function AccordionTrigger({ asChild = false, ...rest }, forwardedRef) {
    const { open, panelId, triggerId, toggle } =
      useAccordionItemContext("Trigger");
    const Component = asChild ? Slot.Root : "button";

    return (
      <Component
        // 1. Defaults -- before the spread so the consumer can override them
        type={asChild ? undefined : "button"}
        // 2. The consumer's props
        {...rest}
        // 3. Non-negotiables -- after the spread so nothing can clobber them
        ref={forwardedRef}
        id={rest.id ?? triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        data-state={open ? "open" : "closed"}
        onClick={composeEventHandlers(rest.onClick, toggle)}
      />
    );
  },
);
```

**Why good:** The ordering is the policy. A consumer can pass `type="submit"` and win, because defaults precede the spread. A consumer cannot accidentally pass `aria-expanded` and desynchronize it from the real state, because the wiring follows the spread. Their `onClick` is not overwritten -- it is composed, and it runs first. `id` is the one non-negotiable with an opt-out, because external `aria-controls` sometimes has to name it.

**Why the reverse order is bad:**

```tsx
// BAD: the spread comes last
<button aria-expanded={open} onClick={toggle} {...rest} />
```

A consumer passing `onClick` for analytics silently deletes the toggle. A consumer passing `aria-expanded` -- often copied from an example -- freezes the announced state. Neither produces a type error.

**Why an allowlist is bad:**

```tsx
// BAD: only the props the author imagined
function AccordionTrigger({
  children,
  className,
  onClick,
}: AccordionTriggerProps) {
  return (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  );
}
```

`id`, `aria-label`, `data-testid`, `tabIndex`, `onKeyDown`, `style` and the ref all vanish. Consumers respond by adding a wrapper element to hang those on, which breaks the layout and the selectors the trigger sat in.

---

## Ref Forwarding Across React Versions

```tsx
// Works everywhere
const Item = forwardRef<HTMLDivElement, ItemProps>(
  function Item(props, forwardedRef) {
    return <div {...props} ref={forwardedRef} />;
  },
);

// React 19: ref is an ordinary prop, no wrapper needed
function Item({
  ref,
  ...props
}: ItemProps & { ref?: React.Ref<HTMLDivElement> }) {
  return <div {...props} ref={ref} />;
}
```

**Why it matters either way:** the rule is not "call `forwardRef`", it is "the ref reaches the DOM node". Pick one form per library so the parts look alike, and never accept a ref you do not attach -- an accepted-and-dropped ref is worse than a missing one, because `ref` type-checks at the call site and the consumer has no reason to suspect it.

---

## Anti-Pattern: Hand-Rolled `cloneElement`

```tsx
// BAD: looks like Slot, behaves nothing like it
function Trigger({ children, ...props }: TriggerProps) {
  return React.cloneElement(children as React.ReactElement, props);
}
```

**Why bad:** `cloneElement` overwrites rather than merges. The child's `onClick` is replaced by the trigger's, its `className` is replaced instead of concatenated, its `style` is replaced instead of merged, and its `ref` is dropped entirely unless it is passed through explicitly. Nothing errors. The component renders, and the consumer's props are gone. If substitution is needed and no library is available, implement the merge explicitly with `composeEventHandlers` and `composeRefs` -- the two helpers above are the whole difference.

# Composable Components — Substitution and Forwarding Examples

> Full code for Patterns 6–7 in [SKILL.md](../SKILL.md): both substitution shapes built without a library, the merge they share, `composeEventHandlers` and `composeRefs`, and prop ordering. The merge rules are a table in [reference.md](../reference.md#element-substitution).

**Prerequisites:** Pattern 1 in [core.md](core.md) — substitution is a property of each part, applied uniformly across all of them. Code is React 19: `ref` is a prop, and a child element's ref is `element.props.ref`.

---

## Pattern 6: Element Substitution

### The problem

```tsx
// Without substitution: a wrapper appears in the layout and in every selector
<Tooltip.Trigger>
  <a href="/docs">Docs</a>
</Tooltip.Trigger>
// Renders: <button ...tooltip wiring><a href="/docs">Docs</a></button>
```

**Why bad:** A `<button>` wrapping an `<a>` is invalid interactive nesting, breaks keyboard semantics, and inserts an element into the consumer's flex row. The tooltip's `aria-describedby` and its focus and hover handlers land on the button, not on the link the user interacts with.

### The merge both shapes share

Substitution clones an element the consumer supplied and merges the part's props onto it. The element's own props are the consumer's, so they win — except where both sides must survive.

```tsx
interface MergeableProps {
  readonly [name: string]: unknown;
  readonly ref?: React.Ref<HTMLElement>;
}

type Handler = (...args: unknown[]) => unknown;

const EVENT_HANDLER_NAME = /^on[A-Z]/;
const ID_REFERENCE_PROPS = new Set(["aria-describedby", "aria-labelledby"]);
const ID_LIST_SEPARATOR = /\s+/;

function mergeSlotProps(
  partProps: MergeableProps,
  elementProps: MergeableProps,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...partProps, ...elementProps };

  for (const name of Object.keys(partProps)) {
    const partValue = partProps[name];
    const elementValue = elementProps[name];

    const isHandlerPair =
      EVENT_HANDLER_NAME.test(name) &&
      isHandler(partValue) &&
      isHandler(elementValue);

    if (isHandlerPair) {
      merged[name] = runInOrder(elementValue, partValue);
    } else if (name === "className") {
      merged.className = [partValue, elementValue].filter(Boolean).join(" ");
    } else if (ID_REFERENCE_PROPS.has(name)) {
      merged[name] = joinIdReferences(partValue, elementValue);
    } else if (
      name === "style" &&
      isStyle(partValue) &&
      isStyle(elementValue)
    ) {
      merged.style = { ...partValue, ...elementValue };
    }
  }

  merged.ref =
    partProps.ref === undefined
      ? elementProps.ref
      : composeRefs(partProps.ref, elementProps.ref);
  return merged;
}

function isHandler(value: unknown): value is Handler {
  return typeof value === "function";
}

function isStyle(value: unknown): value is React.CSSProperties {
  return typeof value === "object" && value !== null;
}

function runInOrder(first: Handler, second: Handler): Handler {
  return (...args) => {
    first(...args);
    second(...args);
  };
}

function joinIdReferences(
  partValue: unknown,
  elementValue: unknown,
): string | undefined {
  const ids = [partValue, elementValue]
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(ID_LIST_SEPARATOR))
    .filter(Boolean);
  return ids.length === 0 ? undefined : [...new Set(ids)].join(" ");
}
```

**Why good:** Handlers run consumer-first and both always run — the part's own handler, built with `composeEventHandlers`, is what decides whether to skip after the consumer's `preventDefault()`. `className` concatenates, `style` merges with the consumer's keys winning, and both refs receive the node. `aria-describedby` and `aria-labelledby` join both sides' ids, de-duplicated with the part's first, so a description or label the part wires is never silently replaced by one the consumer's element already carries. Every other prop is the consumer's.

### Shape A: `asChild`

The part renders a slot instead of its own element; the slot merges onto its single child.

```tsx
import { Children, cloneElement, isValidElement } from "react";

interface SlotProps extends MergeableProps {
  readonly children?: React.ReactNode;
}

function Slot({ children, ...partProps }: SlotProps) {
  const child = Children.only(children);
  if (!isValidElement<MergeableProps>(child)) return null;

  return cloneElement(child, mergeSlotProps(partProps, child.props));
}
```

```tsx
interface TooltipTriggerProps extends React.ComponentProps<"button"> {
  /** Merge this part's props and behaviour onto its single child instead of rendering a button. */
  readonly asChild?: boolean;
}

function TooltipTrigger({
  asChild = false,
  ref,
  ...rest
}: TooltipTriggerProps) {
  const { open, describedById, onTriggerEnter } = useTooltipContext("Trigger");
  const Component = asChild ? Slot : "button";

  return (
    <Component
      type={asChild ? undefined : "button"}
      {...rest}
      ref={ref}
      aria-describedby={open ? describedById : undefined}
      data-state={open ? "open" : "closed"}
      onPointerEnter={composeEventHandlers(rest.onPointerEnter, onTriggerEnter)}
    />
  );
}
```

```tsx
<Tooltip.Trigger asChild>
  <a href="/docs">Docs</a>
</Tooltip.Trigger>
// Renders: <a href="/docs" aria-describedby="..." data-state="closed" ...>Docs</a>
```

**Why good:** No wrapper exists. The link keeps its `href`, its focusability and its router integration, and gains the tooltip's wiring. `type="button"` is dropped when substituting, because it is a `<button>` default that means nothing on another element.

**Several children:** `Children.only` throws when the slot receives more than one element, so a part that renders decoration around its content cannot slot it directly. Keep decoration out of slotted parts, or offer the `render` callback form below, where the consumer decides which element receives the props.

### Shape B: `render`

The part takes an element, or a callback, describing what to render in its place.

```tsx
import { cloneElement, createElement } from "react";

type RenderProp<TState> =
  | React.ReactElement<MergeableProps>
  | ((props: MergeableProps, state: TState) => React.ReactElement);

interface RenderPartParams<TState> {
  readonly render: RenderProp<TState> | undefined;
  readonly defaultTagName: keyof React.JSX.IntrinsicElements;
  readonly props: MergeableProps;
  readonly state: TState;
}

function renderPart<TState>({
  render,
  defaultTagName,
  props,
  state,
}: RenderPartParams<TState>): React.ReactElement {
  if (render === undefined) return createElement(defaultTagName, props);
  if (typeof render === "function") return render(props, state);
  return cloneElement(render, mergeSlotProps(props, render.props));
}
```

```tsx
interface TooltipTriggerState {
  readonly open: boolean;
}

interface TooltipTriggerProps extends React.ComponentProps<"button"> {
  /** An element to render instead of a button, or a callback receiving the props and state. */
  readonly render?: RenderProp<TooltipTriggerState>;
}

function TooltipTrigger({ render, ref, ...rest }: TooltipTriggerProps) {
  const { open, describedById, onTriggerEnter } = useTooltipContext("Trigger");

  return renderPart({
    render,
    defaultTagName: "button",
    state: { open },
    props: {
      type: render === undefined ? "button" : undefined,
      ...rest,
      ref,
      "aria-describedby": open ? describedById : undefined,
      "data-state": open ? "open" : "closed",
      onPointerEnter: composeEventHandlers(rest.onPointerEnter, onTriggerEnter),
    },
  });
}
```

```tsx
// Element form: the part renders as the given element
<Tooltip.Trigger render={<a href="/docs" />}>Docs</Tooltip.Trigger>

// Callback form: the consumer places the props and reads the state
<Popover.Trigger
  render={(props, state) => (
    <button {...props}>
      {state.open ? "Hide details" : "Show details"}
      <Chevron data-state={state.open ? "open" : "closed"} />
    </button>
  )}
/>
```

**Why good:** The element form merges exactly as `asChild` does — the element passed to `render` plays the child's role — so the two shapes differ in ergonomics, not in guarantees. The callback form hands over the assembled props and the state, so the consumer can split props across elements and branch on state instead of mirroring it; in exchange, spreading `props` and composing their own handlers with it is the consumer's job. Use the callback when the content depends on state, the element form when only the element changes.

### Suppressing the part's handler

Both shapes run the consumer's handler first, so one convention covers both: the consumer calls `event.preventDefault()`, and the part's handler — composed with `composeEventHandlers` — skips. That only reaches handlers that receive an event. A change callback that receives a value (`onValueChange`) has nothing to call `preventDefault()` on; vetoing that change is what `details.cancel()` is for ([Pattern 4](state-contract.md#building-and-consuming-change-details)).

A library's own merge helper may order handlers differently or offer its own skip method on the event. Parts built over a library use that helper and its convention — whatever you choose, document the one your parts honour.

### Hand-rolled `cloneElement`

```tsx
// BAD: the part's props passed straight through
function Trigger({ children, ...props }: TriggerProps) {
  return cloneElement(children, props);
}
```

**Why bad:** `cloneElement` prefers the passed value for every prop it is given. The child's `onClick` is replaced by the trigger's, its `className` and `style` are replaced instead of merged, and the `ref` the trigger needs for measurement replaces the child's own. Nothing errors; the consumer's props are simply gone. `Slot` above calls `cloneElement` too — the difference is `mergeSlotProps` first.

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

**Why good:** The consumer's handler always runs, and `preventDefault()` gives them a documented way to opt out of the component's behaviour for one event. `checkForDefaultPrevented: false` declares a behaviour not suppressible — closing on selection, say, where suppression would leave the component broken.

### `composeRefs`

```tsx
type PossibleRef<T> = React.Ref<T> | undefined;

function setRef<T>(ref: PossibleRef<T>, value: T | null): (() => void) | void {
  if (typeof ref === "function") return ref(value);
  // RefObject.current is mutable in React 19's types; React 18's mark it readonly.
  if (ref !== null && ref !== undefined) ref.current = value;
}

function composeRefs<T>(
  ...refs: readonly PossibleRef<T>[]
): React.RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => setRef(ref, node));
    // React 18 logs an error for a callback ref that returns a function.
    if (!cleanups.some((cleanup) => typeof cleanup === "function")) return;

    return () => {
      cleanups.forEach((cleanup, index) => {
        if (typeof cleanup === "function") cleanup();
        else setRef(refs[index], null);
      });
    };
  };
}
```

**Why good:** Every consumer of the node gets it — the forwarded ref, the internal measurement ref, a positioning helper's ref. React 19 lets a callback ref return a cleanup and then skips calling it with `null`; a composed ref that ignored those returns would get the `null` call instead and never run the cleanups. Returning a composed cleanup only when some ref supplied one keeps React 18 quiet, because there the composed ref is still called with `null` and clears every ref itself.

---

## Pattern 7: Prop Forwarding

### Prop ordering

```tsx
function AccordionTrigger({
  asChild = false,
  ref,
  ...rest
}: AccordionTriggerProps) {
  const { open, panelId, triggerId, toggle } =
    useAccordionItemContext("Trigger");
  const Component = asChild ? Slot : "button";

  return (
    <Component
      // 1. Defaults — before the spread so the consumer can override them
      type={asChild ? undefined : "button"}
      // 2. The consumer's props
      {...rest}
      // 3. Wiring — after the spread so nothing can clobber it
      ref={ref}
      id={rest.id ?? triggerId}
      aria-expanded={open}
      aria-controls={panelId}
      data-state={open ? "open" : "closed"}
      onClick={composeEventHandlers(rest.onClick, toggle)}
    />
  );
}
```

**Why good:** The ordering is the policy. A consumer can pass `type="submit"` and win, because defaults precede the spread. A consumer cannot pass `aria-expanded` and desynchronize it from the real state, because the wiring follows the spread. Their `onClick` is composed and runs first. `id` is the one wired prop with an opt-out, because external `aria-controls` sometimes has to name it.

**Why the reverse order is bad:**

```tsx
// BAD: the spread comes last
<button aria-expanded={open} onClick={toggle} {...rest} />
```

A consumer passing `onClick` for analytics deletes the toggle; one passing `aria-expanded`, often copied from an example, freezes the announced state. Neither is a type error.

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

`id`, `aria-label`, `data-testid`, `tabIndex`, `onKeyDown`, `style` and the ref all vanish. Consumers respond with a wrapper element to hang them on, which breaks the layout and selectors the trigger sat in.

### Ref forwarding across React versions

```tsx
// React 19: ref is an ordinary prop
function Item({ ref, ...props }: React.ComponentProps<"div">) {
  return <div {...props} ref={ref} />;
}

// React 18: only forwardRef delivers it
const Item = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(
  function Item(props, forwardedRef) {
    return <div {...props} ref={forwardedRef} />;
  },
);
```

**Why it matters either way:** the rule is "the ref reaches the DOM node", not "call `forwardRef`". React 19 no longer needs the wrapper and plans to deprecate it, so a library that still supports React 18 keeps `forwardRef` on every part and one that does not drops it everywhere. Under React 18 a child element's ref is `element.ref` rather than `element.props.ref`, so a slot has to read it from there before merging. Never accept a ref you do not attach — `ref` type-checks at the call site, so the consumer has no reason to suspect it went nowhere.

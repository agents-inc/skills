# Chakra UI v3 Reference

> Decision frameworks, migration guide, and anti-patterns for Chakra UI v3. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Chakra UI vs Other Options

```
Need UI components?
├─ Do you want style props (CSS-in-JS via props)?
│   ├─ YES → Chakra UI is ideal
│   └─ NO → Consider utility-class libraries (shadcn/ui + Tailwind)
├─ Do you need accessible, composable components?
│   ├─ YES → Chakra UI (built on Ark UI)
│   └─ NO → Consider lighter alternatives
├─ Do you need a design token system with recipes?
│   ├─ YES → Chakra UI provides this out of the box
│   └─ NO → Plain styling or utility classes may suffice
├─ Are you already using Tailwind CSS?
│   └─ YES → shadcn/ui integrates better with Tailwind
└─ Do you need maximum bundle-size control?
    ├─ YES → Consider headless libraries (Radix, Ark UI) with your own CSS
    └─ NO → Chakra UI is fine
```

### Styling Approach Decision

```
How should I style this?
├─ Is it a standard Chakra component?
│   └─ Use style props directly: <Box bg="blue.500" p="4" />
├─ Does it need variants (size, color, state)?
│   └─ Create a recipe with defineRecipe
├─ Is it a multi-part component (card with header/body/footer)?
│   └─ Create a slot recipe with defineSlotRecipe
├─ Is it a non-Chakra element that needs style props?
│   └─ Wrap with chakra factory: const Styled = chakra("div")
└─ Do I need one-off custom styles?
    └─ Use the css prop or inline style props
```

### Component Selection

```
Need an overlay component?
├─ Confirmation/alert → Dialog with role="alertdialog"
├─ Form or detailed content → Dialog (centered modal)
├─ Side panel → Drawer (slides from edge)
├─ Contextual info → Popover (anchored to trigger)
└─ Selection list → Menu (dropdown)

Need a form field?
├─ Text input → Input
├─ Multi-line → Textarea
├─ Selection (few options) → RadioGroup or SegmentedControl
├─ Selection (many options) → Select or custom Combobox
├─ Boolean toggle → Switch
├─ Agreement → Checkbox
└─ Wrapping any field → Field.Root + Field.Label + Field.ErrorMessage
```

---

## v2 to v3 Migration Reference

### Dependency Changes

| v2 Required        | v3 Required        | Notes                               |
| ------------------ | ------------------ | ----------------------------------- |
| `@chakra-ui/react` | `@chakra-ui/react` | Same package, new API               |
| `@emotion/react`   | `@emotion/react`   | Still needed                        |
| `@emotion/styled`  | --                 | **Removed**                         |
| `framer-motion`    | --                 | **Removed** (CSS animations)        |
| `@chakra-ui/icons` | --                 | **Removed** (use your icon library) |

### Provider Changes

```tsx
// v2
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
const theme = extendTheme({ colors: { brand: { 500: "#d53f8c" } } });
<ChakraProvider theme={theme}>

// v3
import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
const config = defineConfig({ theme: { tokens: { colors: { brand: { 500: { value: "#d53f8c" } } } } } });
const system = createSystem(defaultConfig, config);
<ChakraProvider value={system}>
```

### Component API Changes

| v2                    | v3                              | Notes                           |
| --------------------- | ------------------------------- | ------------------------------- |
| `<Modal>`             | `<Dialog.Root>`                 | Compound component              |
| `<Drawer>`            | `<Drawer.Root>`                 | Compound component              |
| `<Menu>`              | `<Menu.Root>`                   | Compound component              |
| `<Popover>`           | `<Popover.Root>`                | Compound component              |
| `<Checkbox>`          | `<Checkbox.Root>`               | Compound component              |
| `<Radio>`             | `<RadioGroup.Item>`             | Compound component              |
| `<Select>`            | `<Select.Root>`                 | Compound component              |
| `isOpen` / `onClose`  | `open` / `onOpenChange`         | Callback receives `{ open }`    |
| `isDisabled`          | `disabled`                      | Dropped `is` prefix             |
| `isLoading`           | `loading`                       | Dropped `is` prefix             |
| `isInvalid`           | `invalid`                       | Dropped `is` prefix             |
| `isRequired`          | `required`                      | Dropped `is` prefix             |
| `spacing` (Stack)     | `gap`                           | Aligned with CSS                |
| `useDisclosure()`     | Controlled state or `open` prop | Hook removed                    |
| `useColorModeValue()` | Semantic tokens or `_dark`      | Prefer tokens; hook still works |
| `as` prop             | `asChild` prop                  | For polymorphism                |

### Codemod

Automate migration with:

```bash
npx @chakra-ui/codemod upgrade
```

Handles component renames, prop changes, import updates, and compound component restructuring.

---

## Anti-Patterns

### Using v2 Theme API

```tsx
// WRONG: v2 extendTheme is removed
import { extendTheme } from "@chakra-ui/react";
const theme = extendTheme({ colors: { brand: { 500: "#d53f8c" } } });

// CORRECT: v3 createSystem with defineConfig
import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
const config = defineConfig({
  theme: { tokens: { colors: { brand: { 500: { value: "#d53f8c" } } } } },
});
const system = createSystem(defaultConfig, config);
```

### Using is-Prefixed Boolean Props

```tsx
// WRONG: v2 boolean props
<Button isLoading isDisabled>Submit</Button>
<Input isInvalid isRequired />

// CORRECT: v3 boolean props
<Button loading disabled>Submit</Button>
<Input invalid required />
```

### Using useDisclosure

```tsx
// WRONG: v2 useDisclosure hook (removed)
const { isOpen, onOpen, onClose } = useDisclosure();
<Modal isOpen={isOpen} onClose={onClose}>

// CORRECT: v3 controlled state
const [open, setOpen] = useState(false);
<Dialog.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
```

### Hardcoding Colors Instead of Tokens

```tsx
// WRONG: hardcoded hex values
<Box bg="#3182ce" color="#ffffff" p="16px">

// CORRECT: design tokens
<Box bg="blue.500" color="white" p="4">
```

### Not Using Composable Components

```tsx
// WRONG: trying to use v2 flat imports
import { ModalHeader, ModalBody, ModalFooter } from "@chakra-ui/react";

// CORRECT: v3 compound components
import { Dialog } from "@chakra-ui/react";
// Then use: Dialog.Header, Dialog.Body, Dialog.Footer
```

---

## Semantic Token Quick Reference

| Token                 | Light Mode     | Dark Mode     | Use Case                 |
| --------------------- | -------------- | ------------- | ------------------------ |
| `bg`                  | white          | dark gray     | Page background          |
| `bg.subtle`           | light gray     | darker gray   | Subtle containers        |
| `bg.muted`            | medium gray    | medium dark   | Muted backgrounds        |
| `fg`                  | black          | white         | Primary text             |
| `fg.muted`            | gray           | light gray    | Secondary text           |
| `fg.subtle`           | lighter gray   | darker gray   | Tertiary text            |
| `border`              | gray border    | dark border   | Default borders          |
| `border.muted`        | lighter border | darker border | Subtle borders           |
| `colorPalette.solid`  | --             | --            | Solid fill from palette  |
| `colorPalette.muted`  | --             | --            | Muted fill from palette  |
| `colorPalette.subtle` | --             | --            | Subtle fill from palette |
| `colorPalette.fg`     | --             | --            | Foreground from palette  |

---

## Style Props Quick Reference

### Spacing

| Prop                   | CSS Property                | Example     |
| ---------------------- | --------------------------- | ----------- |
| `p`, `padding`         | padding                     | `p="4"`     |
| `pt`, `pb`, `pl`, `pr` | padding-{side}              | `pt="2"`    |
| `px`, `py`             | padding horizontal/vertical | `px="6"`    |
| `ps`, `pe`             | padding-inline-start/end    | `ps="4"`    |
| `m`, `margin`          | margin                      | `m="4"`     |
| `mt`, `mb`, `ml`, `mr` | margin-{side}               | `mt="2"`    |
| `mx`, `my`             | margin horizontal/vertical  | `mx="auto"` |
| `gap`                  | gap                         | `gap="4"`   |

### Layout

| Prop          | CSS Property | Example             |
| ------------- | ------------ | ------------------- |
| `w`, `width`  | width        | `w="full"`          |
| `h`, `height` | height       | `h="10"`            |
| `maxW`        | max-width    | `maxW="md"`         |
| `minH`        | min-height   | `minH="screen"`     |
| `display`     | display      | `display="flex"`    |
| `overflow`    | overflow     | `overflow="hidden"` |

### Visual

| Prop          | CSS Property  | Example                |
| ------------- | ------------- | ---------------------- |
| `bg`          | background    | `bg="blue.500"`        |
| `color`       | color         | `color="fg.muted"`     |
| `opacity`     | opacity       | `opacity="0.5"`        |
| `shadow`      | box-shadow    | `shadow="lg"`          |
| `rounded`     | border-radius | `rounded="md"`         |
| `border`      | border        | `border="1px"`         |
| `borderColor` | border-color  | `borderColor="border"` |

### Typography

| Prop            | CSS Property   | Example                     |
| --------------- | -------------- | --------------------------- |
| `fontSize`      | font-size      | `fontSize="lg"`             |
| `fontWeight`    | font-weight    | `fontWeight="bold"`         |
| `lineHeight`    | line-height    | `lineHeight="tall"`         |
| `textAlign`     | text-align     | `textAlign="center"`        |
| `textTransform` | text-transform | `textTransform="uppercase"` |

### Flex/Grid

| Prop                  | CSS Property          | Example                                |
| --------------------- | --------------------- | -------------------------------------- |
| `align`               | align-items           | `align="center"`                       |
| `justify`             | justify-content       | `justify="between"`                    |
| `wrap`                | flex-wrap             | `wrap="wrap"`                          |
| `flex`                | flex                  | `flex="1"`                             |
| `gridTemplateColumns` | grid-template-columns | `gridTemplateColumns="repeat(3, 1fr)"` |

---

## Breakpoint Reference

| Name   | Value | Pixels |
| ------ | ----- | ------ |
| `base` | 0rem  | 0px    |
| `sm`   | 30rem | 480px  |
| `md`   | 48rem | 768px  |
| `lg`   | 62rem | 992px  |
| `xl`   | 80rem | 1280px |
| `2xl`  | 96rem | 1536px |

---

## Sources

- [Chakra UI v3 Documentation](https://chakra-ui.com/docs)
- [Announcing v3 Blog Post](https://www.chakra-ui.com/blog/announcing-v3)
- [v2 vs v3 Comparison](https://chakra-ui.com/blog/chakra-v2-vs-v3-a-detailed-comparison)
- [Migration Guide](https://chakra-ui.com/docs/get-started/migration)
- [Chakra Factory](https://chakra-ui.com/docs/styling/chakra-factory)
- [Recipes](https://chakra-ui.com/docs/theming/recipes)
- [Slot Recipes](https://chakra-ui.com/docs/theming/slot-recipes)

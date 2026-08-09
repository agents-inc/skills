# Tamagui Quick Reference

> Decision frameworks, token mapping, and checklists. See [SKILL.md](SKILL.md) for patterns and red flags.

---

## Token Category to Style Property Mapping

| Token Category | Applied To                                              |
| -------------- | ------------------------------------------------------- |
| **size**       | width, height, minWidth, maxWidth, minHeight, maxHeight |
| **space**      | margin, padding, gap, top, left, right, bottom          |
| **radius**     | borderRadius, borderTopLeftRadius, etc.                 |
| **color**      | color, backgroundColor, borderColor, shadowColor        |
| **zIndex**     | zIndex                                                  |
| **font**       | fontFamily (via createFont)                             |

Access tokens in components with `$` prefix: `<YStack padding="$4" backgroundColor="$background" />`

Access tokens programmatically: `getTokens().size.small.val` (raw value), `getTokens().size.small.variable` (CSS variable)

---

## Standard Theme Keys

Themes should define these keys for full UI kit compatibility:

| Key                                                          | Purpose                     |
| ------------------------------------------------------------ | --------------------------- |
| `background`                                                 | Component/screen background |
| `backgroundHover`                                            | Hover state background      |
| `backgroundPress`                                            | Press state background      |
| `backgroundFocus`                                            | Focus state background      |
| `color`                                                      | Primary text color          |
| `colorHover` / `colorPress` / `colorFocus`                   | Text state variants         |
| `borderColor`                                                | Default border color        |
| `borderColorHover` / `borderColorPress` / `borderColorFocus` | Border state variants       |
| `shadowColor`                                                | Shadow color                |
| `placeholderColor`                                           | Input placeholder text      |
| `outlineColor`                                               | Focus outline               |

---

## Theme Naming Convention

```
base:        light, dark
sub-theme:   dark_green, light_blue
multi-level: dark_green_subtle
component:   dark_Card, light_Button
```

Nesting resolves automatically: `<Theme name="dark"><Theme name="green">` looks up `dark_green`.

---

## Media Query Config (v5 defaults, Tailwind-aligned)

| Name    | Breakpoint     | Type      |
| ------- | -------------- | --------- |
| `$sm`   | maxWidth: 640  | max-width |
| `$md`   | maxWidth: 768  | max-width |
| `$lg`   | maxWidth: 1024 | max-width |
| `$xl`   | maxWidth: 1280 | max-width |
| `$xxl`  | maxWidth: 1536 | max-width |
| `$gtSm` | minWidth: 641  | min-width |
| `$gtMd` | minWidth: 769  | min-width |
| `$gtLg` | minWidth: 1025 | min-width |

Additional: `$short` (maxHeight), `$pointerTouch` (touch device), `$hoverable` (hover capable)

---

## Animation Drivers

| Driver       | Package                            | Best For                                      |
| ------------ | ---------------------------------- | --------------------------------------------- |
| CSS          | `@tamagui/animations-css`          | Web (smallest bundle, native CSS transitions) |
| React Native | `@tamagui/animations-react-native` | Native (no extra deps, Animated API)          |
| Reanimated   | `@tamagui/animations-reanimated`   | Native (worklet-based, spring physics)        |
| Motion       | `@tamagui/animations-motion`       | Web (WAAPI, advanced web animations)          |

**Deprecated:** `@tamagui/animations-moti` -- switch to `@tamagui/animations-reanimated` (same API).

---

## Compiler Optimization Checklist

Styles that **CAN** be flattened (compiler extracts to CSS/static styles):

- [x] Token values: `padding="$4"`, `color="$color"`
- [x] Spread variants: `size="$4"` with `"...size"` variant
- [x] Boolean variants: `elevated` / `elevated={true}`
- [x] Media query props: `$gtMd={{ padding: "$4" }}`
- [x] String render prop: `render="button"` (web semantic HTML)
- [x] Static defaultVariants

Styles that **CANNOT** be flattened (runtime evaluation required):

- [ ] JavaScript ternaries: `padding={isLarge ? "$4" : "$2"}`
- [ ] Function render props: `render={(props) => <Custom {...props} />}`
- [ ] Dynamic expressions in style values
- [ ] Conditionally applied props via spread: `{...conditionalStyles}`
- [ ] Runtime-computed variant values

---

## Spread Variant Categories

Available for `"...category"` syntax in variant definitions:

`...size`, `...color`, `...radius`, `...space`, `...font`, `...fontSize`, `...lineHeight`, `...letterSpace`, `...zIndex`

Functional variant receives: `(value, { tokens, theme, props, font, fontFamily, fonts, context })`

---

## Stack Components

| Component | Layout             | Equivalent                            |
| --------- | ------------------ | ------------------------------------- |
| `XStack`  | Horizontal (row)   | `View` with `flexDirection: 'row'`    |
| `YStack`  | Vertical (column)  | `View` with `flexDirection: 'column'` |
| `ZStack`  | Layered (absolute) | Children absolutely positioned        |

All extend `View` from `@tamagui/core` and accept all style properties.

---

## Text Components

| Component     | Purpose                                                               |
| ------------- | --------------------------------------------------------------------- |
| `Text`        | Base text, no theme defaults                                          |
| `SizableText` | Text with `size` prop (maps to font scale)                            |
| `Paragraph`   | SizableText with semantic `<p>` on web, default size/color from theme |

---

## v2 Migration Notes (from v1)

| v1                                   | v2                                                | Notes                                    |
| ------------------------------------ | ------------------------------------------------- | ---------------------------------------- |
| `animation="bouncy"`                 | `transition="bouncy"`                             | Prop renamed                             |
| `@tamagui/config/v4`                 | `@tamagui/config/v5`                              | New defaults, Tailwind breakpoints       |
| `@tamagui/animations-moti`           | `@tamagui/animations-reanimated`                  | Moti deprecated                          |
| `2xl` / `2xs` media names            | `xxl` / `xxs`                                     | Kebab-case standardized                  |
| `flex` defaults to `flexBasis: auto` | `flexBasis: 0` with `styleCompat: 'react-native'` | Check layouts                            |
| `defaultPosition: 'relative'`        | `static` (browser default)                        | Explicit `position="relative"` if needed |
| Animations bundled in config         | Import separately (`v5-css`, `v5-rn`)             | Smaller default bundle                   |

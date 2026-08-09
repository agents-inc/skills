# React Native Paper Quick Reference

> Decision frameworks, MD3 color roles, typography scale. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

## Component Decision Table

| Need                    | Component              | Mode/Variant                             | Notes                                   |
| ----------------------- | ---------------------- | ---------------------------------------- | --------------------------------------- |
| Primary screen action   | `FAB`                  | `variant="primary"`                      | Position absolute bottom-right          |
| High-emphasis button    | `Button`               | `mode="contained"`                       | Filled background                       |
| Medium-emphasis button  | `Button`               | `mode="outlined"` or `"contained-tonal"` | Border or tonal fill                    |
| Low-emphasis button     | `Button`               | `mode="text"`                            | Text only, no background                |
| Segmented choice        | `SegmentedButtons`     | Single or `multiSelect`                  | 2-5 options                             |
| Tappable card           | `Card`                 | `mode="elevated"`                        | With `onPress`                          |
| Informational card      | `Card`                 | `mode="outlined"`                        | No `onPress`                            |
| Text input (dense form) | `TextInput`            | `mode="flat"`                            | Underline style                         |
| Text input (prominent)  | `TextInput`            | `mode="outlined"`                        | Border style                            |
| Search                  | `Searchbar`            | -                                        | Built-in clear button                   |
| Dialog / confirmation   | `Dialog`               | Wrap in `Portal`                         | Sub-components: Title, Content, Actions |
| Temporary message       | `Snackbar`             | Wrap in `Portal`                         | With optional `action`                  |
| Top bar                 | `Appbar.Header`        | `mode="small"` / `"large"`               | With BackAction, Content, Action        |
| Bottom tabs             | `BottomNavigation.Bar` | Custom `tabBar`                          | With React Navigation bottom-tabs       |
| Menu / dropdown         | `Menu`                 | Wrap in `Portal`                         | Anchored to trigger element             |
| Loading                 | `ActivityIndicator`    | -                                        | Reads theme color                       |
| Toggle                  | `Switch`               | -                                        | MD3 styled                              |
| Selection (single)      | `RadioButton.Group`    | -                                        | With RadioButton.Item                   |
| Selection (multi)       | `Checkbox`             | -                                        | Checkbox.Item for label                 |
| Chip / tag              | `Chip`                 | `mode="flat"` / `"outlined"`             | With optional icon, onClose             |
| Progress                | `ProgressBar`          | -                                        | Determinate or indeterminate            |
| Data display            | `DataTable`            | -                                        | With Header, Row, Cell, Pagination      |
| Info banner             | `Banner`               | -                                        | With actions and optional icon          |

---

## MD3 Color Roles Reference

| Role                 | Light Usage                  | Dark Usage                   |
| -------------------- | ---------------------------- | ---------------------------- |
| `primary`            | Primary buttons, FAB         | Primary buttons, FAB         |
| `onPrimary`          | Text/icons on primary        | Text/icons on primary        |
| `primaryContainer`   | Tonal buttons, chips         | Tonal buttons, chips         |
| `onPrimaryContainer` | Text on primaryContainer     | Text on primaryContainer     |
| `secondary`          | Less prominent elements      | Less prominent elements      |
| `secondaryContainer` | Selected states, active tabs | Selected states, active tabs |
| `tertiary`           | Accent elements              | Accent elements              |
| `surface`            | Card backgrounds, sheets     | Card backgrounds, sheets     |
| `surfaceVariant`     | Input backgrounds, dividers  | Input backgrounds, dividers  |
| `onSurface`          | Primary text color           | Primary text color           |
| `onSurfaceVariant`   | Secondary text, icons        | Secondary text, icons        |
| `outline`            | Borders, dividers            | Borders, dividers            |
| `outlineVariant`     | Subtle borders               | Subtle borders               |
| `error`              | Error states                 | Error states                 |
| `errorContainer`     | Error backgrounds            | Error backgrounds            |
| `elevation.level0-5` | Surface elevation overlays   | Surface elevation overlays   |
| `inverseSurface`     | Snackbar background          | Snackbar background          |
| `inverseOnSurface`   | Text on snackbar             | Text on snackbar             |

---

## MD3 Typography Scale

| Variant          | Default Size | Default Weight | Use Case          |
| ---------------- | ------------ | -------------- | ----------------- |
| `displayLarge`   | 57px         | 400            | Hero text         |
| `displayMedium`  | 45px         | 400            | Large headers     |
| `displaySmall`   | 36px         | 400            | Section headers   |
| `headlineLarge`  | 32px         | 400            | Page titles       |
| `headlineMedium` | 28px         | 400            | Section titles    |
| `headlineSmall`  | 24px         | 400            | Card titles       |
| `titleLarge`     | 22px         | 400            | App bar title     |
| `titleMedium`    | 16px         | 500            | List item primary |
| `titleSmall`     | 14px         | 500            | List item label   |
| `labelLarge`     | 14px         | 500            | Button text       |
| `labelMedium`    | 12px         | 500            | Tab labels        |
| `labelSmall`     | 11px         | 500            | Badge text        |
| `bodyLarge`      | 16px         | 400            | Body text         |
| `bodyMedium`     | 14px         | 400            | Secondary text    |
| `bodySmall`      | 12px         | 400            | Caption, helper   |

Usage: `<Text variant="headlineMedium">Title</Text>`

---

## FAB Size Reference

| Size     | Height | Use Case                    |
| -------- | ------ | --------------------------- |
| `small`  | 40pt   | Secondary actions, toolbars |
| `medium` | 56pt   | Primary action (default)    |
| `large`  | 96pt   | Prominent primary action    |

---

## Button Mode Emphasis Levels

```
Low emphasis ←──────────────────────── High emphasis
   text    outlined    contained-tonal    elevated    contained
```

- **text**: Lowest emphasis. Cancel, dismiss, tertiary actions.
- **outlined**: Medium-low. Secondary actions alongside contained.
- **contained-tonal**: Medium. Important but not primary (save draft vs submit).
- **elevated**: Medium-high. Same as contained but with shadow.
- **contained**: Highest. Primary, most important action on screen.

---

## Setup Checklist

- [ ] `react-native-paper` installed
- [ ] `react-native-safe-area-context` installed (required peer dependency)
- [ ] `@react-native-vector-icons/material-design-icons` installed (bare RN) or using Expo icons
- [ ] `PaperProvider` wrapping app root
- [ ] `SafeAreaProvider` wrapping `PaperProvider`
- [ ] Custom theme extending `MD3LightTheme` / `MD3DarkTheme` (if needed)
- [ ] `react-native-paper/babel` added to production plugins in `babel.config.js`
- [ ] `adaptNavigationTheme` used if combining with React Navigation

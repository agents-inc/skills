# Design Tokens Reference

> Lookup tables, API shapes, and checklists. For red flags, anti-patterns, and gotchas see the `<red_flags>` section in [SKILL.md](SKILL.md).

---

## Tier Responsibilities

| Tier      | Holds          | References | Named by           | Reassigned by a scope?          |
| --------- | -------------- | ---------- | ------------------ | ------------------------------- |
| Primitive | Literal values | Nothing    | Position in a ramp | Never                           |
| Semantic  | Aliases only   | Primitives | Role / intent      | Yes -- this is the swap point   |
| Component | Aliases only   | Semantics  | Component + role   | Rarely; scoped to the component |

---

## Naming Grammar

`[namespace-]category-concept[-variant][-state][-scale]`

| Segment       | Required | Purpose                                | Examples                                        |
| ------------- | -------- | -------------------------------------- | ----------------------------------------------- |
| **namespace** | No       | Only when tokens ship outside the repo | `acme`                                          |
| **category**  | Yes      | Token family; sorts the whole set      | `color`, `space`, `radius`, `font`, `duration`  |
| **concept**   | Yes      | What it applies to                     | `surface`, `text`, `action`, `border`, `inline` |
| **variant**   | No       | Which version of the same thing        | `default`, `raised`, `muted`, `danger`          |
| **state**     | No       | How it is currently behaving           | `hover`, `pressed`, `disabled`, `focus`         |
| **scale**     | No       | Step within a series                   | `50`-`950`, `xs`-`2xl`                          |

**Rules:** category first, state always the last modifier, an absent segment means "default". Never include a mode (`dark`, `light`, `high-contrast`) or a literal (`blue`, `900`, `16px`).

### Scale Conventions

| Convention         | Use for         | Rationale                                          |
| ------------------ | --------------- | -------------------------------------------------- |
| Numeric `50`-`950` | Primitive ramps | The number is a real position in a series          |
| T-shirt `xs`-`2xl` | Semantic steps  | A number would imply arithmetic that does not hold |

Never mix the two inside one namespace.

---

## DTCG Format (2025.10)

### Reserved Properties

| Property       | Purpose                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| `$value`       | Required. The token's data. Its presence is what makes a token a token.  |
| `$type`        | Token category. Hoists from the closest ancestor group that declares it. |
| `$description` | Plain-text explanation of purpose                                        |
| `$extensions`  | Vendor metadata, keyed by reverse-domain notation                        |
| `$deprecated`  | Boolean, or a string explaining the replacement                          |
| `$extends`     | Group inheritance via deep merge                                         |
| `$ref`         | JSON Pointer reference for property-level access                         |

### `$type` Values

| Kind          | Types                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| **Atomic**    | `color`, `dimension`, `fontFamily`, `fontWeight`, `duration`, `cubicBezier`, `number` |
| **Composite** | `shadow`, `typography`, `border`, `transition`, `gradient`, `strokeStyle`             |

### Value Shapes

| Type          | `$value` shape                                                           |
| ------------- | ------------------------------------------------------------------------ |
| `color`       | `{ colorSpace, components[], alpha?, hex? }` -- **object, not a string** |
| `dimension`   | `{ value: number, unit: "px" \| "rem" }` -- **object, not a string**     |
| `fontWeight`  | Number 1-1000, or a keyword (`thin`, `bold`, `black`, ...)               |
| `cubicBezier` | `[P1x, P1y, P2x, P2y]`                                                   |
| `shadow`      | `{ color, offsetX, offsetY, blur, spread }`, or an array of those        |
| `typography`  | `{ fontFamily, fontSize, fontWeight, lineHeight }`                       |

`colorSpace` accepts `srgb`, `srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65`, `xyz-d50`. A component may be `"none"`. `alpha` defaults to `1`. `hex`, when present, must be 6-digit notation.

### References

| Syntax                     | Resolves to                 | Notes                                |
| -------------------------- | --------------------------- | ------------------------------------ |
| `{group.token}`            | A complete `$value`         | Cannot target a group or a sub-value |
| `#/group/token/$value/hex` | Any property (JSON Pointer) | Required for composite sub-values    |

### Structural Rules

- A node with `$value` is a token; a node without one is a group
- A group must never contain both `$value` and child tokens
- Names cannot start with `$`, or contain `{`, `}`, or `.`
- Circular references are prohibited and must be reported as errors
- `$root` is the reserved name for a group's own base value

---

## Style Dictionary Config Shape

```javascript
{
  source: string[],          // glob patterns for token files
  include: string[],         // base files that may be overridden by `source`
  tokens: object,            // inline alternative to `source`
  expand: boolean | object,  // expand composite tokens into their parts
  platforms: Record<string, Platform>,
  hooks: object,             // custom transforms, formats, filters, actions
  log: object,
}
```

| Platform key     | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `transformGroup` | A named bundle of transforms (`css`, `js`, `scss`, ...)  |
| `transforms`     | An explicit ordered list, as an alternative to the group |
| `buildPath`      | Output directory -- **must end with a trailing slash**   |
| `prefix`         | Prepended to every generated token name                  |
| `files`          | Output file definitions                                  |
| `preprocessors`  | Run before transforms                                    |
| `actions`        | Post-build side effects (asset copying, etc.)            |

| File key      | Purpose                                            |
| ------------- | -------------------------------------------------- |
| `destination` | Filename, appended to `buildPath`                  |
| `format`      | Built-in or custom format name                     |
| `filter`      | Restrict which tokens reach this file              |
| `options`     | `{ showFileHeader, fileHeader, outputReferences }` |

### Common Built-in Formats

| Format                        | Produces                        |
| ----------------------------- | ------------------------------- |
| `css/variables`               | `:root { --token: value; }`     |
| `scss/variables`              | `$token: value;`                |
| `javascript/es6`              | `export const Token = "value";` |
| `typescript/es6-declarations` | The matching `.d.ts`            |
| `json`                        | A flat or nested JSON dump      |

### Programmatic Build

```javascript
import StyleDictionary from "style-dictionary";

const dictionary = new StyleDictionary(config);
await dictionary.buildAllPlatforms();

// Layer a second config over the first
const extended = await dictionary.extend(overrides);
await extended.buildAllPlatforms();
```

### DTCG Utilities

| Utility             | Does                                                     |
| ------------------- | -------------------------------------------------------- |
| `convertToDTCG`     | Prefixes `value`/`type`/`description` with `$` in memory |
| `convertJSONToDTCG` | Same, for a JSON file or blob                            |
| `convertZIPToDTCG`  | Same, across a ZIP of token files                        |
| `typeDtcgDelegate`  | Pushes group-level `$type` down onto individual tokens   |

### v5 Notes

| Fact                 | Detail                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| Node requirement     | v22.0.0 minimum                                                        |
| Reference strictness | References must point at real tokens, not at non-token leaf nodes      |
| Reference syntax     | `{`, `}`, `.` fixed by the spec -- no longer configurable              |
| Format coexistence   | DTCG (`$value`) and original (`value`) cannot be combined per instance |

---

## `@property` Descriptors

| Descriptor      | Required                  | Notes                                                       |
| --------------- | ------------------------- | ----------------------------------------------------------- |
| `syntax`        | Yes                       | `"<color>"`, `"<length>"`, `"<percentage>"`, `"*"`, ...     |
| `inherits`      | Yes                       | Omitting it invalidates the whole rule                      |
| `initial-value` | Yes, unless `syntax: "*"` | Must be computationally independent -- `10px` yes, `3em` no |

Registration buys typed interpolation (an unregistered custom property cannot be transitioned), value type checking, a fallback to `initial-value` when a computed value is invalid, and explicit inheritance control. `CSS.registerProperty()` takes precedence over `@property` for the same name.

---

## Authoring Checklist

Before shipping a token set:

- [ ] Every primitive holds a literal and references nothing
- [ ] Every semantic token holds an alias, never a literal
- [ ] Every component token overrides something somewhere -- no pass-throughs
- [ ] No component selector reads a `--palette-*` token or a raw literal
- [ ] No token name contains a mode word or a colour/value word
- [ ] One scale convention per namespace
- [ ] State is the last modifier segment in every name
- [ ] Colour tokens hold complete colours, never channel triplets
- [ ] No consumer supplies a `var()` fallback
- [ ] Scales express a generator (base, ratio, or multiplier), not hand-listed steps
- [ ] Density is a multiplier applied at the primitive-to-semantic boundary
- [ ] If tokens exist in more than one language, every output is generated from one source
- [ ] `outputReferences: true` on any generated CSS platform
- [ ] `@property` registration on animated tokens and on tokens that must not inherit

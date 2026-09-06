# Design Tokens - Pipeline Examples

> Extended examples for DTCG-format source and a build pipeline producing CSS and typed TypeScript. See [core.md](core.md) for the tier and naming patterns the source tree encodes.

**Prerequisites**: Understand [Pattern 1: Token Tiers](core.md#pattern-1-token-tiers-and-the-one-way-graph) and [Pattern 2: Naming Grammar](core.md#pattern-2-naming-grammar) first -- the source tree's shape _is_ the tier structure.

---

## Pattern 5: DTCG Source and a Build Pipeline

A pipeline earns its keep at the second consumer: a second language, a second platform, or a package published outside the repository that owns it. Below that threshold, hand-written CSS custom properties are the correct amount of machinery.

### Good Example - DTCG Source, Tier by File

```json
// tokens/primitives.json - Tier 1. Literal values only.
{
  "palette": {
    "$type": "color",
    "slate": {
      "50": {
        "$value": {
          "colorSpace": "oklch",
          "components": [0.98, 0.003, 250],
          "hex": "#f8fafc"
        }
      },
      "700": {
        "$value": {
          "colorSpace": "oklch",
          "components": [0.42, 0.02, 250],
          "hex": "#334155"
        }
      },
      "900": {
        "$value": {
          "colorSpace": "oklch",
          "components": [0.21, 0.02, 250],
          "hex": "#0f172a"
        }
      }
    },
    "blue": {
      "600": {
        "$value": {
          "colorSpace": "oklch",
          "components": [0.55, 0.19, 258],
          "hex": "#2563eb"
        }
      }
    }
  },
  "size": {
    "$type": "dimension",
    "base": { "$value": { "value": 4, "unit": "px" } }
  }
}
```

**Colour and dimension values are objects, not strings, in the 2025.10 spec.** A `color` `$value` carries `colorSpace`, a `components` array, an optional `alpha` (defaulting to 1), and an optional `hex` fallback -- which, when present, must be 6-digit notation so it cannot conflict with `alpha`. A `dimension` `$value` is `{ value, unit }` with `unit` restricted to `"px"` or `"rem"`. Earlier drafts allowed the string forms `"#f8fafc"` and `"4px"`, and plenty of tooling still emits them, so a token file inherited from an older generator will need converting before it validates against the stable spec.

`colorSpace` accepts 14 values including `srgb`, `oklch`, `oklab`, `lab`, `hsl`, and `display-p3`. A component may be the string `"none"` where a channel does not apply.

```json
// tokens/semantic.json - Tier 2. Aliases only, never literals.
{
  "color": {
    "$type": "color",
    "surface": {
      "default": {
        "$value": "{palette.slate.50}",
        "$description": "Page background in the default mode"
      },
      "raised": { "$value": "{palette.slate.100}" }
    },
    "text": {
      "default": { "$value": "{palette.slate.900}" },
      "muted": { "$value": "{palette.slate.700}" }
    },
    "action": {
      "default": { "$value": "{palette.blue.600}" },
      "hover": { "$value": "{palette.blue.500}" }
    }
  }
}
```

**Why good:** `$type` is declared once per group and hoists to every descendant that does not override it, so adding a colour is one line instead of two. The tier boundary is a file boundary, which makes "does any semantic token hold a literal?" a mechanical check rather than a review judgement.

---

### Good Example - One Source, Many Platforms

```javascript
// tokens/build.js
import StyleDictionary from "style-dictionary";

const BUILD_ROOT = "build/";

const config = {
  source: ["tokens/**/*.json"],
  platforms: {
    css: {
      transformGroup: "css",
      buildPath: `${BUILD_ROOT}css/`, // trailing slash is required
      files: [
        {
          destination: "tokens.css",
          format: "css/variables",
          // Keeps var() aliasing in the output instead of flattening every
          // semantic token to the literal it resolves to.
          options: { outputReferences: true },
        },
      ],
    },
    ts: {
      transformGroup: "js",
      buildPath: `${BUILD_ROOT}ts/`,
      files: [
        { destination: "tokens.js", format: "javascript/es6" },
        { destination: "tokens.d.ts", format: "typescript/es6-declarations" },
      ],
    },
  },
};

const dictionary = new StyleDictionary(config);
await dictionary.buildAllPlatforms();
```

**Why good:** every output is derived from one source, so the CSS and the TypeScript cannot disagree. `outputReferences: true` is the setting that preserves the whole point of the tier system in the generated CSS -- without it the output is a flat list of literals and a palette change no longer propagates through aliases.

**Generated CSS with `outputReferences: true`:**

```css
:root {
  --palette-slate-50: #f8fafc;
  --color-surface-default: var(--palette-slate-50); /* alias preserved */
}
```

**Generated CSS with `outputReferences` omitted:**

```css
:root {
  --palette-slate-50: #f8fafc;
  --color-surface-default: #f8fafc; /* flattened - the tier is gone */
}
```

---

### Good Example - Typed TypeScript Export

```typescript
// src/tokens/index.ts
// Re-export the generated artifact behind a named export and a narrow type.
// Nothing here is hand-written - it all derives from tokens/**/*.json.
import {
  ColorSurfaceDefault,
  ColorTextDefault,
  ColorActionDefault,
} from "../../build/ts/tokens.js";

export const colorTokens = {
  surfaceDefault: ColorSurfaceDefault,
  textDefault: ColorTextDefault,
  actionDefault: ColorActionDefault,
} as const;

export type ColorTokenName = keyof typeof colorTokens;
```

**Why good:** the generated `tokens.d.ts` gives the values their types, the hand-written file adds only naming and shape, and `ColorTokenName` means a typo in a consumer is a compile error. Because every value still originates in the JSON source, there is no copy that can drift.

**When to use:** anywhere token values are needed in code rather than in a stylesheet -- canvas rendering, chart libraries, a native platform target. If tokens are only ever read from CSS, skip the TypeScript platform entirely.

---

### Bad Example - Parallel Hand-Maintained Copies

```typescript
// BAD: src/theme/colors.ts - typed by hand
export const colors = {
  surfaceDefault: "#f8fafc",
  textDefault: "#0f172a",
} as const;
```

```css
/* BAD: src/theme/colors.css - typed by hand, again */
:root {
  --color-surface-default: #f8fafc;
  --color-text-default: #0f172a;
}
```

**Why bad:** the two files encode the same decision with nothing linking them, so the first change made in one of them creates a mismatch that no type checker, linter, or test detects. The bug surfaces as a chart whose background does not match the panel behind it -- weeks after the edit, with no obvious cause.

---

### Bad Example - Mixed Token Formats

```json
// BAD: DTCG ($value) and the original format (value) in one source tree.
// They cannot be combined inside a single Style Dictionary instance.
{
  "color": {
    "surface": { "$value": "#f8fafc", "$type": "color" },
    "text": { "value": "#0f172a", "type": "color" }
  }
}
```

**Why bad:** the instance parses for one format, so tokens in the other are not recognised as tokens at all -- they read as plain groups. The failure looks like tokens that simply vanished from the output rather than like a format error, which makes a half-finished migration expensive to diagnose.

---

### Bad Example - References That Do Not Resolve

```json
{
  "palette": {
    "$type": "color",
    "blue": {
      "600": {
        "$value": { "colorSpace": "oklch", "components": [0.55, 0.19, 258] }
      }
    }
  },
  "color": {
    "$type": "color",
    // BAD: references the group, not a token. Groups have no $value.
    "action": { "$value": "{palette.blue}" },
    // BAD: cycle. Conforming tooling errors; hand-written CSS resolves to nothing.
    "primary": { "$value": "{color.brand}" },
    "brand": { "$value": "{color.primary}" }
  }
}
```

**Why bad:** the `{alias}` syntax always resolves to a complete `$value`, so pointing it at a group has nothing to resolve to. Reaching into part of a composite token requires JSON Pointer (`#/color/blue/$value`) rather than the curly-brace path. The cycle is rejected outright by any conforming implementation -- which is the good outcome, since the same cycle written directly in CSS just produces a dropped declaration at runtime.

---

### Good Example - Composite Tokens

```json
{
  "shadow": {
    "$type": "shadow",
    "raised": {
      "$value": {
        "color": "{palette.slate.900}",
        "offsetX": { "value": 0, "unit": "px" },
        "offsetY": { "value": 2, "unit": "px" },
        "blur": { "value": 4, "unit": "px" },
        "spread": { "value": 0, "unit": "px" }
      }
    }
  },
  "typography": {
    "$type": "typography",
    "body": {
      "$value": {
        "fontFamily": "{font.family.sans}",
        "fontSize": "{font.size.md}",
        "fontWeight": 400,
        "lineHeight": 1.5
      }
    }
  }
}
```

**Why good:** a composite token keeps the parts of one decision together, so "what does raised elevation look like?" has a single answer rather than four loosely-related tokens that can be updated inconsistently. Sub-values still alias primitives, so the one-way graph holds inside the composite.

**Gotcha:** the `{alias}` form cannot reach a sub-value of a composite -- `{shadow.raised.blur}` does not resolve. Property-level access needs JSON Pointer syntax, and platforms that need the parts separately are usually better served by expanding composites at build time than by referencing into them.

---

### Publishing Tokens Outside the Repository That Owns Them

Two rules follow from the source and the output being different things:

- **Add the namespace segment to every name** (`--acme-color-surface-raised`). A token set that lands in someone else's stylesheet is competing for names with theirs, and `--color-surface-raised` is exactly the name they would have chosen too.
- **Version the generated artifact, not the source.** Consumers pin the artifact, so the source tree stays free to be reorganised — split, merged, retiered — for as long as the generated names hold. Reorganising is then a non-event, while renaming a generated token is a breaking change whatever the source looked like.

**What that makes breaking:** a name change, a tier collapse that removes a token a consumer read, and a value change large enough to break someone's contrast ratios. Not: a file move, a group rename inside the source, or an added tier that leaves the output identical.

---

### Migrating an Older Token Tree

Version facts, the reserved-property list and the conversion utilities are in [reference.md](../reference.md). The one procedural rule: **convert the whole tree in one pass** — a partial conversion produces the mixed-format failure above, which presents as tokens that simply vanished rather than as a format error.

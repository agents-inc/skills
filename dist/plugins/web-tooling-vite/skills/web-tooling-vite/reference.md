# Vite Reference

> Settings tables, per-version notes and the migration checklist. See [SKILL.md](SKILL.md) for the decisions and red flags, and [examples/core.md](examples/core.md) for full configs.

---

## Dev vs production settings

| Setting                  | Development | Production                    | Notes                                               |
| ------------------------ | ----------- | ----------------------------- | --------------------------------------------------- |
| `sourcemap`              | `true`      | `'hidden'` or `false`         | `'hidden'` keeps maps for error reporting, unlinked |
| `minify`                 | `false`     | `true`                        | Oxc in Vite 8, esbuild in Vite 7                    |
| Chunk splitting          | not applied | vendor grouping               | `manualChunks` (Vite 7), `codeSplitting` (Vite 8)   |
| `modulePreload.polyfill` | `true`      | `true`                        | Drop only when every target supports it natively    |
| `target`                 | n/a         | `'baseline-widely-available'` | Default from Vite 7                                 |

## Build targets

| Target                        | Browser support                                    | Notes                              |
| ----------------------------- | -------------------------------------------------- | ---------------------------------- |
| `'baseline-widely-available'` | Chrome 107+, Edge 107+, Firefox 104+, Safari 16+   | Vite 7 default                     |
| (Vite 8 default)              | Chrome 111+, Edge 111+, Firefox 114+, Safari 16.4+ | Floor raised in Vite 8             |
| `'modules'`                   | removed                                            | Was the Vite 6 default             |
| `'esnext'`                    | latest only                                        | Minimal transpilation              |
| `['chrome111', 'safari16.4']` | explicit list                                      | For a contract that names versions |

---

## Per-version notes

**Vite 8**

- Bundles with Rolldown; CSS is minified by Lightning CSS and JS by Oxc
- Install size is roughly 15MB larger than Vite 7 (Lightning CSS plus Rolldown)
- `resolve.alias[].customResolver` is removed

**Vite 7**

- Requires Node 20.19+ or 22.12+
- The Sass legacy API and `splitVendorChunkPlugin` are both removed
- The default `build.target` changed from `'modules'` to `'baseline-widely-available'`

**Rolldown options, wherever it is the bundler**

- `advancedChunks` under rolldown-vite is the same feature as `codeSplitting` in Vite 8
- `codeSplitting.maxSize` is a target rather than a hard limit
- `includeDependenciesRecursively` defaults to true, so a group can pull in more than its `test` names

---

## Vite 8 migration checklist

1. Rename `build.rollupOptions` to `build.rolldownOptions`
2. Replace `manualChunks` with `codeSplitting.groups` — object form is removed, function form deprecated
3. Raise pinned browser targets (Chrome 107 to 111, Firefox 104 to 114, Safari 16.0 to 16.4)
4. Remove `build.commonjsOptions`, now a no-op
5. Remove `resolve.alias[].customResolver`
6. Consider `resolve.tsconfigPaths: true` in place of a hand-mirrored alias map
7. Move `esbuild` options to `oxc` — auto-converted, with unsupported options dropped rather than reported; property mangling and `supported` have no Oxc equivalent
8. Expect the larger install size

---

## See also

- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Vite migration guide](https://vite.dev/guide/migration)
- [Rolldown code splitting](https://rolldown.rs/reference/OutputOptions.codeSplitting)

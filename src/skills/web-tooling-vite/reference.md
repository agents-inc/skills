# Vite Reference

> Quick-lookup tables, migration checklist, and external links. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/core.md](examples/core.md) for full code examples.

---

## Quick Reference Tables

### Dev vs Production Settings

| Setting                  | Development | Production                    | Notes                                               |
| ------------------------ | ----------- | ----------------------------- | --------------------------------------------------- |
| `sourcemap`              | `true`      | `false`                       | Use `'hidden'` for production error tracking        |
| `minify`                 | `false`     | `true` (Oxc in Vite 8)        | Oxc minifier in Vite 8, esbuild in Vite 7           |
| Chunk splitting          | `undefined` | Vendor splitting              | `manualChunks` (Vite 7) or `codeSplitting` (Vite 8) |
| `modulePreload.polyfill` | `true`      | `true`                        | Disable for modern-only targets                     |
| `target`                 | N/A         | `'baseline-widely-available'` | Vite 7+ default                                     |

### Build Target Defaults

| Target                        | Browser Support                                    | Notes                                 |
| ----------------------------- | -------------------------------------------------- | ------------------------------------- |
| `'baseline-widely-available'` | Chrome 107+, Edge 107+, Firefox 104+, Safari 16+   | Vite 7 default                        |
| (Vite 8 default)              | Chrome 111+, Edge 111+, Firefox 114+, Safari 16.4+ | Updated in Vite 8                     |
| `'modules'`                   | **REMOVED**                                        | Was Vite 6 default; removed in Vite 7 |
| `'esnext'`                    | Latest browsers only                               | Minimal transpilation                 |
| `['chrome111', 'safari16.4']` | Custom browser list                                | Explicit control                      |

---

## Vite 8 Migration Checklist

1. **Rename `build.rollupOptions`** to `build.rolldownOptions`
2. **Replace `manualChunks`** with `codeSplitting.groups` (object-form removed, function-form deprecated)
3. **Update browser targets** if pinned (Chrome 107 to 111, Firefox 104 to 114, Safari 16.0 to 16.4)
4. **Remove `build.commonjsOptions`** (now a no-op)
5. **Remove `resolve.alias[].customResolver`** (removed)
6. **Consider `resolve.tsconfigPaths: true`** to replace manual alias configuration
7. **Migrate `esbuild` config to `oxc`** - auto-converted but not all options supported (no property mangling, no `supported` option)
8. **Note install size increase** - ~15MB larger (lightningcss + Rolldown)

---

## See Also

- [Vite 8 Announcement](https://vite.dev/blog/announcing-vite8)
- [Vite Migration Guide](https://vite.dev/guide/migration)
- [Rolldown Code Splitting](https://rolldown.rs/reference/OutputOptions.codeSplitting)

# ESLint & Prettier Reference

> Version reference and official documentation links. See [SKILL.md](SKILL.md) for decision frameworks and red flags.

---

## Version Reference

| Tool                    | Latest Stable | Key Feature                                        |
| ----------------------- | ------------- | -------------------------------------------------- |
| ESLint 9                | v9.39.4       | Flat config, defineConfig(), multithreaded linting |
| ESLint 10               | v10.0.3       | .eslintrc removed, file-based config lookup        |
| Prettier                | v3.8.1        | TS config files, experimental options              |
| typescript-eslint       | v8.57.0       | projectService (stable), shared configs            |
| eslint-config-prettier  | latest        | Disables conflicting ESLint formatting rules       |
| eslint-plugin-only-warn | latest        | Converts errors to warnings                        |

---

## Prettier Config File Precedence

Highest to lowest priority:

1. `"prettier"` key in `package.json`
2. `.prettierrc` (JSON/YAML)
3. `.prettierrc.json`, `.prettierrc.yaml`
4. `.prettierrc.js`, `prettier.config.js`
5. `.prettierrc.mjs`, `prettier.config.mjs`
6. `.prettierrc.cjs`, `prettier.config.cjs`
7. `.prettierrc.ts`, `prettier.config.ts` (v3.5+)
8. `.prettierrc.toml`

---

## Official Documentation

- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [ESLint Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [ESLint 10 Release](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)
- [ESLint defineConfig blog post](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/)
- [ESLint Multithreaded Linting](https://eslint.org/blog/2025/08/multithread-linting/)
- [typescript-eslint v8](https://typescript-eslint.io/blog/announcing-typescript-eslint-v8/)
- [typescript-eslint projectService](https://typescript-eslint.io/troubleshooting/typed-linting/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier)

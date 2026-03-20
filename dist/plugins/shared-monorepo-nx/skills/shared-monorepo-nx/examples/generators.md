# Nx - Generator Examples

> Complete examples for using built-in generators, creating custom generators, and generator schemas. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) - Workspace structure, nx.json config
- [tasks.md](tasks.md) - Task pipelines, caching, affected commands
- [ci.md](ci.md) - CI pipelines, Nx Cloud, release management

---

## Built-in Generator Examples

### Creating Libraries

```bash
# Create a buildable React library
npx nx g @nx/react:library shared-ui \
  --directory=libs/shared/ui \
  --bundler=vite \
  --unitTestRunner=vitest \
  --style=scss

# Create a publishable TypeScript library
npx nx g @nx/js:library utils \
  --directory=libs/shared/utils \
  --publishable \
  --importPath=@my-org/utils

# Create a feature library (non-buildable, internal only)
npx nx g @nx/react:library feature-auth \
  --directory=libs/feature/auth \
  --bundler=none
```

### Creating Applications

```bash
# Create a Next.js application
npx nx g @nx/next:application web \
  --directory=apps/web \
  --style=scss

# Create a Node API application
npx nx g @nx/node:application api \
  --directory=apps/api

# Create an Angular application
npx nx g @nx/angular:application admin \
  --directory=apps/admin \
  --style=scss
```

### Creating Components

```bash
# Create a React component in a library
npx nx g @nx/react:component button \
  --project=shared-ui \
  --directory=libs/shared/ui/src/lib/button \
  --style=scss

# Dry run to preview generated files
npx nx g @nx/react:component button \
  --project=shared-ui \
  --dry-run
```

### Generator Defaults in nx.json

```json
{
  "generators": {
    "@nx/react:library": {
      "bundler": "vite",
      "unitTestRunner": "vitest",
      "style": "scss"
    },
    "@nx/react:component": {
      "style": "scss"
    },
    "@nx/js:library": {
      "buildable": true,
      "publishable": false
    }
  }
}
```

**Why good:** Consistent defaults for all generated code, no need to pass flags every time, enforces organizational standards

---

## Custom Generator Example

### Generator Structure

```
tools/
└── my-plugin/
    └── src/
        └── generators/
            └── feature-lib/
                ├── generator.ts      # Generator entry point
                ├── generator.spec.ts # Tests
                ├── schema.json       # Input schema
                ├── schema.d.ts       # TypeScript types for schema
                └── files/            # Template files
                    └── src/
                        └── index.ts__tmpl__
```

### Setting Up a Local Plugin

```bash
# Add the plugin capability
npx nx add @nx/plugin

# Generate a local plugin
npx nx g @nx/plugin:plugin tools/my-plugin

# Generate a generator within the plugin
npx nx generate @nx/plugin:generator tools/my-plugin/src/generators/feature-lib
```

### Generator Implementation

```typescript
// tools/my-plugin/src/generators/feature-lib/generator.ts
import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
} from "@nx/devkit";

interface FeatureLibGeneratorSchema {
  name: string;
  directory: string;
}

function featureLibGenerator(tree: Tree, options: FeatureLibGeneratorSchema) {
  const normalizedNames = names(options.name);
  const projectRoot = joinPathFragments(
    "libs",
    options.directory,
    normalizedNames.fileName,
  );

  generateFiles(tree, joinPathFragments(__dirname, "files"), projectRoot, {
    ...normalizedNames,
    tmpl: "",
  });

  formatFiles(tree);
}

export { featureLibGenerator };
// Nx requires default export for generator entry points
export default featureLibGenerator;
```

### Generator Schema

```json
{
  "$schema": "https://json-schema.org/schema",
  "cli": "nx",
  "id": "feature-lib",
  "title": "Create Feature Library",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Library name",
      "$default": { "$source": "argv", "index": 0 },
      "x-prompt": "What is the name of the feature library?"
    },
    "directory": {
      "type": "string",
      "description": "Directory within libs/",
      "default": "feature",
      "x-priority": "important"
    }
  },
  "required": ["name"]
}
```

### Schema Properties Reference

| Property       | Purpose                                     | Example                             |
| -------------- | ------------------------------------------- | ----------------------------------- |
| `$default`     | Dynamic default from CLI args               | `{ "$source": "argv", "index": 0 }` |
| `x-prompt`     | Interactive prompt when option not provided | `"What name would you like?"`       |
| `x-priority`   | Field ordering in Nx Console                | `"important"` or `"internal"`       |
| `x-deprecated` | Mark option as deprecated                   | `"Use 'newOption' instead."`        |
| `x-dropdown`   | Populate dropdown from workspace data       | `"projects"`                        |

### Using the Custom Generator

```bash
# Run the generator
npx nx g @my-org/my-plugin:feature-lib auth --directory=feature

# Dry run to preview
npx nx g @my-org/my-plugin:feature-lib auth --directory=feature --dry-run
```

---

## Workspace Management Generators

```bash
# Move a project to a new location
npx nx g @nx/workspace:move --project=my-lib --destination=packages/shared/my-lib

# Remove a project
npx nx g @nx/workspace:remove my-lib
```

---

## Migration Generators

### Upgrading Nx Versions

```bash
# Check for available updates
npx nx migrate latest

# This generates:
# 1. Updated package.json with new versions
# 2. migrations.json with migration scripts

# Install updated dependencies
npm install

# Run the migrations
npx nx migrate --run-migrations

# Optionally create commits per migration
npx nx migrate --run-migrations --create-commits

# Clean up
rm migrations.json
```

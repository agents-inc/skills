# Core Patterns

> Related: [advanced.md](advanced.md) for custom prompts with @clack/core, streams, and i18n

---

## Pattern 1: Individual Prompts with Cancellation

Every prompt returns `value | symbol`. The symbol indicates the user pressed Ctrl+C. Always check before using the value.

### text

```typescript
import * as p from "@clack/prompts";

const name = await p.text({
  message: "What is your project name?",
  placeholder: "my-project",
  defaultValue: "my-app",
});

if (p.isCancel(name)) {
  p.cancel("Operation cancelled.");
  process.exit(0);
}

// TypeScript now knows name is string
p.log.info(`Project name: ${name}`);
```

### password

```typescript
import * as p from "@clack/prompts";

const token = await p.password({
  message: "Enter your API token",
  mask: "*",
});

if (p.isCancel(token)) {
  p.cancel("Operation cancelled.");
  process.exit(0);
}
```

### select

```typescript
import * as p from "@clack/prompts";

const framework = await p.select({
  message: "Pick a framework",
  options: [
    { value: "react", label: "React", hint: "Recommended" },
    { value: "vue", label: "Vue" },
    { value: "svelte", label: "Svelte" },
  ],
});

if (p.isCancel(framework)) {
  p.cancel("Operation cancelled.");
  process.exit(0);
}

// framework is typed as "react" | "vue" | "svelte"
```

### multiselect

```typescript
import * as p from "@clack/prompts";

const features = await p.multiselect({
  message: "Select features",
  options: [
    { value: "typescript", label: "TypeScript" },
    { value: "eslint", label: "ESLint" },
    { value: "prettier", label: "Prettier", hint: "Code formatting" },
  ],
  required: false, // Allow zero selections (default requires at least one)
});

if (p.isCancel(features)) {
  p.cancel("Operation cancelled.");
  process.exit(0);
}

// features is string[]
```

### confirm

```typescript
import * as p from "@clack/prompts";

const shouldContinue = await p.confirm({
  message: "Do you want to continue?",
});

if (p.isCancel(shouldContinue)) {
  p.cancel("Operation cancelled.");
  process.exit(0);
}

// shouldContinue is boolean
if (!shouldContinue) {
  p.outro("Goodbye!");
  process.exit(0);
}
```

### selectKey

```typescript
import * as p from "@clack/prompts";

const action = await p.selectKey({
  message: "What do you want to do?",
  options: [
    { value: "create", key: "c", label: "Create a new project" },
    { value: "clone", key: "l", label: "Clone existing project" },
    { value: "exit", key: "q", label: "Quit" },
  ],
});

if (p.isCancel(action)) {
  p.cancel("Operation cancelled.");
  process.exit(0);
}

// User pressed the key and action resolved immediately
```

### groupMultiselect

```typescript
import * as p from "@clack/prompts";

const plugins = await p.groupMultiselect({
  message: "Select plugins to install",
  options: {
    Linting: [
      { value: "eslint", label: "ESLint" },
      { value: "prettier", label: "Prettier" },
    ],
    Deployment: [
      { value: "docker", label: "Docker" },
      { value: "ci", label: "CI Pipeline" },
    ],
  },
});

if (p.isCancel(plugins)) {
  p.cancel("Operation cancelled.");
  process.exit(0);
}

// plugins is string[] (flat array of selected values across all groups)
```

---

## Pattern 2: Group Prompts

`group()` chains prompts and provides centralized cancellation. Each prompt function receives `{ results }` containing all values collected so far.

### Basic group

```typescript
import * as p from "@clack/prompts";

p.intro("Project setup");

const project = await p.group(
  {
    name: () =>
      p.text({
        message: "Project name?",
        placeholder: "my-project",
        validate: (value) => {
          if (!value) return "Name is required";
          if (!/^[a-z0-9-]+$/.test(value))
            return "Lowercase alphanumeric and hyphens only";
        },
      }),

    framework: ({ results }) =>
      p.select({
        message: `Framework for ${results.name}?`,
        options: [
          { value: "react", label: "React" },
          { value: "vue", label: "Vue" },
        ],
      }),

    features: () =>
      p.multiselect({
        message: "Additional features?",
        options: [
          { value: "typescript", label: "TypeScript" },
          { value: "eslint", label: "ESLint" },
        ],
        required: false,
      }),

    confirm: ({ results }) =>
      p.confirm({
        message: `Create ${results.name} with ${results.framework}?`,
      }),
  },
  {
    onCancel: () => {
      p.cancel("Setup cancelled.");
      process.exit(0);
    },
  },
);

// project is fully typed:
// { name: string; framework: "react" | "vue"; features: string[]; confirm: boolean }

if (!project.confirm) {
  p.outro("Aborted.");
  process.exit(0);
}

p.outro(`Created ${project.name}!`);
```

**Why good:** centralized onCancel, typed result object, each prompt accesses previous results, validation inline

---

## Pattern 3: Validation Patterns

### Text with validation

```typescript
import * as p from "@clack/prompts";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 214;
const NPM_NAME_PATTERN =
  /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const packageName = await p.text({
  message: "Package name?",
  validate: (value) => {
    if (!value || value.length < MIN_NAME_LENGTH) {
      return `Must be at least ${MIN_NAME_LENGTH} characters`;
    }
    if (value.length > MAX_NAME_LENGTH) {
      return `Must be at most ${MAX_NAME_LENGTH} characters`;
    }
    if (!NPM_NAME_PATTERN.test(value)) {
      return "Must be a valid npm package name";
    }
  },
});
```

### Password with validation

```typescript
import * as p from "@clack/prompts";

const MIN_PASSWORD_LENGTH = 8;

const secret = await p.password({
  message: "Enter password",
  validate: (value) => {
    if (!value || value.length < MIN_PASSWORD_LENGTH) {
      return `Must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (!/[A-Z]/.test(value)) return "Must contain an uppercase letter";
    if (!/[0-9]/.test(value)) return "Must contain a number";
  },
});
```

---

## Pattern 4: Spinner Lifecycle

### Basic spinner

```typescript
import * as p from "@clack/prompts";

const s = p.spinner();
s.start("Installing dependencies...");

try {
  await installDependencies();
  s.stop("Dependencies installed");
} catch {
  s.error("Failed to install dependencies");
  process.exit(1);
}
```

### Spinner with message updates

```typescript
import * as p from "@clack/prompts";

const s = p.spinner();
s.start("Setting up project...");

s.message("Copying template files...");
await copyTemplate();

s.message("Installing dependencies...");
await installDeps();

s.message("Configuring TypeScript...");
await configureTs();

s.stop("Project ready!");
```

### Spinner with timer indicator

```typescript
import * as p from "@clack/prompts";

const s = p.spinner({ indicator: "timer" });
s.start("Building project...");
await build();
s.stop("Build complete"); // Shows elapsed time
```

---

## Pattern 5: Progress Bar

```typescript
import * as p from "@clack/prompts";

const files = ["index.ts", "utils.ts", "config.ts", "main.ts"];

const prog = p.progress({ max: files.length, style: "heavy" });
prog.start("Processing files");

for (const file of files) {
  await processFile(file);
  prog.advance(1, `Processed ${file}`);
}

prog.stop("All files processed");
```

---

## Pattern 6: Tasks Runner

### Sequential tasks

```typescript
import * as p from "@clack/prompts";

await p.tasks([
  {
    title: "Cloning repository",
    task: async () => {
      await cloneRepo();
      return "Repository cloned";
    },
  },
  {
    title: "Installing dependencies",
    task: async (message) => {
      message("Resolving packages...");
      await resolvePkgs();
      message("Linking dependencies...");
      await linkDeps();
      return "Dependencies installed";
    },
  },
  {
    title: "Building project",
    task: async () => {
      await buildProject();
      return "Build complete";
    },
  },
]);
```

### taskLog for detailed output

```typescript
import * as p from "@clack/prompts";

const VISIBLE_LINES = 5;

const tl = p.taskLog({ title: "Deploying", limit: VISIBLE_LINES });

tl.message("Uploading files...");
tl.message("Configuring routes...");
tl.message("Running health check...");

const group = tl.group("Database migrations");
group.message("Migration 001: create users");
group.message("Migration 002: add indexes");
group.success("Migrations complete");

tl.success("Deployment complete");
```

---

## Pattern 7: Output Utilities

### Logging

```typescript
import * as p from "@clack/prompts";

p.log.info("Checking project configuration...");
p.log.success("All checks passed");
p.log.warn("Optional dependency missing: prettier");
p.log.error("Failed to read config file");
p.log.step("Step 1 of 3 complete");
p.log.message("Additional details here");
```

### note

```typescript
import * as p from "@clack/prompts";

p.note("cd my-project\nnpm run dev", "Next steps");
```

### box

```typescript
import * as p from "@clack/prompts";

p.box("Welcome to My CLI v2.0", "Announcement", {
  contentAlign: "center",
  rounded: true,
});
```

---

## Pattern 8: Complete CLI Flow

```typescript
import * as p from "@clack/prompts";

async function main(): Promise<void> {
  p.intro("create-my-app");

  const project = await p.group(
    {
      name: () =>
        p.text({
          message: "Project name?",
          placeholder: "my-app",
          validate: (value) => {
            if (!value) return "Required";
          },
        }),
      template: () =>
        p.select({
          message: "Select a template",
          options: [
            { value: "basic", label: "Basic", hint: "Minimal setup" },
            { value: "full", label: "Full", hint: "All features" },
          ],
        }),
      git: () => p.confirm({ message: "Initialize git?" }),
    },
    {
      onCancel: () => {
        p.cancel("Setup cancelled.");
        process.exit(0);
      },
    },
  );

  const s = p.spinner();

  s.start("Creating project...");
  await createProject(project.name, project.template);
  s.stop("Project created");

  if (project.git) {
    s.start("Initializing git...");
    await initGit(project.name);
    s.stop("Git initialized");
  }

  p.note(`cd ${project.name}\nnpm run dev`, "Next steps");
  p.outro("You're all set!");
}

main().catch(console.error);
```

**Why good:** complete flow with intro/outro session, group for related prompts, spinner for async work, note for follow-up instructions, single cancellation handler

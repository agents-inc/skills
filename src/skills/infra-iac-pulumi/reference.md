# Pulumi Quick Reference

Decision frameworks, resource options, API reference tables, and CLI commands.

---

## Decision Framework

### When to Use ComponentResource vs Plain Function?

```
Are you grouping 2+ related resources?
├─ YES → Do they need to appear as a single unit in state/UI?
│   ├─ YES → ComponentResource (shows as parent in `pulumi stack`)
│   └─ NO → Plain function returning resources is fine
└─ NO → Single resource? Just create it directly.
```

### When to Use Explicit Providers?

```
Are you deploying to multiple regions or accounts?
├─ YES → Always use explicit providers
│   └─ Set pulumi:disable-default-providers to enforce
└─ NO → Default provider is fine for single-region projects
```

### When to Use Stack References vs Passing Values?

```
Are the resources in different Pulumi projects?
├─ YES → Stack references (StackReference + getOutput/requireOutput)
└─ NO → Are they in different stacks of the same project?
    ├─ YES → Stack references
    └─ NO → Pass values directly (same stack)
```

### When to Use Dynamic Providers?

```
Does a native Pulumi provider exist for this service?
├─ YES → Use the native provider (better state tracking, preview)
└─ NO → Is the resource lifecycle CRUD-based?
    ├─ YES → Dynamic provider (pulumi.dynamic.Resource)
    └─ NO → Is it a one-shot action?
        ├─ YES → Use a Command resource or local script
        └─ NO → Consider the Automation API
```

### When to Use protect vs retainOnDelete?

```
Want to prevent accidental `pulumi destroy`?
├─ YES → protect: true (blocks deletion, must unprotect first)
└─ NO → Want to keep the cloud resource when removing from Pulumi?
    ├─ YES → retainOnDelete: true (Pulumi forgets it, cloud keeps it)
    └─ NO → Default behavior (Pulumi deletes cloud resource)
```

---

## Resource Options Reference

| Option                | Type                       | Purpose                                                      |
| --------------------- | -------------------------- | ------------------------------------------------------------ |
| `parent`              | `Resource`                 | Set parent (establishes resource tree, cascading delete)     |
| `provider`            | `ProviderResource`         | Explicit provider for this resource                          |
| `providers`           | `Record<string, Provider>` | Provider map for child resources (components only)           |
| `dependsOn`           | `Input<Resource[]>`        | Explicit ordering beyond automatic dependency inference      |
| `protect`             | `boolean`                  | Prevent accidental deletion (must unprotect first)           |
| `retainOnDelete`      | `boolean`                  | Keep cloud resource when removed from Pulumi state           |
| `deleteBeforeReplace` | `boolean`                  | Delete old before creating new (for unique name constraints) |
| `ignoreChanges`       | `string[]`                 | Ignore drift on specific properties                          |
| `aliases`             | `Input<Alias[]>`           | Old names/types/parents for safe renaming                    |
| `replaceOnChanges`    | `string[]`                 | Force replacement on specific property changes               |
| `import`              | `string`                   | Import existing cloud resource into Pulumi state             |
| `transforms`          | `ResourceTransform[]`      | Modify child resource properties/options dynamically         |
| `customTimeouts`      | `CustomTimeouts`           | Override default create/update/delete timeouts               |
| `hooks`               | `ResourceHooks`            | Lifecycle callbacks (before/after create, update, delete)    |

---

## Output Methods Reference

| Method                    | Input            | Output           | Use When                                              |
| ------------------------- | ---------------- | ---------------- | ----------------------------------------------------- |
| `pulumi.interpolate`      | Template literal | `Output<string>` | Building strings from Outputs (preferred)             |
| `.apply(fn)`              | `Output<T>`      | `Output<U>`      | Transforming a single Output value                    |
| `pulumi.all([...])`       | `Output<T>[]`    | `Output<T[]>`    | Combining multiple Outputs                            |
| `pulumi.output(val)`      | `T \| Output<T>` | `Output<T>`      | Wrapping a plain value as an Output                   |
| `pulumi.secret(val)`      | `T \| Output<T>` | `Output<T>`      | Marking a value as secret (encrypted in state)        |
| `.getOutput(name)`        | `StackReference` | `Output<any>`    | Reading a stack output (returns undefined if missing) |
| `.requireOutput(name)`    | `StackReference` | `Output<any>`    | Reading a stack output (throws if missing)            |
| `.getOutputDetails(name)` | `StackReference` | `OutputDetails`  | Reading a stack output as plain value                 |

---

## Config Methods Reference

| Method                       | Returns                       | Behavior When Missing |
| ---------------------------- | ----------------------------- | --------------------- |
| `config.get(key)`            | `string \| undefined`         | Returns undefined     |
| `config.require(key)`        | `string`                      | Throws error          |
| `config.getNumber(key)`      | `number \| undefined`         | Returns undefined     |
| `config.requireNumber(key)`  | `number`                      | Throws error          |
| `config.getBoolean(key)`     | `boolean \| undefined`        | Returns undefined     |
| `config.requireBoolean(key)` | `boolean`                     | Throws error          |
| `config.getSecret(key)`      | `Output<string> \| undefined` | Returns undefined     |
| `config.requireSecret(key)`  | `Output<string>`              | Throws error          |

---

## Common CLI Commands

```bash
# Stack lifecycle
pulumi new typescript          # Create new project
pulumi stack init dev          # Create new stack
pulumi stack select prod       # Switch stacks
pulumi config set key value    # Set config
pulumi config set --secret key value  # Set encrypted config

# Deployment
pulumi preview                 # Show planned changes
pulumi up                      # Deploy changes
pulumi up --yes                # Deploy without confirmation
pulumi destroy                 # Tear down all resources
pulumi refresh                 # Sync state with cloud provider

# Inspection
pulumi stack                   # Show current stack info
pulumi stack output            # Show stack outputs
pulumi stack output --json     # JSON format outputs
pulumi stack export            # Export state as JSON

# Resource management
pulumi state unprotect <urn>   # Remove protection
pulumi state delete <urn>      # Remove from state (does not delete cloud resource)
pulumi import <type> <name> <id>  # Import existing cloud resource

# Policy
pulumi preview --policy-pack ./policy  # Run with policy pack
pulumi policy publish ./policy         # Publish to Pulumi Cloud
```

---

> For anti-patterns and common mistakes, see the RED FLAGS section in [SKILL.md](SKILL.md).

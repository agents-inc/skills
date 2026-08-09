---
name: infra-iac-pulumi
description: TypeScript-native Infrastructure as Code with Pulumi
---

# Pulumi Infrastructure as Code

> **Quick Guide:** Define cloud infrastructure in TypeScript with full type safety. Use `ComponentResource` to encapsulate reusable infrastructure patterns. Pass `{ parent: this }` to all child resources inside components. Use `pulumi.interpolate` for string building with Outputs (not string concatenation). Never create resources inside `.apply()`. Use `Config.requireSecret()` for sensitive values. Prefer `transforms` over deprecated `transformations`. Always call `this.registerOutputs()` at the end of component constructors.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST pass `{ parent: this }` to ALL child resources inside a ComponentResource -- omitting it breaks the resource tree and state tracking)**

**(You MUST use `pulumi.interpolate` for string building with Outputs -- string concatenation silently produces `[object Object]`)**

**(You MUST NEVER create resources inside `.apply()` -- they will not appear in `pulumi preview` and cause ordering issues)**

**(You MUST use `Config.requireSecret()` for sensitive values -- `Config.require()` stores values as plaintext in state)**

**(You MUST call `this.registerOutputs()` at the end of every ComponentResource constructor -- omitting it prevents output tracking)**

</critical_requirements>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Resource definitions, component resources, naming, Outputs, config/secrets
- [examples/advanced.md](examples/advanced.md) - Stack references, transforms, dynamic providers, Automation API, policy packs
- [reference.md](reference.md) - Decision frameworks, resource options table, API reference, CLI commands

---

**Auto-detection:** Pulumi, @pulumi/pulumi, @pulumi/aws, @pulumi/gcp, @pulumi/azure, @pulumi/kubernetes, pulumi.ComponentResource, pulumi.CustomResource, pulumi.Output, pulumi.Config, pulumi.interpolate, pulumi.all, registerOutputs, StackReference, ComponentResourceOptions, CustomResourceOptions, dynamic.Resource, dynamic.ResourceProvider, LocalWorkspace, InlineProgramArgs, Automation API, CrossGuard, PolicyPack

**When to use:**

- Defining cloud infrastructure in TypeScript with type-safe resource APIs
- Creating reusable infrastructure components with `ComponentResource`
- Managing multi-stack architectures with stack references
- Handling secrets and environment-specific configuration
- Building self-service infrastructure platforms with the Automation API
- Writing compliance policies with CrossGuard policy packs

**When NOT to use:**

- One-off shell scripts that create a single resource (use the cloud CLI directly)
- Projects where the team has no TypeScript experience (consider other IaC language options)

**Key patterns covered:**

- Resource definitions with typed inputs and auto-naming
- ComponentResource encapsulation (parent, naming, registerOutputs)
- Outputs: `apply`, `all`, `interpolate`, and lifting
- Config and secrets management (`Config.require`, `Config.requireSecret`, `pulumi.secret`)
- Stack references for cross-stack data sharing
- Resource options (`dependsOn`, `protect`, `aliases`, `ignoreChanges`, `transforms`)
- Dynamic providers for custom CRUD resources
- Automation API for programmatic stack management
- CrossGuard policy packs for compliance enforcement

---

<philosophy>

## Philosophy

Pulumi treats infrastructure as real code, not configuration files. TypeScript gives you type safety, IDE autocompletion, refactoring tools, and the full Node.js ecosystem. Resources are objects, dependencies are automatic, and reuse happens through functions and classes -- not a custom module language.

**Core principles:**

- **Resources are objects**: Every cloud resource is a TypeScript class instance with typed inputs and outputs
- **Dependencies are automatic**: When you pass one resource's output as another's input, Pulumi infers the dependency graph
- **Reuse through components**: `ComponentResource` encapsulates multiple resources into a single logical unit with its own inputs and outputs
- **Outputs are promises**: `Output<T>` represents a value that may not be known until after deployment -- use `apply`, `all`, or `interpolate` to work with them, never unwrap manually
- **State is managed**: Pulumi tracks every resource in state -- changing a logical name or moving a resource between files triggers a delete-and-recreate unless you use `aliases`

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Resource Definitions

Every resource takes a logical name (used for state tracking), an args bag (typed inputs), and optional resource options.

```typescript
const bucket = new aws.s3.Bucket(
  "data-bucket",
  {
    versioning: { enabled: true },
    lifecycleRules: [
      { enabled: true, expiration: { days: BUCKET_EXPIRY_DAYS } },
    ],
  },
  { protect: true },
); // Prevent accidental deletion
```

**Key points:** Logical names must be unique per type within a stack. Pulumi auto-appends a random suffix to the physical name to prevent collisions. Use `protect: true` on critical resources. Export outputs for cross-stack consumption.

See [examples/core.md](examples/core.md) for resource naming, auto-naming configuration, and provider options.

---

### Pattern 2: ComponentResource Encapsulation

Wrap related resources in a `ComponentResource` to create reusable infrastructure units.

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface StaticSiteArgs {
  indexDocument?: string;
  errorDocument?: string;
}

class StaticSite extends pulumi.ComponentResource {
  public readonly bucketName: pulumi.Output<string>;
  public readonly websiteUrl: pulumi.Output<string>;

  constructor(
    name: string,
    args: StaticSiteArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("myinfra:web:StaticSite", name, args, opts);

    const bucket = new aws.s3.BucketV2(`${name}-bucket`, {}, { parent: this });

    const website = new aws.s3.BucketWebsiteConfigurationV2(
      `${name}-website`,
      {
        bucket: bucket.id,
        indexDocument: { suffix: args.indexDocument ?? "index.html" },
        errorDocument: { key: args.errorDocument ?? "error.html" },
      },
      { parent: this },
    );

    this.bucketName = bucket.id;
    this.websiteUrl = website.websiteEndpoint;
    this.registerOutputs({
      bucketName: this.bucketName,
      websiteUrl: this.websiteUrl,
    });
  }
}
```

**Why good:** child resources use `{ parent: this }`, name is prefixed from parent, `registerOutputs` is called, type token follows `pkg:module:Type` format

See [examples/core.md](examples/core.md) for complete component patterns with provider inheritance and multi-resource components.

---

### Pattern 3: Working with Outputs

Outputs represent values resolved after deployment. Never use string concatenation -- use `interpolate`, `apply`, or `all`.

```typescript
// interpolate -- tagged template for string building (preferred)
const url = pulumi.interpolate`https://${bucket.bucketRegionalDomainName}/index.html`;

// apply -- transform a single output
const upper = bucket.id.apply((id) => id.toUpperCase());

// all -- combine multiple outputs
const endpoint = pulumi
  .all([lb.dnsName, listener.port])
  .apply(([dns, port]) => `http://${dns}:${port}`);

// Lifting -- access properties directly on resource outputs
const subnetId = vpc.subnets[0].id; // No apply needed for known properties
```

**Why good:** `interpolate` handles Output values transparently, `all` waits for multiple values, lifting avoids unnecessary `apply` calls

**Gotcha:** Resources created inside `.apply()` will not appear in `pulumi preview` and may cause ordering issues. Always pass Outputs directly as inputs to other resources.

See [examples/core.md](examples/core.md) for Output patterns, `pulumi.output()` wrapping, and the apply anti-pattern.

---

### Pattern 4: Config and Secrets

Use `pulumi.Config` for stack-specific values. Use `requireSecret` for sensitive data -- it encrypts the value in state.

```typescript
const config = new pulumi.Config();

// Plain config values
const region = config.require("region"); // Fails if missing
const nodeCount = config.getNumber("nodeCount"); // Returns undefined if missing

// Secret values -- encrypted in state
const dbPassword = config.requireSecret("dbPassword");
const apiKey = config.getSecret("apiKey");

// Mark programmatic values as secret
const connectionString = pulumi.interpolate`postgres://admin:${dbPassword}@${db.endpoint}/mydb`;
// connectionString is automatically secret because dbPassword is secret

// Explicitly mark a value as secret
const token = pulumi.secret(generateToken());
```

**Key point:** Any Output derived from a secret is automatically marked secret. You do not need to re-mark derived values.

See [examples/core.md](examples/core.md) for namespaced config, secret outputs, and config set CLI commands.

---

### Pattern 5: Resource Options

Resource options control lifecycle behavior. The most important ones:

```typescript
const db = new aws.rds.Instance(
  "primary-db",
  {
    /* ... */
  },
  {
    protect: true, // Prevent accidental deletion
    dependsOn: [vpc, securityGroup], // Explicit ordering
    ignoreChanges: ["tags"], // Ignore drift on specific props
    aliases: [{ name: "old-db-name" }], // Rename without recreating
    retainOnDelete: true, // Keep cloud resource on pulumi destroy
    deleteBeforeReplace: true, // For resources that must be unique
    replaceOnChanges: ["engine"], // Force replace on specific changes
    provider: usEastProvider, // Explicit provider (region, account)
  },
);
```

**Gotcha:** Changing a resource's logical name or parent causes Pulumi to delete and recreate it. Use `aliases` to rename safely.

See [reference.md](reference.md) for the complete resource options table.

---

### Pattern 6: Stack References

Share outputs between stacks using `StackReference`.

```typescript
// In the networking stack: export outputs
export const vpcId = vpc.id;
export const subnetIds = subnets.map((s) => s.id);

// In the application stack: consume outputs
const networkStack = new pulumi.StackReference("myorg/networking/prod");
const vpcId = networkStack.getOutput("vpcId");
const subnetIds = networkStack.getOutput("subnetIds");

// requireOutput fails if the output doesn't exist (safer than getOutput)
const vpcIdRequired = networkStack.requireOutput("vpcId");
```

See [examples/advanced.md](examples/advanced.md) for stack reference patterns and `getOutputDetails`.

---

### Pattern 7: Transforms

Apply transformations to resources and their children. Use `transforms` (not the deprecated `transformations`). Transforms receive an args object with `type`, `props`, and `opts`, and return a modified result or `undefined` to skip.

```typescript
// Resource-level: apply tags to all taggable children of a component
const vpc = new MyVpcComponent(
  "vpc",
  {},
  {
    transforms: [
      (args) => {
        if (isTaggable(args.type)) {
          return {
            props: {
              ...args.props,
              tags: { ...args.props["tags"], ManagedBy: "pulumi" },
            },
            opts: args.opts,
          };
        }
        return undefined;
      },
    ],
  },
);
```

**Key difference from deprecated `transformations`:** `transforms` support modifying packaged component children (awsx, eks), support async callbacks, and do not pass a Resource object.

See [examples/advanced.md](examples/advanced.md) for stack-level transforms, option modification, and migration from `transformations`.

---

### Pattern 8: Automation API

Run Pulumi programmatically without the CLI -- for self-service platforms, integration tests, or custom deployment tooling.

```typescript
const stack = await LocalWorkspace.createOrSelectStack({
  stackName: "dev",
  projectName: "my-platform",
  program: async () => {
    const bucket = new aws.s3.Bucket("auto-bucket");
    return { bucketName: bucket.id };
  },
});
const upResult = await stack.up({ onOutput: console.log });
```

**Key point:** The Automation API requires the Pulumi CLI to be installed and on PATH -- it uses the CLI's engine under the hood.

See [examples/advanced.md](examples/advanced.md) for preview, destroy, local program mode, config setup, and stack output retrieval.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority:**

- **Creating resources inside `.apply()`** -- They won't appear in `pulumi preview`, cause ordering issues, and break the dependency graph. Pass Outputs directly as resource inputs.
- **Missing `{ parent: this }` in ComponentResource children** -- Resources appear at the root of the state tree, breaking logical grouping and component delete cascading.
- **String concatenation with Outputs** -- `"https://" + bucket.id` produces `[object Object]`. Use `pulumi.interpolate` instead.
- **Using `Config.require()` for passwords/keys** -- Stores the value as plaintext in state. Use `Config.requireSecret()` to encrypt.
- **Forgetting `this.registerOutputs()`** -- Component outputs won't be tracked properly in state or available via stack references.
- **Changing logical names without aliases** -- Pulumi deletes and recreates the resource. Use `aliases: [{ name: "old-name" }]` to rename safely.

**Medium Priority:**

- **Relying on default providers in multi-region setups** -- Use explicit providers per region. Set `pulumi:disable-default-providers` in config to enforce.
- **Starting with functions instead of ComponentResource** -- Migrating later requires aliases or resource recreation. Use components from the start.
- **Not using `dependsOn` for non-obvious dependencies** -- Pulumi infers dependencies from Input/Output wiring, but side effects (IAM propagation, DNS) need explicit ordering.
- **Using deprecated `transformations`** -- Use `transforms` instead. `transforms` also support modifying child resources of packaged components.
- **Hardcoding region/account in resource args** -- Use `pulumi.Config` and providers for environment-specific values.

**Gotchas & Edge Cases:**

- Auto-naming appends a random suffix -- never rely on exact physical resource names in external systems
- Pulumi does not refresh state by default -- use `pulumi refresh` to detect drift
- `pulumi.secret()` wraps a value so it's encrypted in state -- any derived Output is automatically secret too
- `Output.apply()` runs during `pulumi up`, not during `preview` for unknown values -- conditional logic based on unknown outputs may not evaluate during preview
- Component type tokens must follow `pkg:module:Type` format (e.g., `myinfra:network:Vpc`) to avoid conflicts
- Dynamic providers serialize the provider class -- closures over external state, functions, or DOM nodes will fail
- `protect: true` only prevents `pulumi destroy` deletion, not manual cloud console deletion
- Stack names in `StackReference` are fully qualified: `org/project/stack`

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST pass `{ parent: this }` to ALL child resources inside a ComponentResource -- omitting it breaks the resource tree and state tracking)**

**(You MUST use `pulumi.interpolate` for string building with Outputs -- string concatenation silently produces `[object Object]`)**

**(You MUST NEVER create resources inside `.apply()` -- they will not appear in `pulumi preview` and cause ordering issues)**

**(You MUST use `Config.requireSecret()` for sensitive values -- `Config.require()` stores values as plaintext in state)**

**(You MUST call `this.registerOutputs()` at the end of every ComponentResource constructor -- omitting it prevents output tracking)**

**Failure to follow these rules will cause broken state tracking, silent data exposure, and unpredictable deployment behavior.**

</critical_reminders>

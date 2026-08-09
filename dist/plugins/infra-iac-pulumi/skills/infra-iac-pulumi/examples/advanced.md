# Pulumi - Advanced Examples

> Stack references, transforms, dynamic providers, Automation API, and policy packs. See [SKILL.md](../SKILL.md) for decision guidance and [core.md](core.md) for fundamental patterns.

---

## Pattern 1: Stack References

### Exporting Outputs (Source Stack)

```typescript
// networking/index.ts
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const vpc = new aws.ec2.Vpc("main", { cidrBlock: "10.0.0.0/16" });

const publicSubnets = [
  new aws.ec2.Subnet("public-1", {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/24",
    availabilityZone: "us-east-1a",
  }),
  new aws.ec2.Subnet("public-2", {
    vpcId: vpc.id,
    cidrBlock: "10.0.2.0/24",
    availabilityZone: "us-east-1b",
  }),
];

// Export values for other stacks to consume
export const vpcId = vpc.id;
export const publicSubnetIds = publicSubnets.map((s) => s.id);
```

### Consuming Outputs (Consumer Stack)

```typescript
// application/index.ts
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const org = config.require("org");
const stack = pulumi.getStack();

// Reference the networking stack
const networkStack = new pulumi.StackReference(`${org}/networking/${stack}`);

// getOutput returns Output<any> -- value is undefined if output doesn't exist
const vpcId = networkStack.getOutput("vpcId");
const subnetIds = networkStack.getOutput("publicSubnetIds");

// requireOutput throws if output doesn't exist (safer for critical dependencies)
const vpcIdRequired = networkStack.requireOutput("vpcId");

// Use in resource definitions
const cluster = new aws.ecs.Cluster("app", {});
const service = new aws.ecs.Service("web", {
  cluster: cluster.arn,
  networkConfiguration: {
    subnets: subnetIds,
    assignPublicIp: true,
  },
  desiredCount: 2,
});
```

**Key point:** Stack reference names are fully qualified: `org/project/stack`. Use config for the org name to avoid hardcoding.

### getOutputDetails (Typed Access)

```typescript
// Returns plain value instead of Output -- no apply needed
const details = await networkStack.getOutputDetails("vpcId");
if (details.value) {
  console.log(`VPC: ${details.value}`); // Plain string, not Output
}
if (details.secretValue) {
  console.log("This output is a secret");
}
```

---

## Pattern 2: Transforms

### Resource-Level Transform (Tag All Children)

```typescript
import * as pulumi from "@pulumi/pulumi";

const MANAGED_BY_TAG = "pulumi";

// Apply tags to all taggable child resources
const vpc = new MyVpcComponent(
  "production",
  {},
  {
    transforms: [
      (args) => {
        if (isTaggable(args.type)) {
          return {
            props: {
              ...args.props,
              tags: { ...args.props["tags"], ManagedBy: MANAGED_BY_TAG },
            },
            opts: args.opts,
          };
        }
        return undefined; // Return undefined to leave unmodified
      },
    ],
  },
);

function isTaggable(type: string): boolean {
  // AWS resources generally support tags
  return type.startsWith("aws:");
}
```

### Stack-Level Transform (Global Policy)

```typescript
// Apply to ALL resources in the stack
pulumi.runtime.registerResourceTransform((args) => {
  if (isTaggable(args.type)) {
    return {
      props: {
        ...args.props,
        tags: {
          ...args.props["tags"],
          Environment: pulumi.getStack(),
          Project: pulumi.getProject(),
        },
      },
      opts: args.opts,
    };
  }
  return undefined;
});
```

### Modify Resource Options via Transform

```typescript
// Ignore tag drift on all resources in a component
const vpc = new MyVpcComponent(
  "vpc",
  {},
  {
    transforms: [
      (args) => {
        if (
          args.type === "aws:ec2/vpc:Vpc" ||
          args.type === "aws:ec2/subnet:Subnet"
        ) {
          return {
            props: args.props,
            opts: pulumi.mergeOptions(args.opts, { ignoreChanges: ["tags"] }),
          };
        }
        return undefined;
      },
    ],
  },
);
```

**Migration note:** `transforms` replaces the deprecated `transformations`. Key differences: `transforms` support modifying packaged component children (awsx, eks), support async callbacks, and do not pass a Resource object (use `args.type` instead).

---

## Pattern 3: Dynamic Providers

Create custom resources with CRUD lifecycle for APIs not covered by native providers.

### Provider with Full CRUD

```typescript
import * as pulumi from "@pulumi/pulumi";

interface WebhookInputs {
  url: string;
  events: string[];
  secret: string;
}

interface WebhookOutputs extends WebhookInputs {
  webhookId: string;
  createdAt: string;
}

class WebhookProvider implements pulumi.dynamic.ResourceProvider {
  async create(inputs: WebhookInputs): Promise<pulumi.dynamic.CreateResult> {
    // Call external API to create webhook
    const response = await fetch("https://api.example.com/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inputs),
    });
    const data = await response.json();

    return {
      id: data.id,
      outs: { ...inputs, webhookId: data.id, createdAt: data.created_at },
    };
  }

  async read(
    id: string,
    props: WebhookOutputs,
  ): Promise<pulumi.dynamic.ReadResult> {
    const response = await fetch(`https://api.example.com/webhooks/${id}`);
    if (!response.ok) {
      // Return empty to signal resource was deleted externally
      return { id: "", outs: {} };
    }
    const data = await response.json();
    return { id, outs: { ...props, ...data } };
  }

  async update(
    id: string,
    olds: WebhookOutputs,
    news: WebhookInputs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    await fetch(`https://api.example.com/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(news),
    });
    return { outs: { ...news, webhookId: id, createdAt: olds.createdAt } };
  }

  async delete(id: string): Promise<void> {
    await fetch(`https://api.example.com/webhooks/${id}`, { method: "DELETE" });
  }
}

// Resource class wrapping the provider
export interface WebhookResourceInputs {
  url: pulumi.Input<string>;
  events: pulumi.Input<pulumi.Input<string>[]>;
  secret: pulumi.Input<string>;
}

export class Webhook extends pulumi.dynamic.Resource {
  declare readonly webhookId: pulumi.Output<string>;
  declare readonly createdAt: pulumi.Output<string>;

  constructor(
    name: string,
    args: WebhookResourceInputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(
      new WebhookProvider(),
      name,
      { webhookId: undefined, createdAt: undefined, ...args },
      opts,
    );
  }
}

// Usage
const hook = new Webhook("deploy-hook", {
  url: "https://myapp.com/webhooks/deploy",
  events: ["push", "release"],
  secret: config.requireSecret("webhookSecret"),
});

export const hookId = hook.webhookId;
```

**Key points:**

- Output properties use `declare readonly` (not `public readonly`)
- Pass `{ outputName: undefined, ...args }` to super to register output properties
- Provider methods receive unwrapped plain values (not `Output<T>`)
- The provider class is serialized -- avoid closures over external state

---

## Pattern 4: Automation API

### Inline Program (Self-Contained)

```typescript
import { InlineProgramArgs, LocalWorkspace } from "@pulumi/pulumi/automation";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const STACK_NAME = "dev";
const PROJECT_NAME = "self-service-infra";

// Define infrastructure as a function
const program = async () => {
  const bucket = new aws.s3.Bucket("managed-bucket", {
    versioning: { enabled: true },
  });
  return { bucketName: bucket.id, bucketArn: bucket.arn };
};

async function deploy() {
  const args: InlineProgramArgs = {
    stackName: STACK_NAME,
    projectName: PROJECT_NAME,
    program,
  };

  // Create or select the stack
  const stack = await LocalWorkspace.createOrSelectStack(args);

  // Set config
  await stack.setConfig("aws:region", { value: "us-east-1" });

  // Preview changes
  const previewResult = await stack.preview({ onOutput: console.log });
  console.log(`Preview: ${previewResult.changeSummary}`);

  // Deploy
  const upResult = await stack.up({ onOutput: console.log });
  console.log(`Bucket: ${upResult.outputs.bucketName.value}`);
  console.log(`Secret? ${upResult.outputs.bucketName.secret}`);

  // Get outputs
  const outputs = await stack.outputs();
  console.log(`Bucket ARN: ${outputs.bucketArn.value}`);
}
```

### Local Program (Existing Pulumi Project)

```typescript
import { LocalWorkspace } from "@pulumi/pulumi/automation";

async function deployExisting() {
  const stack = await LocalWorkspace.createOrSelectStack({
    stackName: "dev",
    workDir: "/path/to/existing/pulumi/project",
  });

  // Refresh state from cloud provider
  await stack.refresh({ onOutput: console.log });

  // Deploy
  const result = await stack.up({ onOutput: console.log });
  return result.outputs;
}
```

### Destroy Stack

```typescript
async function teardown() {
  const stack = await LocalWorkspace.selectStack({
    stackName: "dev",
    projectName: "self-service-infra",
    program: async () => ({}),
  });

  await stack.destroy({ onOutput: console.log });
  await stack.workspace.removeStack("dev");
}
```

**Key point:** The Automation API requires the Pulumi CLI to be installed and on PATH, even though you're not calling it directly. The API uses the CLI's engine under the hood.

---

## Pattern 5: Policy Packs (CrossGuard)

### Resource Validation Policy

```typescript
import * as policy from "@pulumi/policy";

const REQUIRED_TAGS = ["Environment", "Team", "ManagedBy"];

new policy.PolicyPack("compliance", {
  policies: [
    {
      name: "required-tags",
      description: "All resources must have required tags",
      enforcementLevel: "mandatory",
      validateResource: policy.validateResourceOfType(
        // Use the provider's resource type
        "aws.s3.Bucket",
        (bucket, args, reportViolation) => {
          const tags = bucket.tags ?? {};
          for (const tag of REQUIRED_TAGS) {
            if (!(tag in tags)) {
              reportViolation(`Missing required tag: ${tag}`);
            }
          }
        },
      ),
    },
    {
      name: "no-public-buckets",
      description: "S3 buckets must not have public access",
      enforcementLevel: "mandatory",
      validateResource: policy.validateResourceOfType(
        "aws.s3.Bucket",
        (bucket, args, reportViolation) => {
          if (
            bucket.acl === "public-read" ||
            bucket.acl === "public-read-write"
          ) {
            reportViolation("S3 buckets must not have public ACLs");
          }
        },
      ),
    },
  ],
});
```

### Stack Validation Policy

```typescript
new policy.PolicyPack("stack-policies", {
  policies: [
    {
      name: "no-unencrypted-secrets",
      description: "Stack must not have plaintext secrets in config",
      enforcementLevel: "mandatory",
      validateStack: (args, reportViolation) => {
        for (const resource of args.resources) {
          // Check for resources that should use encryption
          if (resource.type === "aws:rds/instance:Instance") {
            const props = resource.props as Record<string, unknown>;
            if (!props.storageEncrypted) {
              reportViolation(
                `RDS instance ${resource.name} must have storage encryption enabled`,
              );
            }
          }
        }
      },
    },
  ],
});
```

**Running policies:**

```bash
# Run policy pack against a stack
pulumi preview --policy-pack ./policy

# Publish to Pulumi Cloud for organization-wide enforcement
pulumi policy publish ./policy
```

**Enforcement levels:** `advisory` (warning only) or `mandatory` (blocks deployment). Use `advisory` during rollout, then switch to `mandatory`.

---

## Pattern 6: Aliases (Safe Refactoring)

### Rename a Resource

```typescript
// Before: resource was named "my-bucket"
// After: rename to "data-bucket" without destroying and recreating
const bucket = new aws.s3.Bucket(
  "data-bucket",
  {
    /* ... */
  },
  {
    aliases: [{ name: "my-bucket" }],
  },
);
```

### Move Resource Into a Component

```typescript
// Resource was at the root, now moving into a component
class StorageComponent extends pulumi.ComponentResource {
  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super("myinfra:storage:StorageComponent", name, {}, opts);

    // Alias tells Pulumi this was previously at root (no parent)
    const bucket = new aws.s3.Bucket(
      "data-bucket",
      {},
      {
        parent: this,
        aliases: [{ parent: pulumi.rootStackResource }],
      },
    );

    this.registerOutputs({});
  }
}
```

### Rename a Component Type

```typescript
// Changed the component type token from "pkg:old:Name" to "pkg:new:Name"
class MyComponent extends pulumi.ComponentResource {
  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super(
      "myinfra:v2:MyComponent",
      name,
      {},
      {
        ...opts,
        aliases: [{ type: "myinfra:v1:MyComponent" }],
      },
    );

    this.registerOutputs({});
  }
}
```

**Key point:** Always add aliases when renaming resources, changing parent relationships, or changing type tokens. Without aliases, Pulumi deletes the old resource and creates a new one.

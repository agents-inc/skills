# Pulumi - Core Examples

> Resource definitions, component resources, naming, Outputs, and config/secrets. See [SKILL.md](../SKILL.md) for decision guidance and [reference.md](../reference.md) for resource options table.

**Additional Examples:**

- [advanced.md](advanced.md) - Stack references, transforms, dynamic providers, Automation API

---

## Pattern 1: Resource Definitions

### Basic Resource with Options

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const BUCKET_EXPIRY_DAYS = 90;

// Good: explicit logical name, typed args, resource options
const bucket = new aws.s3.Bucket(
  "data-bucket",
  {
    versioning: { enabled: true },
    lifecycleRules: [
      {
        enabled: true,
        expiration: { days: BUCKET_EXPIRY_DAYS },
      },
    ],
  },
  { protect: true },
);

export const bucketName = bucket.id;
export const bucketArn = bucket.arn;
```

**Why good:** named constant for expiry, `protect: true` prevents accidental deletion, outputs exported for cross-stack use

```typescript
// Bad: magic numbers, no protection on production resources
const bucket = new aws.s3.Bucket("data-bucket", {
  lifecycleRules: [{ enabled: true, expiration: { days: 90 } }],
});
```

**Why bad:** magic number `90` is undocumented, no `protect` on a data resource, no exports for other stacks

---

### Auto-Naming and Physical Names

```typescript
// Pulumi auto-appends a random suffix: "data-bucket" -> "data-bucket-a1b2c3d"
// This prevents collisions and enables zero-downtime replacement.

// Override auto-naming only when you must (shared external references):
const bucket = new aws.s3.Bucket(
  "shared-assets",
  {
    bucket: `${pulumi.getProject()}-${pulumi.getStack()}-assets`, // Explicit physical name
  },
  { deleteBeforeReplace: true },
); // Required when naming explicitly (uniqueness constraint)
```

**Gotcha:** Explicit physical names make your project susceptible to naming collisions across stacks. Prefer auto-naming unless an external system needs a predictable name.

### Auto-Naming Configuration (Pulumi.yaml)

```yaml
# Default: random suffix
config:
  pulumi:autonaming:
    mode: default

# Verbatim: use logical name as-is
config:
  pulumi:autonaming:
    mode: verbatim

# Custom pattern
config:
  pulumi:autonaming:
    pattern: ${name}-${stack}-${hex(4)}
```

---

### Explicit Provider (Multi-Region / Multi-Account)

```typescript
const usEast = new aws.Provider("us-east", { region: "us-east-1" });
const euWest = new aws.Provider("eu-west", { region: "eu-west-1" });

const usTable = new aws.dynamodb.Table(
  "us-users",
  {
    /* ... */
  },
  { provider: usEast },
);
const euTable = new aws.dynamodb.Table(
  "eu-users",
  {
    /* ... */
  },
  { provider: euWest },
);
```

**Key point:** Relying on the default provider causes gotchas in multi-region setups. Enforce explicit providers:

```yaml
# Pulumi.yaml -- disable default providers
config:
  pulumi:disable-default-providers:
    - aws
```

---

## Pattern 2: ComponentResource Encapsulation

### Full Component Example

```typescript
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface DatabaseArgs {
  engine: pulumi.Input<string>;
  instanceClass: pulumi.Input<string>;
  allocatedStorage: pulumi.Input<number>;
  masterPassword: pulumi.Input<string>; // Will be secret if passed from config.requireSecret
}

export class Database extends pulumi.ComponentResource {
  public readonly endpoint: pulumi.Output<string>;
  public readonly port: pulumi.Output<number>;

  constructor(
    name: string,
    args: DatabaseArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    // Type token format: "pkg:module:Type"
    super("myinfra:data:Database", name, args, opts);

    const subnetGroup = new aws.rds.SubnetGroup(
      `${name}-subnets`,
      {
        subnetIds: [
          /* ... */
        ],
      },
      { parent: this },
    ); // Always pass parent

    const securityGroup = new aws.ec2.SecurityGroup(
      `${name}-sg`,
      {
        vpcId: "vpc-xxx",
        ingress: [
          {
            protocol: "tcp",
            fromPort: 5432,
            toPort: 5432,
            cidrBlocks: ["10.0.0.0/8"],
          },
        ],
      },
      { parent: this },
    );

    const db = new aws.rds.Instance(
      `${name}-instance`,
      {
        engine: args.engine,
        instanceClass: args.instanceClass,
        allocatedStorage: args.allocatedStorage,
        password: args.masterPassword,
        dbSubnetGroupName: subnetGroup.name,
        vpcSecurityGroupIds: [securityGroup.id],
        skipFinalSnapshot: false,
      },
      { parent: this, protect: true },
    ); // Protect the actual database

    this.endpoint = db.endpoint;
    this.port = db.port;
    this.registerOutputs({ endpoint: this.endpoint, port: this.port });
  }
}

// Usage
const config = new pulumi.Config();
const db = new Database("primary", {
  engine: "postgres",
  instanceClass: "db.t3.micro",
  allocatedStorage: 20,
  masterPassword: config.requireSecret("dbPassword"),
});

export const dbEndpoint = db.endpoint;
```

**Why good:** `{ parent: this }` on all children, `protect: true` on the critical resource, `registerOutputs` at the end, type token follows convention, name prefixed to children, args typed with `pulumi.Input<T>` for flexibility

---

### Bad: Missing Parent, Missing registerOutputs

```typescript
// Bad: this is how NOT to write a component
class Database extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: DatabaseArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("myinfra:data:Database", name, args, opts);

    // Missing { parent: this } -- resources appear at root of state tree
    const sg = new aws.ec2.SecurityGroup(`${name}-sg`, {
      /* ... */
    });
    const db = new aws.rds.Instance(`${name}-db`, {
      /* ... */
    });

    // Missing registerOutputs -- outputs not tracked in state
  }
}
```

**Why bad:** without `parent`, child resources are detached from the component in the state tree (deleting the component won't cascade). Without `registerOutputs`, stack references and the Pulumi engine can't track component-level outputs.

---

## Pattern 3: Working with Outputs

### pulumi.interpolate (Preferred for Strings)

```typescript
// Good: interpolate handles Output<string> transparently
const connectionString = pulumi.interpolate`postgres://admin:${password}@${db.endpoint}:${db.port}/mydb`;

// Good: interpolate works in resource args
const record = new aws.route53.Record(
  "api-dns",
  {
    name: pulumi.interpolate`api.${zone.name}`,
    type: "CNAME",
    records: [lb.dnsName],
    ttl: 300,
  },
  { parent: this },
);
```

```typescript
// Bad: string concatenation with Outputs
const url = "https://" + bucket.id; // Produces "https://[object Object]"
```

**Why bad:** `Output<string>` is not a string -- concatenation calls `.toString()` which returns `[object Object]`

---

### pulumi.all (Combine Multiple Outputs)

```typescript
const HTTP_PORT = 80;

const endpoint = pulumi
  .all([lb.dnsName, listener.port])
  .apply(([dns, port]) => `http://${dns}:${port}`);

// Also works for building complex objects from multiple outputs
const dbConfig = pulumi
  .all([db.endpoint, db.port, db.dbName])
  .apply(([host, port, name]) => ({
    host,
    port,
    database: name,
    connectionString: `postgres://${host}:${port}/${name}`,
  }));
```

---

### apply (Transform a Single Output)

```typescript
// Good: transform an output value
const bucketUrl = bucket.websiteEndpoint.apply(
  (endpoint) => `https://${endpoint}`,
);

// Good: conditional logic on an output
const displayName = instance.tags.apply((tags) => tags?.["Name"] ?? "unnamed");
```

```typescript
// Bad: creating resources inside apply
bucket.id.apply((id) => {
  // This resource won't appear in pulumi preview!
  new aws.s3.BucketPolicy("policy", { bucket: id /* ... */ });
});
```

**Why bad:** resources inside `apply` are invisible to `pulumi preview` and cause ordering issues. Pass the Output directly as an input instead:

```typescript
// Good: pass Output directly as input
new aws.s3.BucketPolicy("policy", {
  bucket: bucket.id, // Output<string> accepted as Input<string>
  policy: bucket.arn.apply((arn) =>
    JSON.stringify({
      Statement: [
        { Effect: "Allow", Action: ["s3:GetObject"], Resource: `${arn}/*` },
      ],
    }),
  ),
});
```

---

### pulumi.output (Wrap Plain Values)

```typescript
// Convert a plain value to an Output (useful in functions that accept Input<T>)
function buildUrl(host: pulumi.Input<string>): pulumi.Output<string> {
  return pulumi.output(host).apply((h) => `https://${h}`);
}

// Works with both plain strings and Output<string>
const fromPlain = buildUrl("example.com");
const fromOutput = buildUrl(instance.publicDns);
```

---

## Pattern 4: Config and Secrets

### Basic Config Access

```typescript
const config = new pulumi.Config();

// Required values -- fail if missing
const region = config.require("region");
const nodeCount = config.requireNumber("nodeCount");
const enableLogs = config.requireBoolean("enableLogs");

// Optional values -- return undefined if missing
const customDomain = config.get("customDomain");
const maxRetries = config.getNumber("maxRetries");

// Secret values -- encrypted in state
const dbPassword = config.requireSecret("dbPassword");
const apiKey = config.getSecret("apiKey");
```

### Setting Config from CLI

```bash
# Plain values
pulumi config set region us-east-1
pulumi config set nodeCount 3

# Secret values -- encrypted at rest
pulumi config set --secret dbPassword hunter2
pulumi config set --secret apiKey sk_live_abc123

# Namespaced config (for providers or custom namespaces)
pulumi config set aws:region us-east-1
pulumi config set myapp:featureFlag true
```

### Namespaced Config

```typescript
// Read provider-specific config
const awsConfig = new pulumi.Config("aws");
const region = awsConfig.require("region");

// Custom namespace for your app
const appConfig = new pulumi.Config("myapp");
const featureFlag = appConfig.getBoolean("featureFlag") ?? false;
```

### Programmatic Secrets

```typescript
// Mark a computed value as secret
const token = pulumi.secret(generateToken());

// Any output derived from a secret is automatically secret
const connectionString = pulumi.interpolate`postgres://admin:${dbPassword}@${db.endpoint}/mydb`;
// connectionString is automatically secret because dbPassword is secret -- no need to re-mark

// Explicitly wrap an output as secret
const sensitiveOutput = pulumi.secret(pulumi.interpolate`key-${someValue}`);
```

**Gotcha:** `pulumi.secret()` only encrypts the value in Pulumi state. If you export it as a stack output, consumers see `[secret]` unless they use `--show-secrets`.

# Terraform Quick Reference

Decision frameworks, CLI cheat sheet, file naming conventions, and version constraint syntax.

---

## Decision Frameworks

### Environment Management: Directories vs Workspaces

```
Are environments structurally different (different resources, providers, or versions)?
├─ YES → Directory-based separation (environments/prod/, environments/staging/)
│   - Each environment is self-contained and explicit
│   - Different Terraform/provider versions per environment
│   - Easier CI/CD isolation and access control
└─ NO → Are environments identical except for variable values?
    ├─ YES → Workspaces with .tfvars per environment
    │   - terraform workspace select prod + terraform apply -var-file=prod.tfvars
    │   - Single codebase, multiple state files
    │   - Risk: easy to apply to wrong workspace
    └─ NO → Hybrid: directories for permanent envs, workspaces for ephemeral
```

### State Organization: Monolith vs Layered

```
How many resources in a single state file?
├─ < 50 → Single state file is fine
├─ 50-200 → Consider splitting by layer (network, compute, data)
└─ > 200 → Must split by layer
    - network/    (VPC, subnets, route tables)
    - compute/    (instances, ASGs, load balancers)
    - data/       (databases, caches, queues)
    - monitoring/ (alarms, dashboards)
    Benefits: smaller blast radius, faster plans, independent deploys
```

### Module: Local vs Registry

```
Is this module used in multiple repositories?
├─ YES → Publish to registry (private or public)
│   - Semantic versioning for controlled upgrades
│   - source = "registry.example.com/org/module/provider"
└─ NO → Is it used in multiple root modules within this repo?
    ├─ YES → Local module in modules/ directory
    │   - source = "./modules/vpc"
    └─ NO → Inline resources (no module needed)
```

### for_each vs count vs neither

```
Creating multiple instances of a resource?
├─ NO → No meta-argument needed
├─ YES → Are instances identical except for count?
│   ├─ YES → count is acceptable (e.g., count = var.enable ? 1 : 0)
│   └─ NO → Do instances have unique identifiers?
│       ├─ YES → for_each with map (keyed by identifier)
│       └─ NO → for_each with toset() (keyed by value)
```

### When to use lifecycle meta-arguments

```
Is this a critical resource (database, DNS zone, state bucket)?
├─ YES → prevent_destroy = true
└─ NO → Does replacement cause downtime?
    ├─ YES → create_before_destroy = true
    └─ NO → Are external processes modifying attributes?
        ├─ YES → ignore_changes = [specific_attributes]
        └─ NO → No lifecycle block needed
```

---

## File Naming Conventions (Official Style Guide)

| File           | Purpose                                                     |
| -------------- | ----------------------------------------------------------- |
| `terraform.tf` | `terraform` block: `required_version`, `required_providers` |
| `backend.tf`   | Backend configuration                                       |
| `providers.tf` | Provider blocks and configuration                           |
| `main.tf`      | Resource and data source definitions                        |
| `variables.tf` | Input variable declarations (alphabetical)                  |
| `outputs.tf`   | Output declarations (alphabetical)                          |
| `locals.tf`    | Local value definitions                                     |
| `data.tf`      | Data source blocks (if too many for `main.tf`)              |
| `versions.tf`  | Alternative name for `terraform.tf` (common)                |

**For larger codebases:** Split `main.tf` by logical group: `network.tf`, `compute.tf`, `storage.tf`, `iam.tf`.

---

## HCL Style Rules

- **Indentation:** 2 spaces per nesting level
- **Alignment:** Align `=` signs for consecutive single-line arguments at the same level
- **Naming:** `snake_case` for resources, variables, outputs, locals, modules
- **Comments:** Use `#` (not `//` or `/* */`)
- **Blank lines:** One between top-level blocks, one between arguments and nested blocks
- **Meta-argument order:** `count`/`for_each` first, resource args next, nested blocks after, `lifecycle`/`depends_on` last
- **Format:** Run `terraform fmt -recursive` before every commit
- **Validate:** Run `terraform validate` to catch syntax and type errors

---

## Version Constraint Syntax

| Constraint      | Meaning                                   | Example              |
| --------------- | ----------------------------------------- | -------------------- |
| `= 1.0.0`       | Exact version                             | Only 1.0.0           |
| `>= 1.0.0`      | Minimum version (no upper bound -- risky) | 1.0.0 and above      |
| `~> 1.0`        | Pessimistic: allows 1.x, blocks 2.0       | 1.0 through 1.99     |
| `~> 1.0.0`      | Pessimistic: allows 1.0.x, blocks 1.1.0   | 1.0.0 through 1.0.99 |
| `>= 1.0, < 2.0` | Explicit range                            | 1.0 through 1.99     |

**Best practice:** Use `~> MAJOR.MINOR` for providers (allows patch updates, blocks breaking changes). Use `>= MAJOR.MINOR.0, < NEXT_MAJOR.0.0` for explicit ranges.

---

## CLI Cheat Sheet

### Core Workflow

```bash
terraform init              # Download providers, initialize backend
terraform init -upgrade     # Upgrade providers within constraints
terraform init -backend-config=prod.hcl  # Partial backend config
terraform validate          # Check syntax and types (no state access)
terraform fmt -recursive    # Format all .tf files
terraform plan              # Preview changes (always review before apply)
terraform plan -out=tfplan  # Save plan for exact apply
terraform apply tfplan      # Apply saved plan (no re-planning)
terraform apply             # Plan + apply interactively
terraform destroy           # Destroy all managed resources (caution!)
```

### State Management

```bash
terraform state list                    # List all resources in state
terraform state show aws_instance.web   # Show resource details
terraform state pull                    # Download state (read-only inspection)
# Prefer moved/import/removed blocks over CLI state commands for auditable changes
```

### Import (Legacy CLI -- prefer import blocks)

```bash
terraform import aws_s3_bucket.logs my-existing-bucket
# Better: use import block in .tf file (reviewable, repeatable)
```

### Workspace Commands

```bash
terraform workspace list      # List workspaces
terraform workspace new dev   # Create workspace
terraform workspace select prod  # Switch workspace
terraform workspace show      # Show current workspace
```

---

## .gitignore for Terraform Projects

```gitignore
# Local .terraform directories
**/.terraform/*

# .tfstate files (state should be remote, never committed)
*.tfstate
*.tfstate.*

# Crash log files
crash.log
crash.*.log

# Plan files (may contain secrets)
*.tfplan
out.plan

# Override files (local-only overrides)
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# CLI configuration (user-specific)
.terraformrc
terraform.rc

# DO commit .terraform.lock.hcl (provider version pinning)
# !.terraform.lock.hcl  -- ensure this is NOT gitignored
```

---

## Common Terraform Functions

| Function                     | Purpose                             | Example                                              |
| ---------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `lookup(map, key, default)`  | Safe map lookup with fallback       | `lookup(var.amis, var.region, "ami-default")`        |
| `try(expr, fallback)`        | First expression that doesn't error | `try(var.config.name, "default")`                    |
| `coalesce(vals...)`          | First non-null, non-empty value     | `coalesce(var.custom_name, local.generated_name)`    |
| `merge(maps...)`             | Merge maps (last wins on conflict)  | `merge(local.default_tags, var.extra_tags)`          |
| `flatten(list_of_lists)`     | Flatten nested lists one level      | `flatten([var.public_subnets, var.private_subnets])` |
| `toset(list)`                | Convert list to set (deduplicates)  | `for_each = toset(var.team_members)`                 |
| `cidrsubnet(prefix, new, n)` | Calculate subnet CIDR               | `cidrsubnet("10.0.0.0/16", 8, 0)` = `10.0.0.0/24`    |
| `templatefile(path, vars)`   | Render template file                | `templatefile("user-data.sh.tpl", { env = "prod" })` |
| `jsonencode(value)`          | Convert to JSON string              | `jsonencode(local.policy_document)`                  |
| `format(fmt, vals...)`       | Printf-style formatting             | `format("web-%s-%02d", var.env, count.index)`        |

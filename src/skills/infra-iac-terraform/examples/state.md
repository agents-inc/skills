# Terraform - State Management Examples

> Remote backends, state locking, moved/import/removed blocks, and workspace patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for state organization decision frameworks.

**Additional Examples:**

- [core.md](core.md) - Resource definitions, variables, outputs, locals, data sources
- [modules.md](modules.md) - Module structure, composition, versioning
- [patterns.md](patterns.md) - for_each, dynamic blocks, lifecycle, conditions

---

## Pattern 1: Remote Backend with State Locking

### S3 Backend (AWS)

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "myorg-terraform-state"
    key            = "production/network/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}
```

**Why good:** S3 provides durable storage with versioning for rollback. DynamoDB table provides state locking -- prevents two people from running `terraform apply` simultaneously and corrupting state. `encrypt = true` encrypts state at rest.

### GCS Backend (Google Cloud)

```hcl
terraform {
  backend "gcs" {
    bucket = "myorg-terraform-state"
    prefix = "production/network"
  }
}
```

**Note:** GCS has built-in state locking -- no separate lock table needed.

### Azure Backend

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "myorgterraformstate"
    container_name       = "tfstate"
    key                  = "production/network/terraform.tfstate"
  }
}
```

---

## Pattern 2: Partial Backend Configuration

Backend blocks cannot use variables. Use partial configuration to keep environment-specific values out of code.

### Backend with Placeholders

```hcl
# backend.tf -- shared across environments
terraform {
  backend "s3" {
    # key is the only value that differs per environment
    # bucket, region, dynamodb_table passed via -backend-config
  }
}
```

### Config Files per Environment

```hcl
# config/production.hcl
bucket         = "myorg-terraform-state"
key            = "production/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "terraform-state-locks"
```

```hcl
# config/staging.hcl
bucket         = "myorg-terraform-state"
key            = "staging/terraform.tfstate"
region         = "us-east-1"
encrypt        = true
dynamodb_table = "terraform-state-locks"
```

### Usage

```bash
# Initialize with environment-specific backend config
terraform init -backend-config=config/production.hcl
terraform init -backend-config=config/staging.hcl
```

**Why good:** Backend configuration is separated from Terraform code. Same `.tf` files work for all environments. No secrets in version-controlled files.

---

## Pattern 3: State Organization by Layer

Split state by infrastructure layer to minimize blast radius and speed up plans.

```
infrastructure/
  network/              # VPC, subnets, route tables, NAT gateways
    backend.tf          # key = "prod/network/terraform.tfstate"
    main.tf
    outputs.tf          # Exports VPC ID, subnet IDs for other layers
  compute/              # Instances, ASGs, load balancers
    backend.tf          # key = "prod/compute/terraform.tfstate"
    main.tf
    data.tf             # Reads network outputs via terraform_remote_state
  data/                 # RDS, ElastiCache, S3 buckets
    backend.tf          # key = "prod/data/terraform.tfstate"
    main.tf
```

### Cross-Layer References with terraform_remote_state

```hcl
# compute/data.tf -- reads network layer's outputs
data "terraform_remote_state" "network" {
  backend = "s3"

  config = {
    bucket = "myorg-terraform-state"
    key    = "production/network/terraform.tfstate"
    region = "us-east-1"
  }
}

# compute/main.tf -- uses network outputs
resource "aws_instance" "app" {
  subnet_id = data.terraform_remote_state.network.outputs.private_subnet_ids[0]
  # ...
}
```

**Why good:** Changing a compute instance doesn't risk breaking the network layer. Each layer has a faster plan (fewer resources). Teams can work on different layers independently.

**Gotcha:** `terraform_remote_state` creates a hard coupling to the backend configuration of the source layer. If the source layer's state key changes, all consumers must be updated.

---

## Pattern 4: Moved Blocks for Refactoring

Use `moved` blocks to rename resources or extract them into modules without destroying infrastructure.

### Rename a Resource

```hcl
# Before: resource was named "web_server"
# After: renamed to "app_server"
moved {
  from = aws_instance.web_server
  to   = aws_instance.app_server
}

resource "aws_instance" "app_server" {
  # ... same configuration ...
}
```

### Move Resource into a Module

```hcl
# Before: resource was at root level
# After: moved into module "compute"
moved {
  from = aws_instance.app
  to   = module.compute.aws_instance.app
}

module "compute" {
  source = "./modules/compute"
  # ...
}
```

### Migrate from count to for_each

```hcl
# Before: count-based
# resource "aws_iam_user" "team" {
#   count = 3
#   name  = var.team_members[count.index]
# }

# After: for_each-based
moved {
  from = aws_iam_user.team[0]
  to   = aws_iam_user.team["alice"]
}

moved {
  from = aws_iam_user.team[1]
  to   = aws_iam_user.team["bob"]
}

moved {
  from = aws_iam_user.team[2]
  to   = aws_iam_user.team["carol"]
}

resource "aws_iam_user" "team" {
  for_each = toset(["alice", "bob", "carol"])
  name     = each.value
}
```

**Key rules:**

- Always run `terraform plan` after adding moved blocks -- verify "will be moved" messages
- Remove moved blocks after the migration is applied (they are one-time operations)
- Moved blocks are processed during plan/apply, not retroactively

---

## Pattern 5: Import Blocks for Adopting Existing Resources

Bring pre-existing infrastructure under Terraform management.

```hcl
# Import an existing S3 bucket
import {
  to = aws_s3_bucket.existing_logs
  id = "my-company-logs-bucket"
}

resource "aws_s3_bucket" "existing_logs" {
  bucket = "my-company-logs-bucket"

  tags = {
    Name      = "logs"
    ManagedBy = "terraform"
  }
}
```

**Workflow:**

1. Add the `import` block and matching `resource` block
2. Run `terraform plan` -- Terraform shows what it will import and any config drift
3. Adjust the resource block until the plan shows no changes after import
4. Run `terraform apply` to execute the import
5. Remove the `import` block (one-time operation)

**Gotcha:** You must write the resource block to match the existing resource's configuration, or Terraform will try to modify it on the next apply.

---

## Pattern 6: Removed Blocks

Remove a resource from Terraform management without destroying the actual infrastructure.

```hcl
# Stop managing this resource -- it was moved to another tool
removed {
  from = aws_instance.legacy_app

  lifecycle {
    destroy = false  # Keep the resource, just forget about it
  }
}
```

**When to use:** Migrating resources to another Terraform configuration, handing off management to another tool, or cleaning up state without destroying infrastructure.

---

## Pattern 7: Workspaces for Ephemeral Environments

Workspaces share the same `.tf` files but maintain separate state files. Best for environments that are structurally identical.

```hcl
# Use workspace name for environment-specific values
locals {
  environment = terraform.workspace

  instance_type = {
    dev        = "t3.micro"
    staging    = "t3.small"
    production = "t3.large"
  }
}

resource "aws_instance" "app" {
  instance_type = local.instance_type[local.environment]

  tags = {
    Environment = local.environment
  }
}
```

```bash
# Create and switch workspaces
terraform workspace new staging
terraform workspace select staging
terraform plan -var-file=staging.tfvars
terraform apply -var-file=staging.tfvars
```

**When to use:** Environments that differ only in variable values (instance size, count, domain). **When not to use:** Environments with different resources, providers, or Terraform versions -- use directory-based separation instead.

**Risk:** It's easy to forget which workspace is active. Always verify with `terraform workspace show` before applying.

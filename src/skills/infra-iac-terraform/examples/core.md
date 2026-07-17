# Terraform - Core Examples

> Resource definitions, variables, outputs, locals, data sources, and provider configuration. See [SKILL.md](../SKILL.md) for pattern summaries and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [modules.md](modules.md) - Module structure, composition, versioning
- [state.md](state.md) - Remote backends, state locking, moved/import/removed blocks
- [patterns.md](patterns.md) - for_each, dynamic blocks, lifecycle, conditions

---

## Pattern 1: Provider Configuration

### Basic Provider with Default Tags

```hcl
# providers.tf
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
```

**Why good:** `default_tags` ensures every AWS resource gets baseline tags for cost allocation and compliance without repeating tags on every resource block.

### Provider Aliases for Multi-Region

```hcl
# providers.tf
provider "aws" {
  region = "us-east-1"
  alias  = "us_east"
}

provider "aws" {
  region = "eu-west-1"
  alias  = "eu_west"
}

# main.tf -- reference alias explicitly
resource "aws_s3_bucket" "us_logs" {
  provider = aws.us_east
  bucket   = "${var.project_name}-logs-us"
}

resource "aws_s3_bucket" "eu_logs" {
  provider = aws.eu_west
  bucket   = "${var.project_name}-logs-eu"
}
```

**Why good:** Aliases enable multi-region deployments from a single configuration. Resources without an explicit `provider` use the default (non-aliased) provider.

---

## Pattern 2: Resource Argument Ordering

Follow the official style guide ordering: meta-arguments first, resource arguments, nested blocks, lifecycle last.

### Good Example

```hcl
resource "aws_instance" "app" {
  for_each = var.app_instances  # 1. Meta-arguments first

  ami           = data.aws_ami.ubuntu.id  # 2. Resource arguments
  instance_type = each.value.instance_type
  subnet_id     = each.value.subnet_id

  tags = merge(
    { Name = "app-${each.key}" },
    var.extra_tags,
  )

  root_block_device {  # 3. Nested blocks
    volume_size = each.value.volume_size_gb
    encrypted   = true
  }

  lifecycle {  # 4. Lifecycle last
    create_before_destroy = true
  }
}
```

**Why good:** Consistent ordering makes resources scannable; meta-arguments at top tell you how many instances exist; lifecycle at bottom is where you look for special behavior.

### Bad Example

```hcl
resource "aws_instance" "app" {
  lifecycle {  # BAD: lifecycle buried at top
    create_before_destroy = true
  }

  tags = { Name = "app" }  # BAD: tags before core config

  ami           = "ami-12345678"  # BAD: hardcoded AMI
  for_each      = var.instances   # BAD: meta-argument after other args
  instance_type = "t3.micro"     # BAD: hardcoded instance type
}
```

**Why bad:** Inconsistent ordering forces readers to scan the entire block to understand meta-arguments and lifecycle; hardcoded values prevent reuse across environments.

---

## Pattern 3: Variables with Types and Validation

### Simple Variables

```hcl
# variables.tf
variable "environment" {
  type        = string
  description = "Deployment environment"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "instance_count" {
  type        = number
  description = "Number of application instances"
  default     = 2

  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 10
    error_message = "Instance count must be between 1 and 10."
  }
}
```

### Complex Variable Types

```hcl
variable "ingress_rules" {
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  description = "List of ingress rules for the security group"
  default     = []
}

variable "app_instances" {
  type = map(object({
    instance_type  = string
    subnet_id      = string
    volume_size_gb = number
  }))
  description = "Map of application instance configurations keyed by name"
}
```

**Why good:** Structured types enforce shape at plan time. Map keys become stable `for_each` keys. Descriptions make modules self-documenting.

### Sensitive Variables

```hcl
variable "database_password" {
  type        = string
  description = "Database master password"
  sensitive   = true  # Redacted from plan/apply output

  validation {
    condition     = length(var.database_password) >= 16
    error_message = "Database password must be at least 16 characters."
  }
}
```

**Gotcha:** `sensitive = true` only redacts from CLI output. The value is still stored in plain text in state. For true secret protection, use state encryption (OpenTofu) or a secrets manager data source.

---

## Pattern 4: Outputs

```hcl
# outputs.tf
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "ID of the VPC"
}

output "private_subnet_ids" {
  value       = [for s in aws_subnet.private : s.id]
  description = "List of private subnet IDs"
}

output "database_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "Database connection endpoint"
  sensitive   = true  # Contains host:port, may be sensitive
}
```

**Key rules:** Every output needs a `description`. Use `sensitive = true` for outputs containing connection strings, IPs, or credentials. Outputs are the module's public API -- treat them as a contract.

---

## Pattern 5: Locals for Derived Values

Use locals to name complex expressions and avoid repetition. Keep them deterministic -- they should not change between runs.

### Good Example

```hcl
locals {
  # Derived from variables -- deterministic
  name_prefix = "${var.project_name}-${var.environment}"

  # Common tags merged from variable + computed values
  common_tags = merge(
    var.extra_tags,
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
  )

  # Conditional logic named for clarity
  is_production = var.environment == "production"

  # Pre-computed map for for_each
  subnet_config = {
    for idx, cidr in var.private_subnet_cidrs :
    "private-${idx}" => {
      cidr              = cidr
      availability_zone = var.availability_zones[idx % length(var.availability_zones)]
    }
  }
}
```

**Why good:** Named locals make resource blocks readable. `is_production` is clearer than repeating `var.environment == "production"` in multiple resources. Pre-computed maps with `for` expressions keep `for_each` arguments clean.

### Bad Example

```hcl
locals {
  # BAD: Chained locals that are hard to follow
  step1 = [for x in var.items : x if x.enabled]
  step2 = [for x in local.step1 : merge(x, { processed = true })]
  step3 = { for x in local.step2 : x.name => x }

  # BAD: Local that should be a variable (caller-controlled)
  instance_type = "t3.micro"
}
```

**Why bad:** Deep local chains obscure what `step3` actually contains. If a value should be set by the caller, it belongs in a variable, not a local.

---

## Pattern 6: Data Sources

Data sources read existing infrastructure. They are evaluated during planning by default.

### Good Example

```hcl
# Fetch latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]  # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Read existing VPC by tag
data "aws_vpc" "main" {
  filter {
    name   = "tag:Name"
    values = ["${var.project_name}-vpc"]
  }
}

# Reference in resources
resource "aws_instance" "web" {
  ami       = data.aws_ami.ubuntu.id
  subnet_id = data.aws_vpc.main.id
  # ...
}
```

**Why good:** Data sources reference existing infrastructure without managing it. AMI lookups always get the latest patched image. VPC lookup by tag is more resilient than hardcoded IDs.

### Gotcha: Data Source Timing

```hcl
# BAD: Data source depends on resource created in same apply
data "aws_instance" "web" {
  instance_id = aws_instance.web.id  # Not yet created during plan!
}

# GOOD: Use depends_on to defer the read
data "aws_instance" "web" {
  depends_on  = [aws_instance.web]
  instance_id = aws_instance.web.id
}
```

**Why:** Data sources run during planning. If they reference resources that don't exist yet, the plan fails. `depends_on` defers the read until after the dependency is created.

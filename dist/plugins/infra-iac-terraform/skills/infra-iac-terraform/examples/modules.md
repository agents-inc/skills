# Terraform - Module Examples

> Module structure, composition, versioning, and registry patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for the module decision framework.

**Additional Examples:**

- [core.md](core.md) - Resource definitions, variables, outputs, locals, data sources
- [state.md](state.md) - Remote backends, state locking, moved/import/removed blocks
- [patterns.md](patterns.md) - for_each, dynamic blocks, lifecycle, conditions

---

## Pattern 1: Standard Module Structure

Every module follows the same file layout. `README.md` presence makes a nested module public-facing.

```
modules/
  vpc/
    main.tf           # Resource definitions
    variables.tf      # Input variables with type, description, validation
    outputs.tf        # Output values with description
    README.md         # Usage documentation (required for public modules)
    locals.tf         # Local values (optional, if complex)
    data.tf           # Data sources (optional, if needed)
```

### Module: variables.tf

```hcl
# modules/vpc/variables.tf
variable "cidr_block" {
  type        = string
  description = "CIDR block for the VPC"

  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "Must be a valid CIDR block (e.g., 10.0.0.0/16)."
  }
}

variable "environment" {
  type        = string
  description = "Environment name used for resource naming and tagging"
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private subnets"
  default     = []
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets"
  default     = []
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Whether to create a NAT gateway for private subnet internet access"
  default     = false
}
```

### Module: main.tf

```hcl
# modules/vpc/main.tf
resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.environment}-vpc"
  }
}

resource "aws_subnet" "private" {
  for_each = {
    for idx, cidr in var.private_subnet_cidrs :
    "private-${idx}" => { cidr = cidr, az_index = idx }
  }

  vpc_id            = aws_vpc.this.id
  cidr_block        = each.value.cidr
  availability_zone = data.aws_availability_zones.available.names[
    each.value.az_index % length(data.aws_availability_zones.available.names)
  ]

  tags = {
    Name = "${var.environment}-${each.key}"
    Tier = "private"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}
```

### Module: outputs.tf

```hcl
# modules/vpc/outputs.tf
output "vpc_id" {
  value       = aws_vpc.this.id
  description = "ID of the created VPC"
}

output "private_subnet_ids" {
  value       = [for s in aws_subnet.private : s.id]
  description = "List of private subnet IDs"
}
```

**Why good:** Consistent file layout makes any module instantly navigable. Every variable has type + description + validation. Every output has a description. The module does one thing (VPC networking).

---

## Pattern 2: Root Module Composition

Root modules compose child modules. Keep the tree flat -- root calls modules directly, modules do not call other modules.

### Good Example

```hcl
# environments/production/main.tf
module "vpc" {
  source = "../../modules/vpc"

  cidr_block           = "10.0.0.0/16"
  environment          = "production"
  private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24"]
  enable_nat_gateway   = true
}

module "compute" {
  source = "../../modules/compute"

  environment    = "production"
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  instance_type  = "t3.large"
  instance_count = 3
}

module "database" {
  source = "../../modules/database"

  environment = "production"
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids
}
```

**Why good:** Flat composition. Root module is the orchestrator -- it wires outputs from one module to inputs of another. Each module is independently reusable.

### Bad Example

```hcl
# BAD: Module calling another module (nested)
# modules/app/main.tf
module "vpc" {
  source     = "../vpc"       # Module-to-module dependency
  cidr_block = var.cidr_block
}

module "compute" {
  source     = "../compute"
  vpc_id     = module.vpc.vpc_id  # Tight coupling
  subnet_ids = module.vpc.private_subnet_ids
}
```

**Why bad:** The `app` module now depends on both `vpc` and `compute` modules -- it can't be used without them. Debugging requires tracing through multiple module layers. The root module loses visibility into what's being created.

---

## Pattern 3: Module Versioning and Sources

### Registry Module (Versioned)

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"  # Pin to major version

  name = "${var.environment}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
}
```

### Git Source (Tag-Pinned)

```hcl
module "internal_module" {
  source = "git::https://github.com/org/terraform-modules.git//modules/vpc?ref=v2.1.0"

  cidr_block  = "10.0.0.0/16"
  environment = var.environment
}
```

### Local Source

```hcl
module "vpc" {
  source = "./modules/vpc"

  cidr_block  = "10.0.0.0/16"
  environment = var.environment
}
```

**Key rules:**

- Registry modules: always pin with `version = "~> X.Y"` (pessimistic constraint)
- Git sources: always pin with `?ref=vX.Y.Z` (exact tag)
- Local modules: no version pinning needed (changes apply immediately)
- Never use `ref=main` or `ref=HEAD` for git sources in production -- pins to a moving target

---

## Pattern 4: Module with Optional Features

Use `count` or `for_each` conditional patterns to make module features optional.

```hcl
# modules/vpc/main.tf

# NAT Gateway -- only when enabled
resource "aws_nat_gateway" "this" {
  count = var.enable_nat_gateway ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = values(aws_subnet.public)[0].id

  tags = {
    Name = "${var.environment}-nat"
  }
}

resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? 1 : 0

  domain = "vpc"
}

# Route table for private subnets -- conditional NAT route
resource "aws_route" "private_nat" {
  count = var.enable_nat_gateway ? 1 : 0

  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[0].id
}
```

**Why good:** `count = var.enable_flag ? 1 : 0` is the standard pattern for conditional resource creation. Dev environments skip the NAT gateway (cost savings), production enables it.

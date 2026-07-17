# Terraform - Advanced Patterns

> for_each, dynamic blocks, lifecycle meta-arguments, custom conditions, and expressions. See [SKILL.md](../SKILL.md) for pattern summaries and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [core.md](core.md) - Resource definitions, variables, outputs, locals, data sources
- [modules.md](modules.md) - Module structure, composition, versioning
- [state.md](state.md) - Remote backends, state locking, moved/import/removed blocks

---

## Pattern 1: for_each with Maps

### Good Example

```hcl
variable "buckets" {
  type = map(object({
    versioning = bool
    lifecycle_days = number
  }))
  description = "Map of S3 buckets to create, keyed by bucket purpose"
}

resource "aws_s3_bucket" "this" {
  for_each = var.buckets

  bucket = "${var.project_name}-${each.key}"

  tags = {
    Name    = each.key
    Purpose = each.key
  }
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = { for k, v in var.buckets : k => v if v.versioning }

  bucket = aws_s3_bucket.this[each.key].id

  versioning_configuration {
    status = "Enabled"
  }
}
```

**Why good:** Map keys are stable identifiers. Removing a bucket from the map only destroys that specific bucket. The versioning resource uses a filtered `for` expression to only create for buckets with `versioning = true`.

### Calling with map variable

```hcl
# terraform.tfvars
buckets = {
  logs = {
    versioning     = true
    lifecycle_days = 90
  }
  artifacts = {
    versioning     = false
    lifecycle_days = 30
  }
}
```

---

## Pattern 2: for_each with toset

When you have a simple list of unique values (no complex object needed), convert to a set.

```hcl
variable "team_members" {
  type        = list(string)
  description = "List of IAM user names to create"
  default     = ["alice", "bob", "carol"]
}

resource "aws_iam_user" "team" {
  for_each = toset(var.team_members)

  name = each.value

  tags = {
    ManagedBy = "terraform"
  }
}
```

**Gotcha:** `toset()` deduplicates. If your list has `["alice", "alice", "bob"]`, only two users are created. This is silent -- no warning.

---

## Pattern 3: Conditional Resource Creation

Use `count = var.flag ? 1 : 0` for resources that should optionally exist.

```hcl
variable "enable_monitoring" {
  type        = bool
  description = "Whether to create monitoring resources"
  default     = false
}

resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.project_name}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "CPU utilization exceeds 80% for 10 minutes"
}

# Reference conditional resource carefully
output "alarm_arn" {
  value       = var.enable_monitoring ? aws_cloudwatch_metric_alarm.high_cpu[0].arn : null
  description = "ARN of the CPU alarm, null if monitoring disabled"
}
```

**Why good:** Boolean variable makes the feature toggle explicit. Output uses ternary to handle the case where the resource doesn't exist. `count = condition ? 1 : 0` is the standard Terraform pattern for conditional resources.

---

## Pattern 4: Dynamic Blocks

Generate repeated nested blocks from a variable-length collection.

### Good Example

```hcl
variable "ingress_rules" {
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  description = "Ingress rules for the security group"
}

resource "aws_security_group" "web" {
  name        = "${var.project_name}-web-sg"
  description = "Security group for web servers"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_rules

    content {
      from_port   = ingress.value.from_port
      to_port     = ingress.value.to_port
      protocol    = ingress.value.protocol
      cidr_blocks = ingress.value.cidr_blocks
      description = ingress.value.description
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }
}
```

**Why good:** Module callers can define as many ingress rules as needed. The egress block is static and written literally (not dynamic) because it's the same for every caller.

### When NOT to Use Dynamic Blocks

```hcl
# BAD: Dynamic block for a fixed set of 2 rules -- just write them out
dynamic "ingress" {
  for_each = [
    { port = 80,  desc = "HTTP" },
    { port = 443, desc = "HTTPS" },
  ]
  content {
    from_port   = ingress.value.port
    to_port     = ingress.value.port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = ingress.value.desc
  }
}

# GOOD: Write the two blocks literally -- clearer and easier to read
ingress {
  from_port   = 80
  to_port     = 80
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  description = "HTTP"
}

ingress {
  from_port   = 443
  to_port     = 443
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  description = "HTTPS"
}
```

**Why:** HashiCorp's own docs recommend writing nested blocks literally where possible. Dynamic blocks add indirection -- only use them in modules where the caller needs to control the set.

---

## Pattern 5: Lifecycle Meta-Arguments

### prevent_destroy for Critical Resources

```hcl
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = var.db_instance_class
  # ...

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket" "terraform_state" {
  bucket = "myorg-terraform-state"

  lifecycle {
    prevent_destroy = true
  }
}
```

**Gotcha:** `prevent_destroy` only blocks `terraform destroy` while the resource block exists. If you remove the entire resource block from your `.tf` files, Terraform will destroy the resource regardless.

### create_before_destroy for Zero-Downtime

```hcl
resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-"
  image_id      = data.aws_ami.app.id
  instance_type = var.instance_type

  lifecycle {
    create_before_destroy = true
  }
}
```

**When to use:** Resources behind load balancers, ASG launch templates, TLS certificates, DNS records -- anything where destroying before creating causes downtime.

### ignore_changes for Externally Managed Attributes

```hcl
resource "aws_autoscaling_group" "app" {
  name                = "${var.project_name}-asg"
  desired_capacity    = var.initial_capacity
  min_size            = var.min_capacity
  max_size            = var.max_capacity
  launch_template {
    id = aws_launch_template.app.id
  }

  lifecycle {
    ignore_changes = [desired_capacity]  # Auto-scaling changes this
  }
}
```

**Why:** Without `ignore_changes`, every `terraform apply` resets `desired_capacity` to the Terraform-configured value, undoing auto-scaling decisions.

### replace_triggered_by

```hcl
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = var.instance_type

  lifecycle {
    replace_triggered_by = [
      aws_launch_template.app.latest_version,  # Force replacement on template change
    ]
  }
}
```

**When to use:** Force resource replacement when a dependency changes that Terraform's normal dependency graph does not detect.

---

## Pattern 6: Preconditions, Postconditions, and Checks

### Precondition (Validate Before Creation)

```hcl
data "aws_ami" "app" {
  most_recent = true
  owners      = ["self"]

  filter {
    name   = "name"
    values = ["${var.project_name}-*"]
  }
}

resource "aws_instance" "app" {
  ami           = data.aws_ami.app.id
  instance_type = var.instance_type

  lifecycle {
    precondition {
      condition     = data.aws_ami.app.architecture == "x86_64"
      error_message = "AMI must be x86_64 architecture for this instance type."
    }
  }
}
```

### Postcondition (Validate After Creation)

```hcl
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  instance_class = var.db_instance_class
  # ...

  lifecycle {
    postcondition {
      condition     = self.status == "available"
      error_message = "Database instance did not reach 'available' status."
    }
  }
}
```

### Check Block (Warnings, Non-Blocking)

```hcl
check "health_check" {
  data "http" "app_health" {
    url = "https://${aws_lb.app.dns_name}/health"
  }

  assert {
    condition     = data.http.app_health.status_code == 200
    error_message = "Application health check failed after deployment."
  }
}
```

**Key difference:**

- `precondition` -- blocks plan if condition fails (validate assumptions)
- `postcondition` -- blocks apply if condition fails (validate guarantees)
- `check` -- produces a warning but does NOT block plan or apply (informational)

---

## Pattern 7: For Expressions

Transform collections inline. Use for filtering, mapping, and restructuring data.

```hcl
# Filter a map -- only production instances
locals {
  prod_instances = {
    for name, config in var.instances : name => config
    if config.environment == "production"
  }
}

# Map transformation -- extract specific field
locals {
  instance_arns = [for inst in aws_instance.app : inst.arn]
}

# Restructure -- list of objects to map keyed by name
locals {
  user_map = {
    for user in var.users : user.name => user
  }
}

# Conditional values with ternary in for
locals {
  instance_types = {
    for name, config in var.instances : name => (
      config.environment == "production" ? "t3.large" : "t3.micro"
    )
  }
}
```

**Key syntax:** `{ for k, v in map : new_key => new_value if condition }` produces a map. `[ for v in list : expression ]` produces a list. Add `...` after the value to group by key: `{ for k, v in map : group_key => v... }`.

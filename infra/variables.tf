# ================================================
# Infrastructure Variables
# ================================================

# ========================
# GENERAL
# ========================

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "bbf"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

# ========================
# NETWORKING
# ========================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# ========================
# DATABASE
# ========================

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS (GB)"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS auto-scaling (GB)"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Database backup retention period (days)"
  type        = number
  default     = 7
}

variable "db_master_username" {
  description = "Master username for RDS instance"
  type        = string
  default     = "bbf_admin"
}

variable "db_master_password" {
  description = "Master password for RDS instance"
  type        = string
  sensitive   = true
  default     = null
  
  validation {
    condition     = var.db_master_password == null || length(var.db_master_password) >= 8
    error_message = "Database password must be at least 8 characters long."
  }
}

# ========================
# COMPUTE
# ========================

variable "api_cpu" {
  description = "CPU units for API service (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory for API service (MB)"
  type        = number
  default     = 1024
}

variable "api_desired_count" {
  description = "Desired number of API service tasks"
  type        = number
  default     = 2
}

variable "api_max_capacity" {
  description = "Maximum number of API service tasks for auto-scaling"
  type        = number
  default     = 10
}

variable "api_min_capacity" {
  description = "Minimum number of API service tasks for auto-scaling"
  type        = number
  default     = 1
}

# ========================
# STORAGE
# ========================

variable "s3_force_destroy" {
  description = "Allow Terraform to destroy S3 buckets with objects (dangerous in production)"
  type        = bool
  default     = false
}

# ========================
# MONITORING
# ========================

variable "log_retention_days" {
  description = "CloudWatch log retention period (days)"
  type        = number
  default     = 30
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = false
}

# ========================
# SECURITY
# ========================

variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for CloudFront/ALB"
  type        = string
  default     = null
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# ========================
# FEATURE FLAGS
# ========================

variable "enable_nat_gateway" {
  description = "Enable NAT gateway for private subnets (costs money)"
  type        = bool
  default     = true
}

variable "enable_cloudfront" {
  description = "Enable CloudFront distribution"
  type        = bool
  default     = true
}

variable "enable_lambda_functions" {
  description = "Enable Lambda functions for batch processing"
  type        = bool
  default     = true
}

variable "enable_redis_cluster" {
  description = "Enable Redis cluster for caching"
  type        = bool
  default     = true
}

# ========================
# DOMAIN & DNS
# ========================

variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = null
}

variable "api_subdomain" {
  description = "Subdomain for API (e.g., 'api' for api.example.com)"
  type        = string
  default     = "api"
}

variable "web_subdomain" {
  description = "Subdomain for web app (e.g., 'app' for app.example.com)"
  type        = string
  default     = "app"
}

# ========================
# TAGS
# ========================

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
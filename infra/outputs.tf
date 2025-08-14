# ================================================
# Infrastructure Outputs
# ================================================

# ========================
# NETWORKING
# ========================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

# ========================
# DATABASE
# ========================

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "database_port" {
  description = "RDS instance port"
  value       = module.database.port
}

output "database_name" {
  description = "Name of the database"
  value       = module.database.database_name
}

output "database_instance_id" {
  description = "RDS instance identifier"
  value       = module.database.instance_id
}

# ========================
# COMPUTE
# ========================

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "api_service_name" {
  description = "Name of the API ECS service"
  value       = module.ecs.api_service_name
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.ecs.alb_dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = module.ecs.alb_zone_id
}

output "api_url" {
  description = "URL of the API endpoint"
  value       = "https://${module.ecs.alb_dns_name}"
}

# ========================
# STORAGE
# ========================

output "exports_bucket_name" {
  description = "Name of the S3 bucket for exports"
  value       = module.storage.exports_bucket_name
}

output "cache_bucket_name" {
  description = "Name of the S3 bucket for cache"
  value       = module.storage.cache_bucket_name
}

output "web_bucket_name" {
  description = "Name of the S3 bucket for web assets"
  value       = module.storage.web_bucket_name
}

# ========================
# CDN
# ========================

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.enable_cloudfront ? module.cloudfront.distribution_id : null
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = var.enable_cloudfront ? module.cloudfront.domain_name : null
}

output "web_url" {
  description = "URL of the web application"
  value       = var.enable_cloudfront ? "https://${module.cloudfront.domain_name}" : "https://${module.ecs.alb_dns_name}"
}

# ========================
# LAMBDA
# ========================

output "lambda_function_names" {
  description = "Names of the Lambda functions"
  value       = var.enable_lambda_functions ? module.lambda.function_names : []
}

output "job_queue_url" {
  description = "URL of the SQS job queue"
  value       = var.enable_lambda_functions ? module.lambda.job_queue_url : null
}

# ========================
# SECURITY
# ========================

output "secrets_kms_key_id" {
  description = "ID of the KMS key for secrets"
  value       = module.security.secrets_kms_key_id
}

output "secrets_kms_key_arn" {
  description = "ARN of the KMS key for secrets"
  value       = module.security.secrets_kms_key_arn
}

# ========================
# MONITORING
# ========================

output "log_group_names" {
  description = "Names of the CloudWatch log groups"
  value       = module.monitoring.log_group_names
}

# ========================
# REDIS
# ========================

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = var.enable_redis_cluster ? module.vpc.redis_endpoint : null
  sensitive   = true
}

output "redis_port" {
  description = "Redis cluster port"
  value       = var.enable_redis_cluster ? module.vpc.redis_port : null
}

# ========================
# DEPLOYMENT INFO
# ========================

output "deployment_info" {
  description = "Information needed for application deployment"
  value = {
    environment     = var.environment
    aws_region      = var.aws_region
    vpc_id          = module.vpc.vpc_id
    cluster_name    = module.ecs.cluster_name
    service_name    = module.ecs.api_service_name
    task_definition = module.ecs.task_definition_family
    
    # Database connection (for migrations)
    database_endpoint = module.database.endpoint
    database_name     = module.database.database_name
    database_port     = module.database.port
    
    # S3 buckets
    exports_bucket = module.storage.exports_bucket_name
    cache_bucket   = module.storage.cache_bucket_name
    
    # URLs
    api_url = "https://${module.ecs.alb_dns_name}"
    web_url = var.enable_cloudfront ? "https://${module.cloudfront.domain_name}" : "https://${module.ecs.alb_dns_name}"
    
    # Security
    kms_key_id = module.security.secrets_kms_key_id
  }
  sensitive = true
}

# ========================
# CONNECTION STRINGS
# ========================

output "database_url" {
  description = "Database connection URL (without password)"
  value       = "postgresql://${var.db_master_username}@${module.database.endpoint}:${module.database.port}/${module.database.database_name}"
  sensitive   = true
}

output "redis_url" {
  description = "Redis connection URL"
  value       = var.enable_redis_cluster ? "redis://${module.vpc.redis_endpoint}:${module.vpc.redis_port}/0" : null
  sensitive   = true
}
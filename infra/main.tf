# ================================================
# Backyard Builder Finder Infrastructure
# ================================================

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }

  # Uncomment and configure for production
  # backend "s3" {
  #   bucket = "bbf-terraform-state"
  #   key    = "infrastructure/terraform.tfstate"
  #   region = "us-west-2"
  #   dynamodb_table = "bbf-terraform-locks"
  #   encrypt = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "BackyardBuilderFinder"
      Environment = var.environment
      Terraform   = "true"
    }
  }
}

# ========================
# LOCALS & DATA
# ========================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    Terraform   = "true"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ========================
# VPC & NETWORKING
# ========================

module "vpc" {
  source = "./modules/vpc"
  
  name_prefix         = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
  
  tags = local.common_tags
}

# ========================
# SECURITY
# ========================

module "security" {
  source = "./modules/security"
  
  name_prefix = local.name_prefix
  vpc_id      = module.vpc.vpc_id
  
  tags = local.common_tags
}

# ========================
# DATABASE
# ========================

module "database" {
  source = "./modules/database"
  
  name_prefix               = local.name_prefix
  vpc_id                   = module.vpc.vpc_id
  private_subnet_ids       = module.vpc.private_subnet_ids
  database_security_group_id = module.security.database_security_group_id
  
  instance_class           = var.db_instance_class
  allocated_storage        = var.db_allocated_storage
  max_allocated_storage    = var.db_max_allocated_storage
  backup_retention_period  = var.db_backup_retention_period
  
  master_username = var.db_master_username
  master_password = var.db_master_password
  
  tags = local.common_tags
}

# ========================
# STORAGE
# ========================

module "storage" {
  source = "./modules/storage"
  
  name_prefix = local.name_prefix
  
  tags = local.common_tags
}

# ========================
# CONTAINER SERVICES
# ========================

module "ecs" {
  source = "./modules/ecs"
  
  name_prefix                = local.name_prefix
  vpc_id                    = module.vpc.vpc_id
  private_subnet_ids        = module.vpc.private_subnet_ids
  public_subnet_ids         = module.vpc.public_subnet_ids
  api_security_group_id     = module.security.api_security_group_id
  alb_security_group_id     = module.security.alb_security_group_id
  
  # Database connection
  database_endpoint = module.database.endpoint
  database_name     = module.database.database_name
  
  # Storage
  exports_bucket_name = module.storage.exports_bucket_name
  
  # Secrets
  secrets_kms_key_arn = module.security.secrets_kms_key_arn
  
  tags = local.common_tags
}

# ========================
# SERVERLESS COMPUTE
# ========================

module "lambda" {
  source = "./modules/lambda"
  
  name_prefix                = local.name_prefix
  vpc_id                    = module.vpc.vpc_id
  private_subnet_ids        = module.vpc.private_subnet_ids
  lambda_security_group_id  = module.security.lambda_security_group_id
  
  # Database connection
  database_endpoint = module.database.endpoint
  database_name     = module.database.database_name
  
  # Storage
  exports_bucket_name    = module.storage.exports_bucket_name
  cache_bucket_name      = module.storage.cache_bucket_name
  
  # Secrets
  secrets_kms_key_arn = module.security.secrets_kms_key_arn
  
  tags = local.common_tags
}

# ========================
# CDN & FRONTEND
# ========================

module "cloudfront" {
  source = "./modules/cloudfront"
  
  name_prefix = local.name_prefix
  
  # ALB for API
  api_domain_name = module.ecs.alb_dns_name
  api_origin_id   = "${local.name_prefix}-api"
  
  # S3 for web assets (if serving static files)
  web_bucket_name = module.storage.web_bucket_name
  web_origin_id   = "${local.name_prefix}-web"
  
  tags = local.common_tags
}

# ========================
# MONITORING & SECRETS
# ========================

module "monitoring" {
  source = "./modules/monitoring"
  
  name_prefix = local.name_prefix
  
  # ECS cluster for monitoring
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.api_service_name
  
  # Database for monitoring
  db_instance_id = module.database.instance_id
  
  # Lambda functions
  lambda_function_names = module.lambda.function_names
  
  tags = local.common_tags
}
variable "aws_region" {
  description = "AWS region for media resources (S3, MediaConvert, CloudFront)."
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Short project prefix for resource names (lowercase, no spaces)."
  type        = string
  default     = "academistream"
}

variable "environment" {
  description = "Environment label for resource names (e.g. dev, prod)."
  type        = string
  default     = "dev"
}

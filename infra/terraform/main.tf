# Sprint 6 media baseline — S3 bucket + MediaConvert IAM role (CloudFront in S6-05).

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-${var.environment}-media-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "media"
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_role" "mediaconvert" {
  name = "${var.project_name}-${var.environment}-mediaconvert"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "mediaconvert.amazonaws.com" }
      Action   = "sts:AssumeRole"
    }]
  })

  tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "mediaconvert-s3-access"
  }
}

resource "aws_iam_role_policy" "mediaconvert_s3" {
  name = "${var.project_name}-${var.environment}-mediaconvert-s3"
  role = aws_iam_role.mediaconvert.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
      ]
      Resource = [
        aws_s3_bucket.media.arn,
        "${aws_s3_bucket.media.arn}/*",
      ]
    }]
  })
}
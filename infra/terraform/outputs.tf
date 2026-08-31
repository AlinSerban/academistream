output "aws_region" {
  description = "Region used by this stack."
  value       = var.aws_region
}

output "aws_account_id" {
  description = "AWS account ID (sanity check after apply)."
  value       = data.aws_caller_identity.current.account_id
}

output "s3_bucket_name" {
  description = "S3 bucket for video uploads and transcoded outputs."
  value       = aws_s3_bucket.media.bucket
}

output "mediaconvert_role_arn" {
  description = "IAM role ARN for MediaConvert jobs (MEDIACONVERT_ROLE)."
  value       = aws_iam_role.mediaconvert.arn
}
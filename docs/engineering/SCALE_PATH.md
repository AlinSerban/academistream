# Scale path

## Current (prototype)

- **Compute:** EC2 + Docker Compose for `api`, `worker`, `web`
- **Data on the box:** PostgreSQL, Kafka, Redis in Docker
- **AWS services:** S3, CloudFront, MediaConvert, SES, IAM, Route53/ACM, CloudWatch
- **Infra as code:** Terraform under `infra/terraform` (resources added over time)

## Target before broader launch

- **App:** `api` and `worker` on **ECS** (separate services; scale independently)
- **Database:** **RDS** PostgreSQL
- **Optional later:** MSK (Kafka), ElastiCache (Redis)
- Same container images; change hosting and connection strings

## Why this order

Keep monthly cost low while building the product spine; move to managed/scalable hosting when uptime and load require it.

# Terraform — Academistream (Sprint 6 media)

AWS resources for the **media path**: S3, IAM (MediaConvert role), CloudFront (later sprint).

App hosting stays on EC2 + Docker for the prototype; see `docs/engineering/SCALE_PATH.md`.

## What this stack creates (S6-01)

| Resource | Purpose |
|----------|---------|
| `aws_s3_bucket.media` | Private bucket for uploads + transcoded outputs |
| `aws_s3_bucket_public_access_block.media` | Block all public access |
| `aws_iam_role.mediaconvert` | Role **MediaConvert assumes** to read/write S3 during jobs |
| `aws_iam_role_policy.mediaconvert_s3` | S3 get/put/list on that bucket only |

Bucket name pattern: `{project}-{env}-media-{account_id}` (e.g. `academistream-dev-media-068741930484`).

## Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured (`aws sts get-caller-identity` works).
- [Terraform](https://developer.hashicorp.com/terraform/install) **>= 1.5** on your PATH (`terraform version`).

Default region: **eu-central-1** (override with `-var="aws_region=..."` or `TF_VAR_aws_region`).

## Layout

| File | Purpose |
|------|---------|
| `versions.tf` | Terraform + AWS provider pins |
| `provider.tf` | AWS provider (region from variable) |
| `variables.tf` | `aws_region`, `project_name`, `environment` |
| `main.tf` | S3 + MediaConvert IAM |
| `outputs.tf` | Values for `.env` |

## Commands

From repo root:

```bash
cd infra/terraform
terraform init
terraform validate
terraform plan
terraform apply
```

Show values for app config (copy into `.env`, do not commit):

```bash
terraform output s3_bucket_name
terraform output mediaconvert_role_arn
terraform output aws_region
```

Or all at once:

```bash
terraform output -json
```

## Wire into the app (after S6-02+)

Until the S3 adapter and worker MediaConvert path ship, the app keeps **`STORAGE_PROVIDER=local`**.

When enabling AWS:

1. `terraform apply` (this directory).
2. Copy outputs into `.env` (see repo `.env.example`).
3. Ensure API + worker can reach AWS (same credentials as CLI, or an EC2 instance role later).
4. Set `STORAGE_PROVIDER=s3` when S6-02 is implemented.

| `.env` variable | Source |
|-----------------|--------|
| `AWS_REGION` | `terraform output aws_region` |
| `S3_BUCKET` | `terraform output s3_bucket_name` |
| `MEDIACONVERT_ROLE` | `terraform output mediaconvert_role_arn` |
| `CLOUDFRONT_DOMAIN` | CloudFront distribution hostname (console; not in Terraform yet) |
| `CLOUDFRONT_KEY_PAIR_ID` | CloudFront key pair (public key in ACM/CloudFront) |
| `CLOUDFRONT_PRIVATE_KEY_PATH` | Path to PEM private key on API host (never commit) |

### CloudFront playback (S6-05 — manual console setup)

Terraform does not create the distribution yet. For signed playback:

1. Create a **CloudFront distribution** with origin = your media S3 bucket.
2. Use **Origin Access Control (OAC)** so the bucket stays private (no public object URLs).
3. Create a **CloudFront key group** / trusted key for signed URLs; save the PEM private key locally.
4. Set `CLOUDFRONT_DOMAIN` (e.g. `d111111abcdef8.cloudfront.net`), `CLOUDFRONT_KEY_PAIR_ID`, and `CLOUDFRONT_PRIVATE_KEY_PATH` in `.env`.
5. Without these vars, playback falls back to **S3 presigned** URLs (still private; not public bucket).

## IAM notes

- **MediaConvert role** — used by the MediaConvert **service** during a job (console or `CreateJob`). Not a human login.
- **API / worker** — use your IAM user or instance role to call `s3:*` and `mediaconvert:CreateJob`. The caller also needs **`iam:PassRole`** on `mediaconvert_role_arn`. Admin dev users usually already have this; tighten for production.

## Local app vs AWS media

| Mode | Storage | Transcode | Playback |
|------|---------|-----------|----------|
| **Default (dev/CI)** | Local disk (`STORAGE_LOCAL_ROOT`) | Worker stub | Local file URL |
| **AWS (S6-02+)** | S3 | MediaConvert | CloudFront signed URL (S6-05) |

`npm test` / CI should stay on **local** — no real AWS in unit tests.

## State & secrets

- **Do not commit** `.terraform/`, `*.tfstate`, or `*.tfstate.backup`.
- Access keys stay in `~/.aws/credentials`, not in this repo.
- Optional later: remote state (S3 + DynamoDB lock) — out of scope for prototype S6-01.

## Teardown

```bash
terraform destroy
```

Empty the bucket first if `force_destroy` is false and objects exist.

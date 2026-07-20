# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Contact the repository owner privately with a clear description, affected component, reproduction steps, and potential impact. Allow time for acknowledgement and remediation before sharing details publicly.

## Secret handling

Credentials, tokens, private keys, and production configuration must never be committed. The repository intentionally contains only `*.env.example` templates with non-sensitive placeholders.

- Keep real values in ignored `.env` files for local development.
- Use AWS Secrets Manager, SSM Parameter Store, or CI/CD secret storage for deployed environments.
- Use least-privilege IAM roles and short-lived credentials where possible.
- Treat every credential that has ever appeared in a Git commit, log, screenshot, or public channel as compromised: revoke or rotate it immediately.

Before opening a pull request, review staged changes with `git diff --cached`, ensure no environment files are staged, and run the test and build commands relevant to your changes.

GitHub Actions runs a secret scan, tests, and workspace build for every pull request and push to `main`. Keep branch protection enabled on GitHub so these checks must pass before merging.

## Security controls in this codebase

The application includes JWT-based service authentication, role-based access control, request validation and sanitisation at the gateway, rate limiting, secure password hashing, OTP/TOTP support, audit logging, and signed S3 upload URLs. These controls reduce risk but do not replace secure deployment configuration, dependency maintenance, security review, or credential rotation.

## Production deployment baseline

Before connecting this application to company data, the deployment owner must:

1. Rotate any credential that was ever exposed and remove unused access keys.
2. Use IAM roles rather than long-lived AWS access keys; grant only the exact resource actions required.
3. Store secrets in AWS Secrets Manager or SSM Parameter Store, not Lambda environment files or source control.
4. Restrict API Gateway and S3 access to the intended domains, enable CloudTrail, and set CloudWatch alarms for authentication and access failures.
5. Enable encryption at rest, backup/point-in-time recovery, and retention rules for DynamoDB and S3 according to company policy.
6. Require HTTPS, use approved OAuth redirect URIs, and configure a company-managed email sender.
7. Enable GitHub branch protection on `main`, require the CI checks, and limit repository access to the relevant team.

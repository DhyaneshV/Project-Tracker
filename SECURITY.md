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

## Security controls in this codebase

The application includes JWT-based service authentication, role-based access control, request validation and sanitisation at the gateway, rate limiting, secure password hashing, OTP/TOTP support, audit logging, and signed S3 upload URLs. These controls reduce risk but do not replace secure deployment configuration, dependency maintenance, security review, or credential rotation.

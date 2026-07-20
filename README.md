# Project Tracker

Project Tracker is a TypeScript monorepo for running projects, tasks, teams, and operational communication in one place. It combines React dashboards with GraphQL services and AWS serverless infrastructure to support role-aware project delivery—from individual work queues to organisation-level analytics.

> This repository contains source code and safe configuration templates only. It contains no production credentials, API keys, tokens, customer data, or deployment outputs.

## What it provides

- Project portfolios with lifecycle, budget, timeline, capacity, health, and risk visibility.
- Task planning with priorities, assignments, blockers, due dates, and status tracking.
- Role-aware dashboards for executives, managers, project leaders, and contributors.
- Team and user management with hierarchy-aware RBAC, invitations, onboarding, account status, and audit events.
- Password login, OAuth entry points, JWT sessions, email OTP, and TOTP support.
- Project documents and task attachments through controlled S3 upload flows.
- Project chat, channels, WebSocket updates, and real-time activity events.
- AWS Lambda / API Gateway / DynamoDB / S3 / CloudFront deployment definitions.

## Architecture

```text
React web applications
  ├─ root/web-root       Main workspace and project dashboards :3000
  └─ users/web-users     Team-management client               :3001
             │ GraphQL / HTTP / WebSocket
             ▼
root/svc-root            Gateway, authentication, validation, routing :4000
  ├─ users/svc-users     Identity, RBAC, invitations, audit             :4001
  ├─ projects/svc-projects  Projects, tasks, documents, analytics        :4002
  └─ chat/svc-chat       Channels, messages, live events                 :4003
             │
             ▼
AWS DynamoDB, S3, SES, API Gateway, Lambda, CloudFront
```

The gateway is the browser-facing boundary. It validates requests, applies CORS and rate controls, verifies sessions, and forwards authorised requests to the domain services. Shared GraphQL definitions, authentication utilities, and TypeScript types keep the applications aligned.

## Technology

| Area | Choice |
| --- | --- |
| Language and tooling | TypeScript, Node.js 20+, pnpm workspaces |
| Web clients | React 18, Vite, Apollo Client |
| APIs | Apollo Server, GraphQL, Express |
| Hosting and compute | AWS Lambda, API Gateway, Serverless Framework |
| Data and files | DynamoDB, S3 |
| Live communication | WebSocket API / local `ws` server |
| Identity and security | JWT, OAuth 2.0, bcrypt, email OTP, TOTP |

## Repository layout

```text
.
├── root/
│   ├── web-root/             Primary React application
│   └── svc-root/             API gateway and authentication boundary
├── users/
│   ├── web-users/            User-management React application
│   └── svc-users/            Identity, hierarchy, RBAC, and audit service
├── projects/svc-projects/    Projects, tasks, documents, and analytics service
├── chat/svc-chat/            Chat and realtime-events service
├── packages/
│   ├── auth-library/         Shared token and OAuth helpers
│   ├── graphql-schema/       Shared GraphQL schema
│   └── shared-types/         Shared TypeScript contracts
├── deploy.sh                 Production deployment helper
├── .env.example              Safe production configuration template
└── SECURITY.md               Vulnerability and secret-handling policy
```

## Prerequisites

- Node.js 20 or later
- pnpm 8 or later (`corepack enable` is recommended)
- AWS CLI and an AWS account only when deploying
- An email provider / verified Amazon SES identity for invitation and OTP email delivery
- Google or GitHub OAuth application credentials only if OAuth sign-in is enabled

## Local setup

1. Clone the repository and enter it.

   ```bash
   git clone https://github.com/DhyaneshV/Project-Tracker.git
   cd Project-Tracker
   ```

2. Install the workspace dependencies.

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   ```

3. Create local configuration from the safe templates. Do not commit the resulting `.env` files.

   ```bash
   cp root/svc-root/.env.example root/svc-root/.env
   cp users/svc-users/.env.example users/svc-users/.env
   cp projects/svc-projects/.env.example projects/svc-projects/.env
   cp chat/svc-chat/.env.example chat/svc-chat/.env
   cp root/web-root/.env.example root/web-root/.env.local
   ```

4. Set one long, random `JWT_SECRET` value in every backend service environment file. Configure the service URLs, frontend URL, DynamoDB table names, and any optional OAuth or SES values. Use local/non-production values while developing.

5. Start the workspace.

   ```bash
   pnpm dev
   ```

The main web app is served at `http://localhost:3000`; the domain services use ports `4001`–`4003`. The gateway is configured for port `4000` when run locally. Each service can also be started independently, for example:

```bash
pnpm --filter @project-tracker/web-root dev
pnpm --filter @project-tracker/svc-users dev
```

## Configuration

The checked-in environment templates describe the supported settings. The most important values are:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Gateway and backend services | Signs and verifies service/session tokens. Use a unique, high-entropy value. |
| `USERS_SERVICE_URL`, `PROJECTS_SERVICE_URL`, `CHAT_SERVICE_URL` | Gateway | Internal domain-service routing. |
| `FRONTEND_URL` | Gateway | CORS allow-list and browser origin. |
| `VITE_GATEWAY_URL`, `VITE_API_URL`, `VITE_CHAT_WS_URL` | Main web app | Browser-visible API and WebSocket endpoints. Never place secrets in `VITE_*` values. |
| `AWS_REGION`, table variables | Backend services | AWS region and storage resources. |
| `GOOGLE_*`, `GITHUB_*` | Gateway | Optional OAuth client configuration. |
| `SES_FROM_EMAIL`, `SES_REGION` | Gateway | Email sender configuration. |

For production, inject secrets from AWS Secrets Manager, SSM Parameter Store, or your CI/CD secret store. Never use a committed `.env.production` file.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Starts the configured local services concurrently. |
| `pnpm --filter @project-tracker/web-root build` | Type-checks and builds the primary web app. |
| `pnpm --filter @project-tracker/web-root test` | Runs the primary web-app test suite. |
| `pnpm --filter <workspace> build` | Builds a selected service or package. |
| `./deploy.sh [all|backend|frontend|gateway]` | Builds and deploys the selected AWS components. |

## Deployment

`deploy.sh` deploys the user, project, and gateway services with Serverless Framework, builds the main web application, uploads it to the stage-specific S3 bucket, and invalidates CloudFront.

Before deploying:

1. Create least-privilege AWS IAM roles and required DynamoDB/S3/SES resources, or allow the Serverless definitions to provision their declared resources.
2. Store production secrets outside the repository and make them available to the deployment environment.
3. Copy `.env.example` to a local ignored `.env.production` only if the deployment workflow requires it; restrict file permissions and do not share it.
4. Run the relevant builds and tests.
5. Deploy with `STAGE=prod ./deploy.sh all` (or a non-production stage first).

Review the generated CloudFormation, IAM policies, CORS origins, S3 bucket access, OAuth redirect URLs, and retention settings for your organisation before production use.

## Security

Security-sensitive behaviour includes:

- JWT verification between the gateway and domain services.
- Role and hierarchy checks around management operations.
- Input validation, sanitisation, CORS configuration, and request rate limiting at the gateway.
- bcrypt password hashing and OTP/TOTP flows.
- Audit records for critical user-management actions.
- Signed upload URLs instead of exposing storage credentials to browsers.

Read [SECURITY.md](SECURITY.md) before contributing or deploying. If a secret was ever committed or shared, rotate it immediately—even after the Git history is rewritten.

## Contributing

Keep pull requests focused and include tests for behavioural changes. Before committing:

```bash
git diff --cached
pnpm --filter @project-tracker/web-root test
pnpm --filter @project-tracker/web-root build
```

Do not commit environment files, logs, generated deployment artefacts, private keys, credentials, customer data, screenshots containing sensitive material, or one-off maintenance scripts. Use issue discussions and code review to agree on schema and security changes before implementation.

## Status and scope

This is an actively evolving application. Deployment topology, user flows, and integrations should be validated in a non-production AWS account before use with real organisational data. The repository is provided under the ISC license declared in `package.json`.

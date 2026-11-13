#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required. Install it, then run this script again."
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 20 ]; then
  echo "Node.js 20 or newer is required (found $(node --version))."
  exit 1
fi

required_env_files=(
  "root/svc-root/.env"
  "users/svc-users/.env"
  "projects/svc-projects/.env"
  "chat/svc-chat/.env"
  "root/web-root/.env.local"
)

for env_file in "${required_env_files[@]}"; do
  if [ ! -f "$env_file" ]; then
    echo "Missing $env_file. Copy its .env.example file and set the required values."
    exit 1
  fi
done

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  corepack enable
  corepack pnpm install --frozen-lockfile
fi

if lsof -tiTCP:3000,4000,4001,4002,4003 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "A Project Tracker port is already in use. Stop the existing stack with Ctrl+C, then run this script again."
  exit 1
fi

echo "Starting Project Tracker at http://localhost:3000"
exec env -u NODE_OPTIONS corepack pnpm dev

#!/bin/bash
set -e

# ─── Project Tracker Deployment Script ───────────────────────────
# Usage:
#   ./deploy.sh                  # Deploy everything
#   ./deploy.sh backend          # Deploy only backend services
#   ./deploy.sh frontend         # Build and deploy only frontend
#   ./deploy.sh gateway          # Deploy only the API gateway
#
# Prerequisites:
#   - AWS CLI configured with proper credentials
#   - Node.js 20+, pnpm installed
#   - serverless framework: npm install -g serverless
#   - .env.production file with all required values

STAGE="${STAGE:-prod}"
REGION="${AWS_REGION:-ap-south-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ─── Load Environment ────────────────────────────────────────────

if [ -f .env.production ]; then
    set -a
    source .env.production
    set +a
    log "Loaded .env.production"
else
    error ".env.production file not found! Copy from .env.example and fill in values."
fi

# ─── Validate Prerequisites ──────────────────────────────────────

command -v aws >/dev/null 2>&1 || error "AWS CLI not installed"
command -v node >/dev/null 2>&1 || error "Node.js not installed"
command -v pnpm >/dev/null 2>&1 || error "pnpm not installed"

# ─── Build ───────────────────────────────────────────────────────

build_backend() {
    log "Building backend services..."
    cd users/svc-users && pnpm build && cd ../..
    cd projects/svc-projects && pnpm build && cd ../..
    cd root/svc-root && pnpm build && cd ../..
    log "Backend build complete"
}

build_frontend() {
    log "Building frontend..."
    cd root/web-root
    VITE_GATEWAY_URL="${VITE_GATEWAY_URL}" \
    VITE_API_URL="${VITE_API_URL}" \
    VITE_CHAT_WS_URL="${VITE_CHAT_WS_URL}" \
    pnpm build
    cd ../..
    log "Frontend build complete (output: root/web-root/dist/)"
}

# ─── Deploy Backend ──────────────────────────────────────────────

deploy_users() {
    log "Deploying Users Service..."
    cd users/svc-users && npx serverless deploy --stage $STAGE --region $REGION && cd ../..
}

deploy_projects() {
    log "Deploying Projects Service..."
    cd projects/svc-projects && npx serverless deploy --stage $STAGE --region $REGION && cd ../..
}

deploy_gateway() {
    log "Deploying API Gateway..."
    cd root/svc-root && npx serverless deploy --stage $STAGE --region $REGION && cd ../..
}

# ─── Deploy Frontend ─────────────────────────────────────────────

deploy_frontend() {
    local BUCKET="project-tracker-frontend-${STAGE}"
    local DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
        --stack-name project-tracker-gateway-${STAGE} \
        --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
        --output text --region $REGION 2>/dev/null || echo "")

    log "Uploading to S3: s3://${BUCKET}/"
    aws s3 sync root/web-root/dist/ "s3://${BUCKET}/" \
        --delete \
        --cache-control "public, max-age=31536000, immutable" \
        --region $REGION

    # HTML files should not be cached (SPA routing)
    aws s3 cp root/web-root/dist/index.html "s3://${BUCKET}/index.html" \
        --cache-control "no-cache, no-store, must-revalidate" \
        --content-type "text/html" \
        --region $REGION

    if [ -n "$DISTRIBUTION_ID" ]; then
        log "Invalidating CloudFront cache..."
        aws cloudfront create-invalidation \
            --distribution-id "$DISTRIBUTION_ID" \
            --paths "/*" \
            --region us-east-1
    else
        warn "CloudFront distribution ID not found. Skipping invalidation."
    fi

    log "Frontend deployed successfully!"
}

# ─── Main ────────────────────────────────────────────────────────

case "${1:-all}" in
    backend)
        build_backend
        deploy_users
        deploy_projects
        deploy_gateway
        ;;
    frontend)
        build_frontend
        deploy_frontend
        ;;
    gateway)
        build_backend
        deploy_gateway
        ;;
    all)
        log "Full deployment starting..."
        build_backend
        deploy_users
        deploy_projects
        deploy_gateway
        build_frontend
        deploy_frontend
        log "═══════════════════════════════════════════"
        log "  Deployment Complete!"
        log "═══════════════════════════════════════════"
        log "API:      $(aws cloudformation describe-stacks --stack-name project-tracker-gateway-${STAGE} --query 'Stacks[0].Outputs[?OutputKey==\`ApiUrl\`].OutputValue' --output text --region $REGION 2>/dev/null || echo 'Check AWS Console')"
        log "Frontend: $(aws cloudformation describe-stacks --stack-name project-tracker-gateway-${STAGE} --query 'Stacks[0].Outputs[?OutputKey==\`CloudFrontUrl\`].OutputValue' --output text --region $REGION 2>/dev/null || echo 'Check AWS Console')"
        ;;
    *)
        echo "Usage: ./deploy.sh [all|backend|frontend|gateway]"
        exit 1
        ;;
esac

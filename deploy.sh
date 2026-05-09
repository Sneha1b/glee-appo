#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
EC2_HOST="54.162.176.5"
EC2_USER="ec2-user"
KEY_FILE="${KEY_FILE:-~/Downloads/schedora-key.pem}"   # override with: KEY_FILE=~/other.pem ./deploy.sh

AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO="schedora-aws"
ECR_URL="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"

CONTAINER_NAME="schedora"
ENV_FILE="~/.env"
# ─────────────────────────────────────────────────────────────────────────────

SSH="ssh -i $KEY_FILE $EC2_USER@$EC2_HOST"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Schedora — Deploy to AWS         ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  ECR: $ECR_URL"
echo "  EC2: $EC2_HOST"
echo ""

# Step 1
echo "[1/5] Building Docker image for linux/amd64..."

# Read VITE_* vars from local .env so they get baked into the client bundle
source <(grep "^VITE_" .env | sed 's/^/export /')

docker build --platform linux/amd64 \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
  --build-arg VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID" \
  -t "$ECR_REPO" .
echo "      ✓ Build complete"
echo ""

# Step 2
echo "[2/5] Authenticating to ECR and pushing image..."
echo "      Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "      Tagging image..."
docker tag "$ECR_REPO:latest" "$ECR_URL:latest"

echo "      Pushing to ECR (EC2 will pull from here — no laptop upload)..."
docker push "$ECR_URL:latest"
echo "      ✓ Image pushed to ECR"
echo ""

# Step 3
echo "[3/5] Authenticating EC2 to ECR..."
$SSH "aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
echo "      ✓ EC2 authenticated to ECR"
echo ""

# Step 4
echo "[4/5] Pulling image on EC2 and restarting container..."
$SSH "
  echo '      Pulling latest image from ECR...'
  docker pull $ECR_URL:latest

  echo '      Stopping old container...'
  docker stop $CONTAINER_NAME 2>/dev/null && echo '      Old container stopped' || echo '      No running container to stop'
  docker rm   $CONTAINER_NAME 2>/dev/null || true

  echo '      Starting new container...'
  docker run -d --name $CONTAINER_NAME --restart unless-stopped \
    --env-file $ENV_FILE -p 3000:3000 $ECR_URL:latest
  echo '      Container started'
"
echo "      ✓ Container is running"
echo ""

# Step 5
echo "[5/5] Waiting for app to boot (3s) then checking logs..."
sleep 3
$SSH "docker logs --tail 20 $CONTAINER_NAME"
echo ""

echo "══════════════════════════════════════════════"
echo "  Done! App should be live at:"
echo "  https://${EC2_HOST//./-}.nip.io"
echo "══════════════════════════════════════════════"
echo ""

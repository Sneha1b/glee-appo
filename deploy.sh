#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
EC2_HOST="54.162.176.5"
EC2_USER="ec2-user"
KEY_FILE="${KEY_FILE:-~/schedora-key.pem}"   # override with: KEY_FILE=~/other.pem ./deploy.sh
IMAGE_NAME="schedora-aws"
CONTAINER_NAME="schedora"
ENV_FILE="~/.env"
# ─────────────────────────────────────────────────────────────────────────────

SSH="ssh -i $KEY_FILE $EC2_USER@$EC2_HOST"

echo "==> Building image for linux/amd64..."
docker build --platform linux/amd64 -t "$IMAGE_NAME" .

echo "==> Transferring image to EC2..."
docker save "$IMAGE_NAME" | gzip | $SSH "docker load"

echo "==> Restarting container on EC2..."
$SSH "
  docker stop $CONTAINER_NAME 2>/dev/null || true
  docker rm   $CONTAINER_NAME 2>/dev/null || true
  docker run -d --name $CONTAINER_NAME --restart unless-stopped \
    --env-file $ENV_FILE -p 3000:3000 $IMAGE_NAME
"

echo "==> Container logs (last 20 lines)..."
sleep 3
$SSH "docker logs --tail 20 $CONTAINER_NAME"

echo ""
echo "Done. App should be live at https://${EC2_HOST//./-}.nip.io"

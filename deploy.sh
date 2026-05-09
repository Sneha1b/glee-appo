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

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Schedora — Deploy to AWS         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Step 1
echo "[1/5] Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -t "$IMAGE_NAME" .
echo "      ✓ Build complete"
echo ""

# Step 2
echo "[2/5] Saving and compressing image..."
echo "      (this may take a minute — image is being gzipped)"
docker save "$IMAGE_NAME" | gzip > /tmp/schedora-aws.tar.gz
echo "      ✓ Image saved to /tmp/schedora-aws.tar.gz"
echo ""

# Step 3
echo "[3/5] Transferring image to EC2 at $EC2_HOST..."
echo "      (transfer size: $(du -sh /tmp/schedora-aws.tar.gz | cut -f1))"
cat /tmp/schedora-aws.tar.gz | $SSH "docker load"
rm /tmp/schedora-aws.tar.gz
echo "      ✓ Image loaded on EC2"
echo ""

# Step 4
echo "[4/5] Stopping old container and starting new one..."
$SSH "
  echo '      Stopping old container...'
  docker stop $CONTAINER_NAME 2>/dev/null && echo '      Old container stopped' || echo '      No running container to stop'
  docker rm   $CONTAINER_NAME 2>/dev/null || true
  echo '      Starting new container...'
  docker run -d --name $CONTAINER_NAME --restart unless-stopped \
    --env-file $ENV_FILE -p 3000:3000 $IMAGE_NAME
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

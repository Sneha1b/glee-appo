# Hosting on AWS (keeping Supabase)

This plan moves the web app from Cloudflare Workers to an AWS EC2 instance
while keeping Supabase entirely intact — same users, same data, same auth.

## What changed in the codebase

| File | Change |
|---|---|
| `Dockerfile` | Build command switched from `bun run build` (Cloudflare preset) to `bunx vite build --config vite.config.aws.ts` (Node SSR preset) |
| `package.json` | Added `build:aws` script for local testing |

`vite.config.aws.ts` already existed and targets Nitro's `node-server` preset,
which emits `.output/server/index.mjs` — the entry point the Dockerfile runs.

---

## AWS Infrastructure Setup

> **Skip** `aws/AWS_CONSOLE_SETUP.md` sections 1 (Cognito), 2 (S3), and 4 (RDS)
> — those are only needed if you later replace Supabase with native AWS services.

### 1. Security Group

In **EC2 → Security Groups → Create security group**:

- Name: `schedora-ec2-sg`
- VPC: default
- Inbound rules:
  - SSH (22) → My IP
  - HTTP (80) → 0.0.0.0/0
  - HTTPS (443) → 0.0.0.0/0
- Outbound: All traffic (default)

### 2. IAM Role for EC2

In **IAM → Roles → Create role**:

- Trusted entity: AWS service → EC2
- No extra policies needed (Supabase runs over HTTPS — no AWS SDK calls)
- Role name: `schedora-ec2-role`

### 3. Launch EC2 Instance

In **EC2 → Instances → Launch instances**:

- Name: `schedora-web`
- AMI: Amazon Linux 2023 (free tier eligible)
- Instance type: `t3.micro`
- Key pair: create `schedora-key` → download `.pem` → `chmod 600 schedora-key.pem`
- Network: default VPC, public subnet, auto-assign public IP enabled
- Security group: `schedora-ec2-sg`
- Storage: 30 GB gp3
- Advanced details → IAM instance profile: `schedora-ec2-role`

Note the **Public IPv4 address** after launch (e.g. `3.91.12.34`).
Your HTTPS URL will be: `https://3-91-12-34.nip.io` (dots → dashes).

---

## Server Setup (SSH into EC2)

```bash
ssh -i schedora-key.pem ec2-user@<public-ip>
```

### Install Docker

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# Log out and back in so the group takes effect
```

### Install Caddy (HTTPS reverse proxy)

```bash
sudo dnf install -y 'dnf-command(copr)'
sudo dnf copr enable -y @caddy/caddy
sudo dnf install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```
<YOUR_PUBLIC_IP>.nip.io {
  reverse_proxy localhost:3000
}
```

```bash
sudo systemctl enable --now caddy
```

---

## Environment Variables

Create `~/.env` on the EC2 instance:

```bash
VITE_SUPABASE_URL=https://gwqxrqrtwkzrclthakjl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your Supabase anon key>
SUPABASE_URL=https://gwqxrqrtwkzrclthakjl.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your Supabase anon key>
NODE_ENV=production
PORT=3000
```

Both `VITE_` and non-prefixed vars are needed: `VITE_*` are baked into the
client bundle at build time; the bare names are read by the SSR server at runtime.

---

## Build and Deploy

Run these from your local machine each time you deploy:

```bash
# 1. Build the Docker image
docker build -t schedora-aws .

# 2. Transfer to EC2
docker save schedora-aws | gzip | ssh -i schedora-key.pem ec2-user@<ip> 'docker load'

# 3. (On EC2) stop old container and start new one
ssh -i schedora-key.pem ec2-user@<ip> '
  docker stop schedora 2>/dev/null; docker rm schedora 2>/dev/null
  docker run -d --name schedora --restart unless-stopped \
    --env-file ~/.env -p 3000:3000 schedora-aws
'
```

### Health check

```bash
curl https://<your-ip>.nip.io/api/health
# expect: 200 OK
```

---

## Cost Guardrails

1. **Billing → Budgets → Create budget** → Zero-spend budget → email alert at $0.01
2. **Billing → Free tier alerts** → enable

---

## Common Gotchas

- **Public IP changes** on stop/start — use an Elastic IP (free while attached to a running instance)
- **Caddy cert fails** — port 80 must be open (HTTP-01 ACME challenge)
- **`VITE_` vars must be set at build time** — they are baked into the JS bundle by Vite; changing them in `.env` on EC2 requires a rebuild and redeploy

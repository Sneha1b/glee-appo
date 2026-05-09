# Deploying Schedora to AWS — Free Tier, No Domain, No Data Migration

Goal: get the app running on a brand-new AWS account at **$0/month** for the first 12 months, accessible via an AWS-provided URL — no domain purchase, no data migration from Supabase. You'll re-create dummy data after deploy.

---

## What "free" means on AWS

**12-month free tier** (new accounts):
- **EC2**: 750 hrs/mo `t3.micro`
- **RDS**: 750 hrs/mo `db.t3.micro` MySQL, 20 GB storage
- **S3**: 5 GB, 20k GET, 2k PUT
- **Data out**: 100 GB/mo

**Always free**:
- **Cognito**: 10k MAU
- **Lambda**: 1M req/mo

**Avoid (cost money even on free tier)**:
- NAT Gateway (~$32/mo) → put EC2 in a public subnet
- ALB (~$18/mo) → users hit EC2 directly
- Route 53 hosted zone (~$0.50/mo) → no domain needed
- Secrets Manager (~$0.40/secret/mo) → use plain env vars on the box

---

## Architecture

```text
users → http(s) → EC2 t3.micro (public subnet)
                    ├── Caddy (port 80/443, auto Let's Encrypt)
                    ├── Docker: Schedora SSR (port 3000)
                    └── private SG to ↓
                  RDS db.t3.micro MySQL (empty schema, no data import)

S3 bucket (business-images, public read)
Cognito User Pool (auth)
```

URL: `https://<ip>.nip.io` (free wildcard DNS that resolves to the IP — Caddy fetches a real Let's Encrypt cert automatically).

---

## HTTPS without a domain

AWS won't issue ACM certs for `*.amazonaws.com`. Options:
1. **HTTP only** — works for demos but breaks modern browser features.
2. **`nip.io` + Caddy** ← recommended. Zero cost, real HTTPS, no signup. URL like `https://3-91-12-34.nip.io`.
3. **Self-signed cert** — scary browser warnings.

---

## Step-by-step

### 1. Repo prep (the real work, ~2–3 weeks)

1. Add `Dockerfile` (Node 20 base, `node .output/server/index.mjs`, port 3000).
2. Add `/api/health` route returning 200.
3. Remove `wrangler.jsonc` and Cloudflare bits from `vite.config.ts`; emit Node SSR target.
4. **Replace the Supabase layer** (this is the bulk of the work):
   - **DB**: Drizzle ORM against MySQL 8. Port the Postgres schema → MySQL (`uuid`→`CHAR(36)`, `gen_random_uuid()`→`(UUID())`, `timestamptz`→`TIMESTAMP`, `tstzrange`→explicit predicates, `jsonb`→`JSON`, `enum`→MySQL `ENUM(...)`).
   - **RLS gone** → all auth checks move into TypeScript service functions / route middleware.
   - **RPCs** (`acquire_slot_lock`, `confirm_booking`, `assign_my_role`, `get_booked_slots`, etc.) → re-implement as transactions with `SELECT ... FOR UPDATE`.
   - **Auth**: Amazon Cognito User Pool replaces Supabase Auth. Sign-in via `InitiateAuthCommand` / `USER_PASSWORD_AUTH`, session in httpOnly cookie.
   - **Storage**: presigned S3 PUT URLs from a server function.
   - **Drop email + cron** (already decided in earlier phases).

### 2. Create AWS resources (Console clicks, ~1 hour)

**Cognito**: Create User Pool → email + password, self-service signup, auto-confirm ON. Save `User Pool ID` + `App Client ID`.

**S3**: Create bucket `schedora-images-<rand>`, public-read policy on `GetObject`, CORS for your EC2 hostname.

**VPC**: Use the **default VPC** — comes free with every account.

**RDS**: Create database → MySQL 8.0 → **Free tier** template → `db.t3.micro` → 20 GB gp3 → Multi-AZ **No** → Public access **No** → SG allows 3306 from EC2's SG only. Save master password to a text file.

**EC2**: Launch instance → Amazon Linux 2023 → `t3.micro` → default VPC public subnet → auto-assign public IP → SG opens 22 (your IP), 80, 443 → 30 GB gp3 storage → create key pair, download `.pem`. Attach IAM role with `AmazonS3FullAccess` + Cognito permissions.

### 3. Set up the EC2 box (~20 min)

```bash
ssh -i schedora.pem ec2-user@<public-dns>

sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Caddy for free auto-HTTPS via nip.io
sudo dnf install -y 'dnf-command(copr)'
sudo dnf copr enable -y @caddy/caddy
sudo dnf install -y caddy
```

`/etc/caddy/Caddyfile`:
```text
<public-ip>.nip.io {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl enable --now caddy
```

### 4. Deploy the app

```bash
# On your laptop
docker build -t schedora .
docker save schedora | gzip > schedora.tar.gz
scp -i schedora.pem schedora.tar.gz ec2-user@<dns>:~

# On EC2
docker load < schedora.tar.gz
docker run -d --name schedora --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_URL='mysql://admin:<pw>@<rds-endpoint>:3306/schedora' \
  -e COGNITO_USER_POOL_ID=... \
  -e COGNITO_CLIENT_ID=... \
  -e S3_BUCKET=schedora-images-xxxx \
  -e AWS_REGION=us-east-1 \
  schedora
```

### 5. Initialize the database (schema only, no data import)

From EC2 (RDS is private):
```bash
mysql -h <rds-endpoint> -u admin -p
> CREATE DATABASE schedora;
> exit

# Run Drizzle migrations to create empty tables
docker exec schedora bun run db:migrate
```

That's it for the database. **No `pg_dump`, no data transformation, no Cognito user import.** You start with a clean schema.

### 6. Re-create dummy data

Two ways, pick whichever feels easier:

**Option A — through the UI** (recommended, validates the full flow):
1. Open `https://<ip>.nip.io`
2. Sign up a provider account → create a business → add staff, services, hours
3. Sign up a customer account → book an appointment

**Option B — seed script** (faster, repeatable):
- Add `scripts/seed.ts` that uses Drizzle + Cognito Admin SDK to insert users, businesses, services, etc.
- Run once: `docker exec schedora bun run scripts/seed.ts`
- Useful if you'll redeploy frequently.

### 7. Smoke test

Sign up provider → create business → upload logo (S3) → create service → book as customer → confirm booking saves to RDS.

---

## Cost

| | Free tier (12 mo) | After |
|---|---|---|
| EC2 t3.micro 24/7 | $0 | ~$7.50 |
| RDS db.t3.micro 24/7 + 20 GB | $0 | ~$17 |
| S3 (small) | $0 | pennies |
| Cognito (<10k MAU) | $0 always | $0 |
| Caddy / nip.io | $0 always | $0 |
| **Total** | **$0/mo** | **~$25/mo** |

---

## What you give up

| Production | Free-tier |
|---|---|
| Multi-AZ RDS | Single AZ; if AZ fails, downtime |
| ECS Fargate autoscaling | One EC2 box |
| ALB + zero-downtime deploys | `docker stop && docker run` (~10s downtime) |
| CloudFront CDN | Direct EC2 hits |
| Custom domain + ACM | `*.nip.io` URL |
| Secrets Manager | Plaintext env vars on the box |
| GitHub Actions CI/CD | Manual `scp` + `docker run` |
| **Existing Supabase data** | **Empty DB, you re-seed** |

Fine for: demos, learning, MVPs, internal tools.
Not fine for: paying customers, regulated data, anything that can't tolerate a few hours down.

---

## Realistic timeline

| Phase | Effort |
|---|---|
| Dockerfile + remove Cloudflare + health route | 1–2 days |
| Supabase → MySQL/Cognito/S3 rewrite | 2–3 weeks (unavoidable) |
| AWS console setup | 1–2 hours |
| Deploy + Caddy + smoke test | half a day |
| Seed dummy data | 1–2 hours |
| **Total** | **~3 weeks** (rewrite dominates) |

---

## Recommendation

Skipping data migration saves ~3 days of `pg_dump` → MySQL transform → Cognito bulk import work, plus the password-reset flow for migrated users. The 3-week Supabase-rewrite cost is unchanged either way.

If your only goal is "see it running on AWS for free," this plan delivers that. If you'll later want production AWS (Multi-AZ, ALB, custom domain), the rewrite work transfers 1:1 — only the infra layer changes.

Want me to start with the Dockerfile + health route + Cloudflare removal PR, or scaffold the Drizzle MySQL schema first?

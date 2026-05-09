# AWS Console Setup — click-by-click (Free Tier, ~1 hour)

Prerequisites: a brand-new AWS account (free tier eligible), a credit card on file (won't be charged), and root login.

**Region:** pick ONE region and use it for everything (e.g., `us-east-1`). Mixing regions = pain.

---

## 0. Lock down the root account (5 min)

1. **IAM → Users → Create user** → name `admin` → check "Provide user access to AWS Management Console" → "I want to create an IAM user" → set password → next → **Attach policies directly** → check `AdministratorAccess` → create.
2. Sign out, sign back in as `admin`. Don't use root again.
3. **IAM → Security credentials (root user) → Multi-factor authentication → Activate MFA**. Use Authy / 1Password.

---

## 1. Cognito User Pool (10 min)

1. **Cognito → User pools → Create user pool**.
2. Sign-in options: **Email**. Next.
3. Password policy: **Cognito defaults**. MFA: **No MFA** (free tier demo). Self-service recovery: ✅. Next.
4. Self-service sign-up: ✅. Cognito-assisted verification: **Don't send messages** (we'll auto-confirm). Required attributes: `email`. Next.
5. Email provider: **Send email with Cognito** (free, low volume). Next.
6. User pool name: `schedora-pool`. App client: **Public client**, name `schedora-web`. Auth flows: ✅ **ALLOW_USER_PASSWORD_AUTH**, ✅ **ALLOW_REFRESH_TOKEN_AUTH**. Next → Create.
7. Open the pool → **User pool overview** → copy **User pool ID** (e.g., `us-east-1_AbCdEfGhI`).
8. **App integration tab** → scroll to **App clients** → click your client → copy **Client ID**.
9. **Sign-up experience tab** → Attribute verification → **Cognito will automatically verify ... emails**: leave on. To skip the email confirmation step entirely, add a **Pre sign-up Lambda trigger** that sets `event.response.autoConfirmUser = true` (optional; otherwise users click the email link).

Save somewhere safe:
```
COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
COGNITO_CLIENT_ID=1abcdefghijklmnop23456789
```

---

## 2. S3 bucket (5 min)

1. **S3 → Create bucket**. Name: `schedora-images-<random>` (must be globally unique). Region: same as Cognito.
2. **Object Ownership:** ACLs disabled (Bucket owner enforced).
3. **Block Public Access:** UNCHECK "Block all public access". Acknowledge the warning. (We need public read for served images.)
4. Bucket Versioning: Disable. Encryption: SSE-S3 (default). Create.
5. Open bucket → **Permissions → Bucket policy → Edit**. Paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicRead",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::schedora-images-XXXX/*"
     }]
   }
   ```
6. **Permissions → CORS → Edit**:
   ```json
   [{
     "AllowedHeaders": ["*"],
     "AllowedMethods": ["GET", "PUT"],
     "AllowedOrigins": ["*"],
     "ExposeHeaders": ["ETag"]
   }]
   ```
   (After deploy, tighten `AllowedOrigins` to `https://<your-ip>.nip.io`.)

Save: `S3_BUCKET=schedora-images-XXXX`

---

## 3. Security Groups (5 min, do this BEFORE RDS/EC2)

**EC2 → Security Groups → Create security group**.

**SG #1 — `schedora-ec2-sg`** (for the EC2 box)
- VPC: default
- Inbound:
  - SSH (22) → My IP
  - HTTP (80) → 0.0.0.0/0
  - HTTPS (443) → 0.0.0.0/0
- Outbound: All traffic (default).

**SG #2 — `schedora-rds-sg`** (for the database)
- VPC: default
- Inbound:
  - MySQL/Aurora (3306) → **Source: `schedora-ec2-sg`** (pick the SG, not an IP)
- Outbound: All (default).

---

## 4. RDS MySQL (15 min — slowest step, instance takes ~10 min to provision)

1. **RDS → Databases → Create database**.
2. **Standard create** → **MySQL** → version 8.0.x → **Templates: Free tier**.
3. Settings:
   - DB instance identifier: `schedora-db`
   - Master username: `admin`
   - Master password: generate a strong one, **save it**.
4. Instance config: `db.t3.micro` (auto-selected by Free tier).
5. Storage: 20 GB gp3, **uncheck "Enable storage autoscaling"** (avoid surprise bills).
6. Connectivity:
   - VPC: default
   - Public access: **No**
   - VPC security group: **Choose existing → `schedora-rds-sg`** (remove `default`)
   - Availability zone: any
7. Database authentication: Password authentication.
8. Additional configuration:
   - Initial database name: `schedora`
   - Backup retention: 0 days (free tier — adjust later)
   - Enable encryption: ✅
   - Disable enhanced monitoring & performance insights (free tier limits)
9. Create database. Wait ~10 min until status = **Available**.
10. Click the DB → copy the **Endpoint** (e.g., `schedora-db.abcdef.us-east-1.rds.amazonaws.com`).

Save:
```
DATABASE_URL=mysql://admin:<password>@schedora-db.abcdef.us-east-1.rds.amazonaws.com:3306/schedora
```

---

## 5. IAM Role for EC2 (5 min)

EC2 needs to call S3 and Cognito without baking AWS keys into the container.

1. **IAM → Roles → Create role**.
2. Trusted entity: **AWS service** → Use case: **EC2** → Next.
3. Attach policies:
   - `AmazonS3FullAccess` (or scope tighter to your bucket later)
   - `AmazonCognitoPowerUser`
4. Role name: `schedora-ec2-role`. Create.

---

## 6. EC2 instance (10 min)

1. **EC2 → Instances → Launch instances**.
2. Name: `schedora-web`.
3. AMI: **Amazon Linux 2023** (free tier eligible).
4. Instance type: `t3.micro` (free tier).
5. Key pair: **Create new** → `schedora-key` → RSA → .pem → download. **Save it; AWS won't show it again.** `chmod 600 schedora-key.pem`.
6. Network settings → **Edit**:
   - VPC: default
   - Subnet: any public subnet
   - Auto-assign public IP: **Enable**
   - Firewall: **Select existing security group** → `schedora-ec2-sg`.
7. Storage: 30 GB gp3 (free tier allows up to 30 GB).
8. **Advanced details → IAM instance profile → `schedora-ec2-role`**.
9. Launch instance. Copy the **Public IPv4 address** (e.g., `3.91.12.34`).

Your URL will be: `https://3-91-12-34.nip.io` (dots become dashes).

---

## 7. Smoke test connectivity (2 min)

```bash
ssh -i schedora-key.pem ec2-user@<public-ip>
# inside the box:
nslookup <rds-endpoint>          # should resolve
sudo dnf install -y mariadb105    # provides mysql client
mysql -h <rds-endpoint> -u admin -p   # type RDS password → should connect
> SHOW DATABASES;                 # should list `schedora`
> exit
```

If `mysql` hangs, your `schedora-rds-sg` doesn't allow the EC2 SG — fix that before going further.

---

## 8. Continue with `.lovable/plan.md` step 3 (install Docker + Caddy + deploy)

You now have all the values needed for the `docker run` command:

```
COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
COGNITO_CLIENT_ID=1abcdefghijklmnop23456789
S3_BUCKET=schedora-images-XXXX
AWS_REGION=us-east-1
DATABASE_URL=mysql://admin:<password>@<rds-endpoint>:3306/schedora
```

---

## Cost guardrails (do once)

1. **Billing → Budgets → Create budget** → Zero-spend budget → email alert at $0.01. You'll get an email if anything ever bills.
2. **Billing → Free tier alerts**: enable. Sends warning at 85% of any free-tier limit.

---

## Common gotchas

- **RDS in wrong VPC** → EC2 can't reach it. Always use **default VPC** for both.
- **EC2 in private subnet** → no public IP → can't SSH. Always pick a public subnet with auto-assign IP on.
- **Forgot to attach IAM role at launch** → the AWS SDK in the container can't find creds. Fix: **EC2 → Actions → Security → Modify IAM role** (no restart needed; SDK refreshes within minutes).
- **`*.nip.io` cert fails** → port 80 must be open on the SG (Caddy uses HTTP-01 challenge).
- **Public IP changes if you stop/start the instance** → use an **Elastic IP** (free while attached to a running instance) and re-point Caddyfile.

# ECR Setup — one-time steps

Instead of transferring the Docker image from your laptop to EC2 (slow),
this setup pushes the image to Amazon ECR and lets EC2 pull it over AWS's
internal network (fast, no laptop upload after step 1).

```
Mac → build → push to ECR  (~2 min upload once)
EC2 → pull from ECR        (~20 sec over AWS internal network)
```

---

## 1. Install AWS CLI on your Mac

```bash
brew install awscli
```

Verify: `aws --version`

---

## 2. Create an IAM user for your Mac (deploy credentials)

1. **IAM → Users → Create user** → name `schedora-deploy`
2. **Attach policies directly** → `AmazonEC2ContainerRegistryFullAccess` + `AmazonEC2ReadOnlyAccess`
3. After creating → **Security credentials tab → Create access key** → CLI use case
4. Copy the **Access Key ID** and **Secret Access Key**

Configure the CLI on your Mac:

```bash
aws configure
# AWS Access Key ID: <paste key id>
# AWS Secret Access Key: <paste secret>
# Default region name: us-east-1
# Default output format: json
```

Verify: `aws sts get-caller-identity` should return your account ID.

---

## 3. Create the ECR repository

```bash
aws ecr create-repository --repository-name schedora-aws --region us-east-1
```

You'll get back a `repositoryUri` like:
`123456789012.dkr.ecr.us-east-1.amazonaws.com/schedora-aws`

---

## 4. Add ECR pull permission to the EC2 IAM role

EC2 needs permission to pull images from ECR.

1. **IAM → Roles → schedora-ec2-role → Add permissions → Attach policies**
2. Add: `AmazonEC2ContainerRegistryReadOnly`

No restart needed — the EC2 instance picks up the new policy within minutes.

---

## 5. Install AWS CLI on EC2

SSH into EC2 and run:

```bash
sudo dnf install -y awscli
aws --version
```

The EC2 IAM role provides credentials automatically — no `aws configure` needed on EC2.

---

## 6. Run the deploy script

```bash
./deploy.sh
```

That's it. Every future deploy is just `./deploy.sh` — build on Mac, push to ECR,
EC2 pulls and restarts. No large file transfers over your home connection.

# AWS Migration Layer

This directory is the **parallel** MySQL/Cognito/S3 implementation that
replaces Supabase when the app runs on AWS. **Nothing in `src/` imports
from here yet** — the Lovable preview keeps using Supabase. You wire
this up on your AWS deploy branch by:

1. Updating `package.json` deps (see "Install" below).
2. Setting env vars (see `.env.aws.example`).
3. Replacing imports of `@/integrations/supabase/*` with `@/aws/*` in
   route loaders, server fns, and components, one file at a time.
4. Deleting the `supabase/` directory and `src/integrations/supabase/`
   when the swap is complete.

## Install

```bash
bun add drizzle-orm mysql2 \
  @aws-sdk/client-cognito-identity-provider \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  jose
bun add -D drizzle-kit
```

## Env vars (server-only — no `VITE_` prefix)

```
DATABASE_URL=mysql://admin:PASS@RDS_ENDPOINT:3306/schedora
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxx
COGNITO_JWKS_URL=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxx/.well-known/jwks.json
S3_BUCKET=schedora-images-xxxx
```

When the EC2 instance has an IAM role attached, the AWS SDK picks
credentials up automatically — no `AWS_ACCESS_KEY_ID` needed.

## Layout

```
aws/
├── db/
│   ├── schema.ts          Drizzle MySQL schema (port of public.* tables)
│   ├── client.ts          mysql2 pool + drizzle instance
│   └── migrate.ts         one-shot migration runner (called by container)
├── auth/
│   ├── cognito.ts         signUp / signIn / refresh wrappers
│   └── verify.ts          verify Cognito JWT, return user claims
├── storage/
│   └── s3.ts              presigned PUT/GET URLs for business-images
├── services/
│   ├── booking.ts         confirm_booking + acquire_slot_lock (transactional)
│   ├── business.ts        create_business_with_owner equivalent
│   ├── role.ts            has_role + assign_my_role equivalents
│   └── slots.ts           get_booked_slots equivalent
└── drizzle.config.ts      points drizzle-kit at schema.ts
```

## What's deliberately NOT here yet

- **No emails**: per plan, Resend is dropped. Booking confirmation just
  writes the invoice and returns it.
- **No cron**: `cleanup_expired_invoices` is dropped. Add it later as a
  Lambda on EventBridge if invoice retention becomes a problem.
- **No `assign_my_role` upgrade-via-invite logic**: simplified to just
  insert. The pending-invites flow can be ported once the basics work.
- **No `cancel_out_of_hours_bookings` / `get_business_metrics`**:
  large analytics queries — port last, after the booking flow works.

/**
 * S3 helpers for the business-images bucket.
 * Replaces Supabase Storage's `business-images` bucket.
 *
 * Conventions ported from the current code:
 *   - public-read bucket
 *   - object key prefix matches the user's id (Cognito sub):
 *       <userSub>/<businessId>/<filename>
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_REGION ?? "us-east-1";
const bucket = process.env.S3_BUCKET;

const s3 = new S3Client({ region });

function requireBucket(): string {
  if (!bucket) throw new Error("S3_BUCKET is not set");
  return bucket;
}

export interface PresignedUpload {
  url: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

/**
 * Mint a one-time PUT URL the browser uploads to directly.
 * The handler must verify the caller owns `userSub` before calling this.
 */
export async function presignUpload(opts: {
  userSub: string;
  filename: string;
  contentType: string;
  expiresIn?: number;
}): Promise<PresignedUpload> {
  const safe = opts.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${opts.userSub}/${Date.now()}-${safe}`;
  const cmd = new PutObjectCommand({
    Bucket: requireBucket(),
    Key: key,
    ContentType: opts.contentType,
  });
  const expiresIn = opts.expiresIn ?? 300;
  const url = await getSignedUrl(s3, cmd, { expiresIn });
  return {
    url,
    key,
    publicUrl: publicUrlFor(key),
    expiresIn,
  };
}

export async function presignDownload(key: string, expiresIn = 300): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: requireBucket(), Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

export function publicUrlFor(key: string): string {
  return `https://${requireBucket()}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
}

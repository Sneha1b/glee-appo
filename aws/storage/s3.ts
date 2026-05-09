/**
 * S3 helpers — presigned PUT for browser uploads and a public URL helper.
 *
 * Reads from env at call time (NOT module top-level) so secrets aren't
 * accidentally inlined into client bundles.
 *
 * Required env vars (set on the server only):
 *   AWS_REGION
 *   AWS_S3_BUCKET                (e.g. "schedora-business-images")
 *   AWS_ACCESS_KEY_ID            (IAM user/role with PutObject)
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_S3_PUBLIC_BASE_URL       (optional; defaults to virtual-hosted URL)
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function s3Client() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 not configured (missing AWS_REGION/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY)");
  }
  return new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
}

function bucketName(): string {
  const b = process.env.AWS_S3_BUCKET;
  if (!b) throw new Error("AWS_S3_BUCKET is not set");
  return b;
}

function publicUrlFor(key: string): string {
  const base = process.env.AWS_S3_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/+$/, "")}/${key}`;
  const region = process.env.AWS_REGION!;
  return `https://${bucketName()}.s3.${region}.amazonaws.com/${key}`;
}

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

/**
 * Generate a presigned PUT URL the browser can use to upload directly to S3.
 *
 * The caller is responsible for authorizing the request (e.g. requireUser
 * + scoping the key to the user's id).
 */
export async function presignBusinessImageUpload(input: {
  ownerUserId: string;
  contentType: string;
  ext: string;
}): Promise<PresignedUpload> {
  const safeExt = input.ext.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "bin";
  const key = `${input.ownerUserId}/${crypto.randomUUID()}.${safeExt}`;
  const cmd = new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ContentType: input.contentType,
  });
  const expiresIn = 60 * 5;
  const uploadUrl = await getSignedUrl(s3Client(), cmd, { expiresIn });
  return { uploadUrl, publicUrl: publicUrlFor(key), key, expiresIn };
}

/**
 * Verify a Cognito JWT (ID or access token) using the User Pool's JWKS.
 * Returns claims on success, throws on failure.
 *
 * Usage in a server fn:
 *   const claims = await verifyCognitoJwt(idToken)
 *   const userId = claims.sub  // matches user_roles.user_id
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const jwksUrl = process.env.COGNITO_JWKS_URL;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const region = process.env.AWS_REGION ?? "us-east-1";

function resolveJwksUrl(): URL {
  if (jwksUrl) return new URL(jwksUrl);
  if (!userPoolId) throw new Error("COGNITO_JWKS_URL or COGNITO_USER_POOL_ID required");
  return new URL(
    `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
  );
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(resolveJwksUrl());
  return jwks;
}

export interface CognitoClaims extends JWTPayload {
  sub: string;
  email?: string;
  token_use?: "id" | "access";
  "cognito:username"?: string;
}

export async function verifyCognitoJwt(token: string): Promise<CognitoClaims> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: userPoolId
      ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
      : undefined,
  });
  if (!payload.sub) throw new Error("token_missing_sub");
  return payload as CognitoClaims;
}

/**
 * Extract bearer token from a standard Request.
 */
export function bearerFromRequest(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] ?? null;
}

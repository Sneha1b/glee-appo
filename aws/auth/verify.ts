import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const region = process.env.AWS_REGION ?? "us-east-1";
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;
const explicitJwksUrl = process.env.COGNITO_JWKS_URL;

export interface CognitoClaims extends JWTPayload {
  sub: string;
  email?: string;
  token_use?: "id" | "access";
  "cognito:username"?: string;
  "cognito:groups"?: string[];
  aud?: string;
  client_id?: string;
}

function getIssuer(): string {
  if (!userPoolId) {
    throw new Error("Missing COGNITO_USER_POOL_ID");
  }

  return `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
}

function getJwksUrl(): URL {
  if (explicitJwksUrl) {
    return new URL(explicitJwksUrl);
  }

  return new URL(`${getIssuer()}/.well-known/jwks.json`);
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(getJwksUrl());
  }

  return jwks;
}

export function bearerFromRequest(request: Request): string | null {
  const header =
    request.headers.get("authorization") ??
    request.headers.get("Authorization");

  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function verifyCognitoJwt(token: string): Promise<CognitoClaims> {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: getIssuer(),
  });

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Cognito token missing sub");
  }

  const claims = payload as CognitoClaims;

  if (clientId) {
    const tokenClient = claims.aud ?? claims.client_id;

    if (tokenClient && tokenClient !== clientId) {
      throw new Error("Cognito token client mismatch");
    }
  }

  return claims;
}

export async function requireCognitoUser(request: Request): Promise<{
  cognitoSub: string;
  email: string | null;
  claims: CognitoClaims;
}> {
  const token = bearerFromRequest(request);

  if (!token) {
    throw new Response("Missing Authorization bearer token", { status: 401 });
  }

  try {
    const claims = await verifyCognitoJwt(token);

    return {
      cognitoSub: claims.sub,
      email: claims.email ?? null,
      claims,
    };
  } catch {
    throw new Response("Invalid or expired Cognito token", { status: 401 });
  }
}

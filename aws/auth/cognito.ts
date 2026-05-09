/**
 * Cognito User Pool auth wrappers — replaces Supabase Auth.
 * Email + password only (matches current Schedora UX).
 */
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";

const region = process.env.AWS_REGION ?? "us-east-1";
const clientId = process.env.COGNITO_CLIENT_ID;

if (!clientId && process.env.NODE_ENV === "production") {
  // Don't crash dev; just refuse to call.
  console.warn("COGNITO_CLIENT_ID not set");
}

const cognito = new CognitoIdentityProviderClient({ region });

function requireClientId(): string {
  if (!clientId) throw new Error("COGNITO_CLIENT_ID is not set");
  return clientId;
}

export async function signUp(email: string, password: string) {
  const out = await cognito.send(
    new SignUpCommand({
      ClientId: requireClientId(),
      Username: email,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    }),
  );
  return { userSub: out.UserSub, confirmed: out.UserConfirmed ?? false };
}

export async function confirmSignUp(email: string, code: string) {
  await cognito.send(
    new ConfirmSignUpCommand({
      ClientId: requireClientId(),
      Username: email,
      ConfirmationCode: code,
    }),
  );
}

export async function signIn(email: string, password: string) {
  const out = await cognito.send(
    new InitiateAuthCommand({
      ClientId: requireClientId(),
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  );
  const r = out.AuthenticationResult;
  if (!r?.AccessToken || !r.IdToken || !r.RefreshToken) {
    throw new Error("auth_failed");
  }
  return {
    accessToken: r.AccessToken,
    idToken: r.IdToken,
    refreshToken: r.RefreshToken,
    expiresIn: r.ExpiresIn ?? 3600,
  };
}

export async function refresh(refreshToken: string) {
  const out = await cognito.send(
    new InitiateAuthCommand({
      ClientId: requireClientId(),
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }),
  );
  const r = out.AuthenticationResult;
  if (!r?.AccessToken || !r.IdToken) throw new Error("refresh_failed");
  return {
    accessToken: r.AccessToken,
    idToken: r.IdToken,
    expiresIn: r.ExpiresIn ?? 3600,
  };
}

export async function forgotPassword(email: string) {
  await cognito.send(
    new ForgotPasswordCommand({ ClientId: requireClientId(), Username: email }),
  );
}

export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
) {
  await cognito.send(
    new ConfirmForgotPasswordCommand({
      ClientId: requireClientId(),
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    }),
  );
}

export async function signOutEverywhere(accessToken: string) {
  await cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
}

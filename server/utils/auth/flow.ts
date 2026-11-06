import type { H3Event } from "h3";

/**
 * Short-lived OIDC flow state stored in a separate encrypted cookie during the
 * authorization redirect round-trip. Expires in 10 minutes; cleared on callback.
 * `SameSite=Lax` is intentional — `Strict` would block Okta's redirect back.
 */
export interface FlowSession {
  codeVerifier: string;
  state: string;
  redirect: string;
}

export const FLOW_SESSION_NAME = "peaky_oidc_flow";
export const FLOW_COOKIE_MAX_AGE = 60 * 10; // 10 minutes

export function getFlowSessionConfig(secret: string) {
  return {
    name: FLOW_SESSION_NAME,
    password: secret,
    maxAge: FLOW_COOKIE_MAX_AGE,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
    },
  };
}

export async function useFlowSession(event: H3Event, secret: string) {
  return useSession<FlowSession>(event, getFlowSessionConfig(secret));
}

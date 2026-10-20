import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Authentik from "next-auth/providers/authentik";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshTokenError";
  }
}

// Values pasted into hosting dashboards have arrived with leading tabs; trim everything we read
const env = (key: string): string | undefined => process.env[key]?.trim() || undefined;

// Deployments without an identity provider configured run fully open (no sign-in, /app public)
export const authConfigured = Boolean(env("AUTH_SECRET") && env("AUTH_AUTHENTIK_SECRET"));

const issuer = env("AUTH_AUTHENTIK_ISSUER") ?? "https://accounts.openseldon.org/application/o/openseldon/";
const clientId = env("AUTH_AUTHENTIK_ID") ?? "openseldon-web";
const clientSecret = env("AUTH_AUTHENTIK_SECRET");
// Authentik's token endpoint is shared across providers, not under the per-app issuer path
const tokenEndpoint = new URL("/application/o/token/", issuer).toString();

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) return { ...token, error: "RefreshTokenError" };
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: clientId,
      client_secret: clientSecret ?? "",
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ...token, error: "RefreshTokenError" };
  return {
    ...token,
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 3600),
    refreshToken: data.refresh_token ?? token.refreshToken,
    error: undefined,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: env("AUTH_SECRET"),
  session: { strategy: "jwt" },
  providers: [
    Authentik({
      clientId,
      clientSecret,
      issuer,
      authorization: { params: { scope: "openid email profile offline_access" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});

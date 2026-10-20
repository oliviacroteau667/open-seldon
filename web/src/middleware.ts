import type { NextRequest } from "next/server";
import { auth, authConfigured } from "@/auth";

// The dashboard requires a session; everything else (landing, public map) stays open.
const gate = auth((req) => {
  if (req.auth) return;
  const signIn = new URL("/api/auth/signin", req.nextUrl);
  signIn.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return Response.redirect(signIn);
});

export default function middleware(req: NextRequest, ctx: unknown) {
  if (!authConfigured) return;
  return (gate as unknown as (r: NextRequest, c: unknown) => unknown)(req, ctx);
}

export const config = {
  matcher: ["/app/:path*"],
};

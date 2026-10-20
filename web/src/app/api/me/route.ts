import { auth, authConfigured } from "@/auth";

const API = (process.env.API_INTERNAL_URL ?? "http://openseldon-api:8000").trim().replace(/\/+$/, "");

// Forwards the signed-in user's access token to the FastAPI /me endpoint
export async function GET() {
  if (!authConfigured) {
    return Response.json({ detail: "auth not configured" }, { status: 503 });
  }
  const session = await auth();
  if (!session?.accessToken || session.error) {
    return Response.json({ detail: "not signed in" }, { status: 401 });
  }
  const res = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

import Link from "next/link";
import { auth, authConfigured } from "@/auth";
import { signInWithAuthentik, signOutEverywhere } from "@/app/actions/auth";

const SANS = "'Instrument Sans', sans-serif";
const pill: React.CSSProperties = {
  font: `500 13px ${SANS}`,
  color: "var(--text)",
  textDecoration: "none",
  padding: "7px 12px",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "none",
  cursor: "pointer",
};

// Server component: knows the session, renders the nav's sign-in / account controls
export default async function AuthButton() {
  if (!authConfigured) {
    return <Link href="/app" style={pill}>Open the map</Link>;
  }
  const session = await auth();
  if (!session?.user) {
    return (
      <form action={signInWithAuthentik.bind(null, "/app")}>
        <button type="submit" style={pill}>Sign in</button>
      </form>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Link href="/app" style={{ ...pill, borderColor: "var(--accent)" }}>Open the map</Link>
      <form action={signOutEverywhere}>
        <button type="submit" title={session.user.email ?? undefined} style={{ ...pill, color: "var(--text-3)" }}>
          Sign out
        </button>
      </form>
    </div>
  );
}

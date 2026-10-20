"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithAuthentik(redirectTo: string = "/app") {
  await signIn("authentik", { redirectTo });
}

export async function signOutEverywhere() {
  await signOut({ redirectTo: "/" });
}

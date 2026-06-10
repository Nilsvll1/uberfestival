import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase-server";
import { AuthPage } from "../components/AuthModal";

export const metadata: Metadata = {
  title: "Sign in | UberFestival",
  description: "Sign in to your UberFestival account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  // Already logged in — send to dashboard.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { redirectTo } = await searchParams;

  if (user) {
    redirect(redirectTo ?? "/dashboard");
  }

  return <AuthPage initialView="sign_in" />;
}

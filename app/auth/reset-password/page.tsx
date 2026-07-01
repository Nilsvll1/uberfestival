import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase-server";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password | UberFestival" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no session, the reset link has expired. Send to login.
  if (!user) redirect("/login?error=reset_expired");

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-5 py-16">
      <ResetPasswordForm />
    </div>
  );
}

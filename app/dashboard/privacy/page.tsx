import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase-server";
import { DEFAULT_LANGUAGE, LANG_COOKIE, isValidLanguage } from "../../../lib/i18n";
import type { NotificationPrefs } from "../../../lib/types";
import PrivacyClient from "./PrivacyClient";

export const metadata: Metadata = { title: "Privacy & data | UberFestival" };

const DEFAULT_PREFS: NotificationPrefs = {
  email_deadlines: true,
  email_new_opportunities: false,
  email_product_updates: true,
};

export default async function PrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", user.id)
    .single();

  const notificationPrefs: NotificationPrefs =
    (profile?.notification_prefs as NotificationPrefs | null) ?? DEFAULT_PREFS;

  return (
    <PrivacyClient
      lang={lang}
      email={user.email ?? ""}
      notificationPrefs={notificationPrefs}
    />
  );
}

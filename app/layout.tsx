import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import Header from "./components/Header";
import I18nProvider from "./providers/I18nProvider";
import PageTransition from "./components/PageTransition";
import { DEFAULT_LANGUAGE, LANG_COOKIE, isValidLanguage, type Language } from "../lib/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://uberfestival.com"),
  title: "UberFestival — Festival opportunities for music professionals",
  description: "800+ music festival open calls worldwide. Discover opportunities, submit applications, and track deadlines — all in one place.",
  openGraph: {
    title: "UberFestival — Festival opportunities for music professionals",
    description: "800+ music festival open calls worldwide. Your next career opportunity starts here.",
    siteName: "UberFestival",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UberFestival — Festival opportunities for music professionals",
    description: "800+ music festival open calls worldwide. Your next career opportunity starts here.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang: Language = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLang={lang}>
          <Header lang={lang} />
          <PageTransition>{children}</PageTransition>
        </I18nProvider>
      </body>
    </html>
  );
}

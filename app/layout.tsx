import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import Header from "./components/Header";
import I18nProvider from "./providers/I18nProvider";
import { DEFAULT_LANGUAGE, LANG_COOKIE, isValidLanguage, type Language } from "../lib/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UberFestival",
  description: "Discover music festivals worldwide and submit your applications.",
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
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}

import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AtomAdapt — Smart LMS for atomcamp",
  description:
    "Learner DNA–powered adaptive learning: AI onboarding, semantic recommendations, tutor, and instructor intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-grid antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

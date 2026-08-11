import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "KahitaNiPangs | Cash Book",
  description: "A simple Philippine peso cash book for cash in, cash out, and budgets.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/kp-wallet-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/kp-wallet-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "KahitaNiPangs" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("font-sans", geistSans.variable)}
      suppressHydrationWarning
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider defaultTheme="light" enableSystem={false}><PwaRegister />{children}</ThemeProvider>
      </body>
    </html>
  );
}

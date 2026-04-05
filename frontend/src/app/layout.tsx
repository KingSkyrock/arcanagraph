import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "Arcanagraph",
    template: "%s | Arcanagraph",
  },
  description: "Draw math functions in the air to cast spells and battle your friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={nunito.className}>
      <body suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

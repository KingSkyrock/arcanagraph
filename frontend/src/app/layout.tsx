import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Arcanagraph",
    template: "%s | Arcanagraph",
  },
  description: "Hackathon-ready auth and leaderboard shell for Arcanagraph.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){var b=document.body;var hydrated=Object.keys(b).some(function(k){return k.startsWith("__reactFiber")});if(!hydrated){var d=document.createElement("div");d.style.cssText="position:fixed;top:0;left:0;right:0;z-index:9999;padding:16px 20px;background:#0f1f4b;color:#fff;font:700 15px/1.4 system-ui,sans-serif;text-align:center;border-bottom:2px solid #f59e0b;";d.textContent="This app doesn't work in embedded browsers. Copy the URL and open it in Safari or Chrome.";document.body.prepend(d);}},3000);`,
          }}
        />
        {children}
      </body>
    </html>
  );
}

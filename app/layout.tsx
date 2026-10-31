import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "PactRail — agreement-aware milestone settlement",
    template: "%s · PactRail",
  },
  description:
    "PactRail turns commercial agreements into reviewed, verifiable milestone payments with on-chain escrow on test networks.",
  applicationName: "PactRail",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

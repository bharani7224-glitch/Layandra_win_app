import type { Metadata } from "next";
import "./globals.css";
import "./website.css";

export const metadata: Metadata = {
  title: "NEXORA.DEV — Creative Digital Agency",
  description: "Modern digital experiences that help businesses grow, innovate, and stand out.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

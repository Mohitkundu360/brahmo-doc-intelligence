import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRAHMO — Document Intelligence",
  description: "Legal contract comparison and risk scoring",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

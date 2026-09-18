import type { Metadata } from "next";
import "./globals.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./phase5.css";
import "./phase6.css";
import "./phase7.css";
import "./phase8.css";

export const metadata: Metadata = {
  title: "Minha Escola SaaS",
  description: "SaaS de gestão escolar simples, moderna e integrada.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

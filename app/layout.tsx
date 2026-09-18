import type { Metadata } from "next";
import "./globals.css";
import "./phase2.css";

export const metadata: Metadata = {
  title: "Minha Escola",
  description: "Gestão escolar simples, moderna e integrada.",
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

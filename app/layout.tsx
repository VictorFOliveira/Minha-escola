import type { Metadata } from "next";
import "./globals.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./phase5.css";
import "./phase6.css";
import "./phase7.css";
import "./phase8.css";
import "./phase9.css";
import "./phase10.css";
import "./phase11.css";
import "./hardening.css";

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
      <body>
        <a className="skip-link" href="#main-content">
          Pular para o conteúdo
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}

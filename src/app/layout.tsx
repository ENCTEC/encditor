import type { Metadata } from "next";
import { Cabecalho } from "@/componentes/Cabecalho";
import { AvisoErro } from "@/componentes/AvisoErro";
import { ProjetoProvider } from "@/projeto/ProjetoProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encditor",
  description: "Editor de vídeo com IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex h-screen flex-col overflow-hidden antialiased">
        <ProjetoProvider>
          <Cabecalho />
          <main className="min-h-0 flex-1">{children}</main>
          <AvisoErro />
        </ProjetoProvider>
      </body>
    </html>
  );
}

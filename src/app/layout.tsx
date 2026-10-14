import type { Metadata } from "next";
import { Anton, Archivo, Permanent_Marker, Space_Mono } from "next/font/google";
import { AnaliseAutomatica } from "@/componentes/AnaliseAutomatica";
import { AreaDeTrabalho } from "@/componentes/AreaDeTrabalho";
import { AvisoErro } from "@/componentes/AvisoErro";
import { AvisoNavegador } from "@/componentes/AvisoNavegador";
import { Cabecalho } from "@/componentes/Cabecalho";
import { ProjetoProvider } from "@/projeto/ProjetoProvider";
import "./globals.css";

// Fontes do estilo pôster: títulos condensados e pesados, spray à mão,
// texto corrido grotesco e ficha técnica em monoespaçada.
const titulo = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--fonte-titulo",
});
const spray = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--fonte-spray",
});
const texto = Archivo({ subsets: ["latin"], variable: "--fonte-texto" });
const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--fonte-mono",
});

export const metadata: Metadata = {
  title: "ENCeditor",
  description: "Editor de vídeo com IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${titulo.variable} ${spray.variable} ${texto.variable} ${mono.variable}`}
    >
      <body className="flex h-screen flex-col overflow-hidden font-sans antialiased">
        <ProjetoProvider>
          <AvisoNavegador />
          <Cabecalho />
          <main className="min-h-0 flex-1">
            <AreaDeTrabalho>{children}</AreaDeTrabalho>
          </main>
          <AvisoErro />
          <AnaliseAutomatica />
        </ProjetoProvider>
      </body>
    </html>
  );
}

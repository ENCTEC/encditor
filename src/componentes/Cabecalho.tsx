"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ModalExportar } from "@/componentes/clientes/ModalExportar";
import { ModalNovoVideo } from "@/componentes/clientes/ModalNovoVideo";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { CirculoSpray, SublinhadoSpray } from "./Rabiscos";

// Abas do projeto aberto. "Clientes" fica fora daqui: é a raiz do caminho
// de pastas (Clientes › Cliente › Projeto), ao lado.
const ABAS = [
  { href: "/", rotulo: "Criar" },
  { href: "/timeline", rotulo: "Timeline" },
  { href: "/arquivos", rotulo: "Arquivos" },
  { href: "/estilos", rotulo: "Estilos" },
  { href: "/planejar", rotulo: "Planejar" },
];

const botao =
  "px-2.5 py-1 font-mono text-[11px] tracking-[0.12em] text-zinc-300 uppercase hover:bg-tinta hover:text-papel disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-300";

export const Cabecalho: React.FC = () => {
  const caminho = usePathname();
  const [novoVideo, setNovoVideo] = useState(false);
  const [exportar, setExportar] = useState(false);
  const { desfazer, refazer, podeDesfazer, podeRefazer, salvamento, meta } =
    useProjeto();

  // Ctrl+Z desfaz; Ctrl+Y ou Ctrl+Shift+Z refaz (fora de campos de texto).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "z" && !e.shiftKey) {
        e.preventDefault();
        desfazer();
      } else if (tecla === "y" || (tecla === "z" && e.shiftKey)) {
        e.preventDefault();
        refazer();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [desfazer, refazer]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b-[3px] border-tinta px-4">
      {/* Logo: letras condensadas pretas + assinatura em spray vermelho. */}
      <span className="relative flex items-baseline gap-1.5 pr-2">
        <span className="font-display text-3xl leading-none tracking-tight text-tinta">
          ENCeditor
        </span>
        <span className="-rotate-6 font-marca text-sm text-spray">edit!</span>
        <SublinhadoSpray className="-bottom-2 left-0 h-3 w-32" />
      </span>

      <nav className="flex gap-1">
        {ABAS.map((aba) => {
          const ativa =
            aba.href === "/" ? caminho === "/" : caminho.startsWith(aba.href);
          return (
            <Link
              key={aba.href}
              href={aba.href}
              className={`relative px-4 py-1 font-display text-lg tracking-wide uppercase ${
                ativa ? "text-tinta" : "text-zinc-500 hover:text-tinta"
              }`}
            >
              {aba.rotulo}
              {ativa ? (
                <CirculoSpray className="-inset-x-1 -inset-y-1.5" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Caminho de pastas: Clientes › Cliente › Projeto. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 border-l-2 border-tinta pl-4 font-mono text-[11px] tracking-wider uppercase">
        <Link
          href="/clientes"
          className={`shrink-0 border-2 border-tinta px-2 py-1 ${
            caminho === "/clientes"
              ? "bg-tinta text-papel"
              : "hover:bg-tinta hover:text-papel"
          }`}
          title="Todos os clientes (pastas)"
        >
          📁 Clientes
        </Link>
        {meta ? (
          // Cliente em cima e projeto embaixo: cada nome usa a largura toda.
          <div className="flex min-w-0 flex-col leading-tight">
            <Link
              href={`/clientes/${meta.cliente.id}`}
              className={`truncate text-[10px] hover:text-spray ${
                caminho.startsWith("/clientes/")
                  ? "text-spray"
                  : "text-zinc-500"
              }`}
              title="Ver os projetos e o banco de mídia deste cliente"
            >
              › {meta.cliente.nome}
            </Link>
            <b className="truncate" title={meta.nome}>
              › {meta.nome}
            </b>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span
          className={`mr-3 font-mono text-[11px] tracking-[0.12em] uppercase ${
            salvamento === "erro" ? "text-spray" : "text-zinc-500"
          }`}
          title="O projeto é salvo no banco do servidor"
        >
          {salvamento === "salvando"
            ? "salvando…"
            : salvamento === "erro"
              ? "⚠ não salvou"
              : "✓ salvo"}
        </span>
        <button
          className={botao}
          onClick={desfazer}
          disabled={!podeDesfazer}
          title="Desfazer (Ctrl+Z)"
        >
          ↶ Desfazer
        </button>
        <button
          className={botao}
          onClick={refazer}
          disabled={!podeRefazer}
          title="Refazer (Ctrl+Y)"
        >
          ↷ Refazer
        </button>
        <span className="mx-2 h-5 w-0.5 bg-tinta" />
        <button
          className={botao}
          onClick={() => setNovoVideo(true)}
          title="Cria um vídeo novo, escolhendo o cliente (pasta)"
        >
          Novo vídeo
        </button>
        <button
          className="botao-spray ml-2 !px-3 !py-1 !text-sm"
          onClick={() => setExportar(true)}
          disabled={!meta}
          title="Gera o MP4 final e guarda como uma versão do projeto"
        >
          Exportar
        </button>
      </div>
      {exportar && meta ? (
        <ModalExportar meta={meta} aoFechar={() => setExportar(false)} />
      ) : null}
      {novoVideo ? (
        <ModalNovoVideo
          clienteAtual={meta?.cliente.id ?? null}
          aoFechar={() => setNovoVideo(false)}
        />
      ) : null}
    </header>
  );
};

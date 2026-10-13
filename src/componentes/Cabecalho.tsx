"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { projetoExemplo } from "@/projeto/exemplo";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { CirculoSpray, SublinhadoSpray } from "./Rabiscos";

const ABAS = [
  { href: "/", rotulo: "Criar" },
  { href: "/timeline", rotulo: "Timeline" },
  { href: "/arquivos", rotulo: "Arquivos" },
];

const botao =
  "px-2.5 py-1 font-mono text-[11px] tracking-[0.12em] text-zinc-300 uppercase hover:bg-tinta hover:text-papel disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-300";

export const Cabecalho: React.FC = () => {
  const caminho = usePathname();
  const {
    desfazer,
    refazer,
    podeDesfazer,
    podeRefazer,
    substituirProjeto,
    novoProjeto,
    salvamento,
  } = useProjeto();

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
        <span className="font-display text-3xl leading-none tracking-tight text-tinta uppercase">
          Encditor
        </span>
        <span className="-rotate-6 font-marca text-sm text-spray">edit!</span>
        <SublinhadoSpray className="-bottom-2 left-0 h-3 w-28" />
      </span>

      <nav className="flex gap-1">
        {ABAS.map((aba) => {
          const ativa = caminho === aba.href;
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

      <div className="ml-auto flex items-center gap-1">
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
          onClick={() => substituirProjeto(projetoExemplo())}
        >
          Carregar exemplo
        </button>
        <button
          className={botao}
          onClick={() => {
            if (confirm("Começar um projeto novo? O atual será apagado.")) {
              novoProjeto();
            }
          }}
        >
          Novo projeto
        </button>
      </div>
    </header>
  );
};

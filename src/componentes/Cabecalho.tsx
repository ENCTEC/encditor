"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { projetoExemplo } from "@/projeto/exemplo";
import { useProjeto } from "@/projeto/ProjetoProvider";

const ABAS = [
  { href: "/", rotulo: "Criar" },
  { href: "/timeline", rotulo: "Timeline" },
  { href: "/arquivos", rotulo: "Arquivos" },
];

const botao =
  "rounded-md px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent";

export const Cabecalho: React.FC = () => {
  const caminho = usePathname();
  const {
    desfazer,
    refazer,
    podeDesfazer,
    podeRefazer,
    substituirProjeto,
    novoProjeto,
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
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-zinc-800 bg-zinc-900 px-4">
      <span className="font-semibold tracking-tight">
        Enc<span className="text-violet-400">ditor</span>
      </span>

      <nav className="flex gap-1">
        {ABAS.map((aba) => (
          <Link
            key={aba.href}
            href={aba.href}
            className={`rounded-md px-3 py-1.5 text-sm ${
              caminho === aba.href
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {aba.rotulo}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
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
        <span className="mx-2 h-5 w-px bg-zinc-700" />
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

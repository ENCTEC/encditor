"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Tela "Clientes": as pastas. Cada cliente tem seus vídeos (projetos) e um
// banco de mídia compartilhado entre eles.

type Cliente = {
  id: string;
  nome: string;
  projetos: number;
  midias: number;
};

export default function PaginaClientes() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    const resposta = await fetch("/api/clientes", { cache: "no-store" });
    setClientes(((await resposta.json()) as { clientes: Cliente[] }).clientes);
  };

  useEffect(() => {
    void carregar();
  }, []);

  const criar = async () => {
    if (!nome.trim()) return;
    const resposta = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!resposta.ok) {
      setErro("Não consegui criar o cliente.");
      return;
    }
    setNome("");
    setErro(null);
    await carregar();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="relative inline-block font-display text-6xl leading-none tracking-tight uppercase">
          Clientes
          <span className="absolute -top-5 -right-44 -rotate-12 font-marca text-3xl normal-case text-spray">
            suas pastas!
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm">
          Cada cliente tem os vídeos dele e um <b>banco de mídia</b> próprio:
          tudo o que você sobe fica disponível (e analisado pela IA) para todos
          os vídeos daquele cliente.
        </p>

        <div className="mt-6 flex max-w-xl gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void criar()}
            placeholder="Nome do novo cliente (ex.: Linda Cosméticos)"
            className="min-w-0 flex-1 border-2 border-tinta bg-zinc-950 px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]"
          />
          <button
            onClick={() => void criar()}
            disabled={!nome.trim()}
            className="botao-spray"
          >
            Criar cliente
          </button>
        </div>
        {erro ? <p className="mt-2 text-sm text-spray">{erro}</p> : null}

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(clientes ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/clientes/${c.id}`}
              className="cartao-zine group block p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3">
                <span className="text-4xl">📁</span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-3xl leading-none tracking-wide uppercase group-hover:text-spray">
                    {c.nome}
                  </h2>
                  <p className="mt-2 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
                    {c.projetos} vídeo(s) · {c.midias} arquivo(s) no banco
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {clientes === null ? (
          <p className="mt-8 text-sm text-zinc-500">Carregando…</p>
        ) : null}
      </div>
    </div>
  );
}

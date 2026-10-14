"use client";

import { useEffect, useState } from "react";
import { abrirProjeto } from "@/projeto/ProjetoProvider";

// Criar um vídeo novo escolhendo o CLIENTE (pasta) dele — ou criando um
// cliente novo na hora. Cada cliente tem seu próprio banco de mídia.

type Cliente = { id: string; nome: string; projetos: number; midias: number };

const NOVO = "__novo__";
const campo =
  "w-full border-2 border-tinta bg-zinc-950 px-3 py-2 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]";

export const ModalNovoVideo: React.FC<{
  clienteAtual: string | null;
  aoFechar: () => void;
}> = ({ clienteAtual, aoFechar }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState(clienteAtual ?? NOVO);
  const [nomeCliente, setNomeCliente] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    void fetch("/api/clientes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { clientes: Cliente[] }) => setClientes(d.clientes));
  }, []);

  const criar = async () => {
    if (!nome.trim() || (cliente === NOVO && !nomeCliente.trim())) return;
    setCriando(true);
    setErro(null);
    try {
      let clienteId = cliente;
      if (cliente === NOVO) {
        const r = await fetch("/api/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: nomeCliente.trim() }),
        });
        const d = (await r.json()) as { id?: string };
        if (!d.id) throw new Error("Não consegui criar o cliente.");
        clienteId = d.id;
      }
      const r = await fetch(`/api/clientes/${clienteId}/projetos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() }),
      });
      const d = (await r.json()) as { id?: string };
      if (!d.id) throw new Error("Não consegui criar o vídeo.");
      abrirProjeto(d.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setCriando(false);
    }
  };

  const escolhido = clientes.find((c) => c.id === cliente);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-6"
      onPointerDown={(e) => e.target === e.currentTarget && aoFechar()}
      role="dialog"
      aria-label="Novo vídeo"
    >
      <div className="cartao-zine w-full max-w-md p-5">
        <h2 className="font-display text-3xl leading-none tracking-wide uppercase">
          Novo vídeo
        </h2>

        <label className="mt-5 block">
          <span className="rotulo-zine mb-1 block">Cliente (pasta)</span>
          <select
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className={campo}
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                📁 {c.nome} — {c.projetos} vídeo(s), {c.midias} arquivo(s)
              </option>
            ))}
            <option value={NOVO}>+ Novo cliente…</option>
          </select>
        </label>
        {cliente === NOVO ? (
          <input
            autoFocus
            value={nomeCliente}
            onChange={(e) => setNomeCliente(e.target.value)}
            placeholder="Nome do cliente (ex.: Linda Cosméticos)"
            className={`${campo} mt-2`}
          />
        ) : (
          <p className="mt-1 text-xs text-zinc-500">
            O vídeo vai usar o banco de mídia de {escolhido?.nome ?? "…"}{" "}
            (compartilhado com os outros vídeos desse cliente).
          </p>
        )}

        <label className="mt-4 block">
          <span className="rotulo-zine mb-1 block">Nome do vídeo</span>
          <input
            autoFocus={cliente !== NOVO}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void criar()}
            placeholder="ex.: Promo Dia das Mães #1"
            className={campo}
          />
        </label>

        {erro ? <p className="mt-2 text-sm text-spray">{erro}</p> : null}

        <div className="mt-5 flex gap-2">
          <button
            onClick={aoFechar}
            className="ml-auto border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
          >
            Cancelar
          </button>
          <button
            onClick={() => void criar()}
            disabled={
              criando ||
              !nome.trim() ||
              (cliente === NOVO && !nomeCliente.trim())
            }
            className="botao-spray"
          >
            {criando ? "Criando…" : "Criar e abrir"}
          </button>
        </div>
      </div>
    </div>
  );
};

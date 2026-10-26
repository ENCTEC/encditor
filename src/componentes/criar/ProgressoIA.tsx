"use client";

import { useEffect, useState } from "react";

export type EstadoProgresso = { pct: number; texto: string; inicio: number };

// Barra do chat enquanto a IA trabalha: o que ela está fazendo, a
// porcentagem e há quanto tempo. Entre um aviso e outro do servidor a
// barra continua andando devagar (sem passar muito do último aviso), para
// a pessoa ver que não travou.
export const ProgressoIA: React.FC<{ estado: EstadoProgresso }> = ({ estado }) => {
  const [exibido, setExibido] = useState(estado.pct);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const relogio = setInterval(() => {
      setAgora(Date.now());
      setExibido((atual) => {
        if (atual < estado.pct) {
          return Math.min(estado.pct, atual + Math.max(0.6, (estado.pct - atual) * 0.3));
        }
        const teto = Math.min(estado.pct + 6, 99);
        return atual < teto ? atual + 0.08 : atual;
      });
    }, 250);
    return () => clearInterval(relogio);
  }, [estado.pct]);

  const segundos = Math.max(0, Math.round((agora - estado.inicio) / 1000));
  const pct = Math.max(exibido, 1);
  return (
    <div
      className="cartao-zine w-full max-w-sm px-4 py-3"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={estado.texto}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm leading-snug">{estado.texto}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-spray">
          {Math.floor(pct)}%
        </span>
      </div>
      <div className="mt-2 h-3 border-2 border-tinta bg-papel">
        <div
          className="h-full bg-spray transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
        {segundos}s · a IA confere a edição antes de entregar
      </p>
    </div>
  );
};

// Lê a resposta do /api/ia em linhas JSON: avisos de progresso e, no fim,
// a resposta (ou o erro).
export const lerRespostaComProgresso = async <T,>(
  corpo: ReadableStream<Uint8Array>,
  aoProgresso: (pct: number, texto: string) => void,
): Promise<T> => {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let resto = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (value) resto += decodificador.decode(value, { stream: true });
    const linhas = resto.split("\n");
    resto = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.trim()) continue;
      const evento = JSON.parse(linha) as
        | { tipo: "progresso"; pct: number; texto: string }
        | ({ tipo: "fim" } & T)
        | { tipo: "erro"; erro: string };
      if (evento.tipo === "progresso") aoProgresso(evento.pct, evento.texto);
      else if (evento.tipo === "erro") throw new Error(evento.erro);
      else if (evento.tipo === "fim") return evento;
    }
    if (done) break;
  }
  throw new Error("A conexão com a IA caiu antes do fim. Tente de novo.");
};

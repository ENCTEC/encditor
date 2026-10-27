"use client";

import { useCallback, useEffect, useState } from "react";
import { CotacaoNaTela, dolares, explicarCotacao, reais } from "@/projeto/dinheiro";

// Quanto a IA já custou em cada vídeo (aba Resultados). Os valores vêm da
// tabela "custos" (cada chamada paga anotada no projeto de onde veio) e se
// atualizam sozinhos: a cada 10 s com a aba à vista e ao voltar para ela.

export type PedidoComCusto = {
  projetoId: string | null;
  quando: number;
  tipo: string;
  descricao: string;
  valor: number;
  chamadas: number;
};

export const useCustos = (clienteId: string | null) => {
  const [pedidos, setPedidos] = useState<PedidoComCusto[] | null>(null);
  const [cotacao, setCotacao] = useState<CotacaoNaTela | null>(null);
  const recarregar = useCallback(async () => {
    if (!clienteId) return;
    const r = await fetch(`/api/custos?cliente=${clienteId}`, { cache: "no-store" }).catch(
      () => null,
    );
    if (r?.ok) {
      const d = (await r.json()) as { pedidos: PedidoComCusto[]; cotacao: CotacaoNaTela | null };
      setPedidos(d.pedidos);
      setCotacao(d.cotacao);
    }
  }, [clienteId]);
  useEffect(() => {
    void recarregar();
    const aCada = setInterval(() => {
      if (document.visibilityState === "visible") void recarregar();
    }, 10_000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      clearInterval(aCada);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [recarregar]);
  return { pedidos, cotacao };
};

// Quanto o vídeo tinha custado até um momento (ex.: a exportação).
export const custoAte = (
  pedidos: PedidoComCusto[] | null,
  projetoId: string,
  quando: number,
) =>
  (pedidos ?? [])
    .filter((p) => p.projetoId === projetoId && p.quando <= quando)
    .reduce((soma, p) => soma + p.valor, 0);

const soma = (lista: PedidoComCusto[]) => lista.reduce((s, p) => s + p.valor, 0);

const quandoFoi = (ms: number) =>
  new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// A conta do real, embaixo do quadro.
const Rodape: React.FC<{ cotacao: CotacaoNaTela | null; cliente: boolean }> = ({ cotacao, cliente }) => (
  <p className="text-xs text-zinc-500">
    {cliente
      ? "Conta tudo o que a IA fez em cada vídeo: pedidos no chat (com a conferência), planejamento, análise dos arquivos e voz de exemplo."
      : "Pedidos no chat (com a conferência), planejamento, análise dos arquivos e voz de exemplo."}{" "}
    {cotacao
      ? `Em real: ${explicarCotacao(cotacao)}. O banco do cartão pode cobrar um pouco mais (spread).`
      : "Sem a cotação do dólar agora: valores em dólar."}{" "}
    Preços da OpenAI de 27/10/2026; gastos antes de 26/10 podem estar incompletos.
  </p>
);

export const CustosDaIA: React.FC<{
  cotacao: CotacaoNaTela | null;
  pedidos: PedidoComCusto[] | null;
  projetoId: string | null;
  doCliente: boolean;
  nomes: Record<string, string>;
}> = ({ cotacao, pedidos, projetoId, doCliente, nomes }) => {
  const r = (usd: number) => reais(usd, cotacao);
  const [todos, setTodos] = useState(false);
  if (!pedidos) return null;

  if (doCliente) {
    // Um vídeo por linha, do mais caro para o mais barato.
    const porProjeto = new Map<string, PedidoComCusto[]>();
    for (const p of pedidos) {
      const chave = p.projetoId ?? "";
      porProjeto.set(chave, [...(porProjeto.get(chave) ?? []), p]);
    }
    const linhas = [...porProjeto.entries()]
      .map(([id, lista]) => ({ id, lista, total: soma(lista) }))
      .sort((a, b) => b.total - a.total);
    return (
      <section className="cartao-zine space-y-3 p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-2xl leading-none uppercase">Custo da IA</h2>
          <span className="font-display text-3xl leading-none">{r(soma(pedidos))}</span>
          <span className="text-xs text-zinc-500">
            no cliente todo{cotacao ? ` (${dolares(soma(pedidos))})` : ""} · atualiza sozinho
          </span>
        </div>
        {linhas.length ? (
          <table className="w-full text-sm">
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-t border-zinc-800/60">
                  <td className="py-1.5 pr-3">
                    {l.id ? (nomes[l.id] ?? "vídeo apagado") : "sem vídeo (aprendizados, ditado…)"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-zinc-500 tabular-nums">
                    {l.lista.length} pedido(s)
                  </td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{r(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-zinc-500">Nenhum gasto com a IA ainda.</p>
        )}
        <Rodape cotacao={cotacao} cliente />
      </section>
    );
  }

  const doVideo = pedidos.filter((p) => p.projetoId === projetoId);
  const porTipo = new Map<string, number>();
  for (const p of doVideo) porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + p.valor);
  const recentes = [...doVideo].reverse();
  const mostrados = todos ? recentes : recentes.slice(0, 6);
  return (
    <section className="cartao-zine space-y-3 p-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-2xl leading-none uppercase">Custo da IA</h2>
        <span className="font-display text-3xl leading-none">{r(soma(doVideo))}</span>
        <span className="text-xs text-zinc-500">
          neste vídeo{cotacao ? ` (${dolares(soma(doVideo))})` : ""} · {doVideo.length} pedido(s) ·
          atualiza sozinho
        </span>
      </div>
      {doVideo.length ? (
        <>
          <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase">
            {[...porTipo.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([tipo, valor]) => (
                <span key={tipo} className="border-2 border-tinta px-2 py-1">
                  {tipo}: {r(valor)}
                </span>
              ))}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {mostrados.map((p, i) => (
                <tr key={`${p.quando}-${i}`} className="border-t border-zinc-800/60">
                  <td className="py-1.5 pr-3 whitespace-nowrap text-zinc-500 tabular-nums">
                    {quandoFoi(p.quando)}
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{p.tipo}</td>
                  <td className="max-w-0 w-full truncate py-1.5 pr-3 text-zinc-400" title={p.descricao}>
                    {p.descricao}
                  </td>
                  <td className="py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                    {r(p.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentes.length > 6 ? (
            <button onClick={() => setTodos((x) => !x)} className="text-xs text-spray underline">
              {todos ? "mostrar só os últimos" : `ver os ${recentes.length} pedidos`}
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-zinc-500">A IA ainda não gastou nada neste vídeo.</p>
      )}
      <Rodape cotacao={cotacao} cliente={false} />
    </section>
  );
};

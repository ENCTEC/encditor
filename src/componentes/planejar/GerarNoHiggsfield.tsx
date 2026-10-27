"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CotacaoNaTela, reais } from "@/projeto/dinheiro";
import { Midia } from "@/projeto/tipos";

// Gerar os takes do plano direto no Higgsfield (API, Seedance 2.0), sem
// sair do encEditor. O servidor pede, acompanha e baixa (src/servidor/
// geracoes.ts); aqui a pessoa escolhe a qualidade, vê o custo em real,
// acompanha cada take e, quando fica pronto, o vídeo é ligado ao take
// (o Mapa do Plano é quem salva o plano).

export type Qualidade = "480p" | "720p" | "1080p";
const QUALIDADES: { id: Qualidade; rotulo: string }[] = [
  { id: "480p", rotulo: "480p (rascunho)" },
  { id: "720p", rotulo: "720p (bom para redes)" },
  { id: "1080p", rotulo: "1080p (máxima)" },
];

type TakeComPreco = {
  chave: string;
  segundos: number;
  elementos: string[];
  aviso: string | null;
  custo: Record<Qualidade, number>;
};
export type GeracaoNaTela = {
  id: string;
  chave: string;
  estado: string;
  criadoEm: number;
  atualizadoEm: number;
  segundos: number;
  resolucao: Qualidade;
  custo: number;
  erro: string | null;
  midia: Midia | null;
};
type Situacao = {
  configurado: boolean;
  takes: TakeComPreco[];
  geracoes: GeracaoNaTela[];
  cotacao: CotacaoNaTela | null;
};

const ATIVOS = ["subindo", "na fila", "gerando", "baixando"];
const CHAVE_QUALIDADE = "encditor:higgsfield:qualidade";
// Takes já ligados nesta aba (o mesmo vídeo não é ligado duas vezes).
const JA_LIGADAS = new Set<string>();

export const useHiggsfield = (
  projetoId: string | null,
  // Um take ficou pronto: o Mapa liga o vídeo ao item do plano.
  aoFicarPronto: (g: GeracaoNaTela & { midia: Midia }) => Promise<void> | void,
) => {
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [qualidade, setQualidadeBruta] = useState<Qualidade>("720p");
  const [erro, setErro] = useState<string | null>(null);
  const prontoRef = useRef(aoFicarPronto);
  prontoRef.current = aoFicarPronto;

  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE_QUALIDADE) as Qualidade | null;
      if (salva && QUALIDADES.some((q) => q.id === salva)) setQualidadeBruta(salva);
    } catch {
      // sem armazenamento: fica 720p
    }
  }, []);
  const setQualidade = (q: Qualidade) => {
    setQualidadeBruta(q);
    try {
      localStorage.setItem(CHAVE_QUALIDADE, q);
    } catch {
      // sem armazenamento
    }
  };

  const ler = useCallback(async () => {
    if (!projetoId) return null;
    const r = await fetch(`/api/higgsfield?projeto=${projetoId}`, { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return null;
    const s = (await r.json()) as Situacao;
    setSituacao(s);
    // Prontos ainda não ligados: liga (uma vez só).
    for (const g of s.geracoes) {
      if (g.estado !== "pronto" || !g.midia || JA_LIGADAS.has(g.id)) continue;
      JA_LIGADAS.add(g.id);
      await prontoRef.current(g as GeracaoNaTela & { midia: Midia });
      await fetch(`/api/higgsfield/${g.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "ligado" }),
      }).catch(() => undefined);
    }
    return s;
  }, [projetoId]);

  // Relê a cada 4 s com take sendo gerado; senão a cada 30 s.
  useEffect(() => {
    let parar = false;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const rodar = async () => {
      const s = await ler();
      if (parar) return;
      const ativo = s?.geracoes.some((g) => ATIVOS.includes(g.estado));
      espera = setTimeout(rodar, ativo ? 4000 : 30000);
    };
    void rodar();
    return () => {
      parar = true;
      if (espera) clearTimeout(espera);
    };
  }, [ler]);

  const gerar = async (chaves: string[]) => {
    if (!projetoId || !chaves.length) return;
    setErro(null);
    const r = await fetch(`/api/higgsfield?projeto=${projetoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chaves, resolucao: qualidade }),
    }).catch(() => null);
    if (!r?.ok) {
      const d = (await r?.json().catch(() => null)) as { erro?: string } | null;
      setErro(d?.erro ?? "Não consegui pedir ao Higgsfield.");
    }
    await ler();
  };

  const cancelar = async (id: string) => {
    const r = await fetch(`/api/higgsfield/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "cancelar" }),
    });
    if (!r.ok) setErro(((await r.json()) as { erro?: string }).erro ?? "Não deu para cancelar.");
    await ler();
  };

  // A geração mais recente de cada take.
  const ultimaDo = (chave: string) =>
    [...(situacao?.geracoes ?? [])].reverse().find((g) => g.chave === chave) ?? null;
  const precoDo = (chave: string) => situacao?.takes.find((t) => t.chave === chave) ?? null;

  return { situacao, qualidade, setQualidade, gerar, cancelar, erro, ultimaDo, precoDo };
};

export type UsoHiggsfield = ReturnType<typeof useHiggsfield>;

const ROTULO_ESTADO: Record<string, string> = {
  subindo: "enviando as referências…",
  "na fila": "na fila do Higgsfield…",
  gerando: "gerando…",
  baixando: "baixando o vídeo…",
  pronto: "pronto ✓",
  ligado: "pronto ✓",
  erro: "erro",
  bloqueado: "bloqueado pela moderação",
  cancelado: "cancelado",
};

const minutos = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Faixa do topo: qualidade e "gerar todos os que faltam".
export const PainelHiggsfield: React.FC<{
  higgs: UsoHiggsfield;
  // Takes do Higgsfield que ainda não têm vídeo.
  faltam: string[];
}> = ({ higgs, faltam }) => {
  const s = higgs.situacao;
  if (!s) return null;
  if (!s.configurado) {
    return (
      <div className="border-2 border-dashed border-tinta p-3 text-sm">
        <b>Gerar os takes daqui:</b> coloque a chave da API do Higgsfield no{" "}
        <code>.env.local</code> (<code>HIGGSFIELD_KEY_ID</code> e <code>HIGGSFIELD_KEY_SECRET</code>, criados em
        console.higgsfield.ai). Enquanto isso, copie os prompts e gere no site.
      </div>
    );
  }
  const livres = faltam.filter((c) => {
    const g = higgs.ultimaDo(c);
    return !g || !ATIVOS.includes(g.estado);
  });
  const segundos = livres.reduce((t, c) => t + (higgs.precoDo(c)?.segundos ?? 0), 0);
  const custo = livres.reduce((t, c) => t + (higgs.precoDo(c)?.custo[higgs.qualidade] ?? 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-3 border-[3px] border-tinta p-3">
      <span className="font-display text-xl leading-none uppercase">Higgsfield</span>
      <label className="flex items-center gap-2 text-sm">
        Qualidade
        <select
          value={higgs.qualidade}
          onChange={(e) => higgs.setQualidade(e.target.value as Qualidade)}
          className="border-2 border-tinta bg-papel px-2 py-1 text-sm"
        >
          {QUALIDADES.map((q) => (
            <option key={q.id} value={q.id}>
              {q.rotulo}
            </option>
          ))}
        </select>
      </label>
      {livres.length ? (
        <button
          onClick={() => {
            const ok = window.confirm(
              `Gerar ${livres.length} take(s) no Higgsfield, ${segundos} s em ${higgs.qualidade}?\n\nCusto estimado: ${reais(custo, s.cotacao)} (sai do saldo da API).`,
            );
            if (ok) void higgs.gerar(livres);
          }}
          className="botao-spray !px-3 !py-1 !text-sm"
        >
          Gerar os {livres.length} take(s) que faltam (≈ {reais(custo, s.cotacao)})
        </button>
      ) : (
        <span className="text-sm text-zinc-500">Todos os takes já têm vídeo ou estão sendo gerados.</span>
      )}
      {higgs.erro ? <p className="w-full text-sm text-spray">{higgs.erro}</p> : null}
      <p className="w-full text-xs text-zinc-500">
        Preço pela fórmula do Higgsfield (tabela cheia; sua conta pode ter desconto). Leva alguns minutos por take; pode
        trocar de tela, o vídeo entra sozinho no take quando ficar pronto.
      </p>
    </div>
  );
};

// O botão e a situação de um take.
export const GerarTake: React.FC<{ higgs: UsoHiggsfield; chave: string; temVideo: boolean }> = ({
  higgs,
  chave,
  temVideo,
}) => {
  const s = higgs.situacao;
  const [agora, setAgora] = useState(() => Date.now());
  const g = higgs.ultimaDo(chave);
  const ativo = !!g && ATIVOS.includes(g.estado);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  if (!s?.configurado) return null;
  const preco = higgs.precoDo(chave);
  const custo = preco?.custo[higgs.qualidade] ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {g ? (
        <span
          className={`border-2 px-2 py-0.5 font-mono text-[11px] uppercase ${
            g.estado === "erro" || g.estado === "bloqueado" ? "border-spray text-spray" : "border-tinta"
          }`}
        >
          🎬 {ROTULO_ESTADO[g.estado] ?? g.estado}
          {ativo ? ` ${minutos(agora - g.criadoEm)}` : ""}
          {` · ${g.segundos}s ${g.resolucao}`}
        </span>
      ) : null}
      {g?.estado === "na fila" ? (
        <button onClick={() => void higgs.cancelar(g.id)} className="text-xs text-spray underline">
          cancelar
        </button>
      ) : null}
      {!ativo ? (
        <button
          onClick={() => {
            const texto = temVideo
              ? `Este take já tem vídeo. Gerar outro no Higgsfield (${preco?.segundos ?? "?"} s em ${higgs.qualidade}, ≈ ${reais(custo, s.cotacao)})?`
              : `Gerar este take no Higgsfield (${preco?.segundos ?? "?"} s em ${higgs.qualidade}, ≈ ${reais(custo, s.cotacao)})?`;
            if (window.confirm(texto)) void higgs.gerar([chave]);
          }}
          className="border-2 border-tinta px-2 py-1 font-mono text-[11px] uppercase hover:bg-tinta hover:text-papel"
        >
          🎬 {temVideo ? "Gerar de novo" : "Gerar no Higgsfield"} (≈ {reais(custo, s.cotacao)})
        </button>
      ) : null}
      {preco?.elementos.length ? (
        <span className="text-xs text-zinc-500">referências: @{preco.elementos.join(", @")}</span>
      ) : null}
      {g?.erro && !ativo ? <p className="w-full text-xs text-spray">{g.erro}</p> : null}
      {preco?.aviso ? <p className="w-full text-xs text-zinc-500">⚠ {preco.aviso}</p> : null}
    </div>
  );
};

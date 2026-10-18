"use client";

import { useState } from "react";
import {
  REDES,
  Rede,
  Resultado,
  ResultadoOrganico,
  ResultadoPago,
  resultadoVazio,
  ROTULO_AVALIACAO,
  temOrganico,
  temPago,
} from "@/projeto/resultado";

// Registrar o resultado de um vídeo exportado, separado em PAGO (Meta Ads:
// cliques/conversas, CTR, custo por resultado, vendas) e ORGÂNICO (TikTok e
// Instagram). Também a avaliação geral, uma anotação e a opinião sobre o
// visual. Alimenta o aprendizado da IA.

const campo =
  "w-full border-2 border-tinta bg-zinc-950 px-2 py-1.5 text-sm outline-none focus:shadow-[3px_3px_0_var(--color-spray)]";

const aba = (ativa: boolean) =>
  `relative border-2 border-tinta px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase ${
    ativa ? "bg-tinta text-papel" : "hover:bg-zinc-900"
  }`;

// Número digitado (aceita vírgula e "1.234"); vazio = sem valor.
const paraNumero = (texto: string) => {
  const limpo = texto
    .trim()
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? n : null;
};
const paraTexto = (n: number | null) =>
  n === null ? "" : String(n).replace(".", ",");

const CampoNumero: React.FC<{
  rotulo: string;
  valor: number | null;
  aoMudar: (n: number | null) => void;
  dica?: string;
  // Preenchido sozinho pela Meta: não se edita aqui.
  daMeta?: boolean;
}> = ({ rotulo, valor, aoMudar, dica, daMeta }) => {
  const [texto, setTexto] = useState(paraTexto(valor));
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">
        {rotulo}
        {daMeta ? <span className="text-verde"> · da Meta</span> : null}
      </span>
      <input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          aoMudar(paraNumero(e.target.value));
        }}
        inputMode="decimal"
        placeholder={dica}
        disabled={daMeta}
        title={daMeta ? "Vem sozinho da Meta" : undefined}
        className={`${campo} disabled:opacity-60`}
      />
    </label>
  );
};

// Símbolo da moeda da conta de anúncios ("R$", "US$").
const simboloDa = (moeda = "BRL") => {
  try {
    return (
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? "R$"
    );
  } catch {
    return "R$";
  }
};

const Marcador: React.FC<{ ligado: boolean }> = ({ ligado }) =>
  ligado ? (
    <span className="absolute -top-1.5 -right-1.5 h-3 w-3 border-2 border-tinta bg-verde" />
  ) : null;

export const ModalResultado: React.FC<{
  nomeProjeto: string;
  atual: Resultado | null;
  aoSalvar: (resultado: Resultado | null) => void;
  aoFechar: () => void;
  // Campos preenchidos sozinhos pela Meta (versão ligada a post/anúncio).
  automatico?: { pago: string[]; instagram: string[] };
}> = ({ nomeProjeto, atual, aoSalvar, aoFechar, automatico }) => {
  const daMetaPago = (campo: string) => !!automatico?.pago.includes(campo);
  const daMetaInstagram = (campo: string) =>
    !!automatico?.instagram.includes(campo);
  const [r, setR] = useState<Resultado>(atual ?? resultadoVazio());
  const [secao, setSecao] = useState<"pago" | "organico">(
    atual &&
      !temPago(atual.pago) &&
      (temOrganico(atual.organico.tiktok) ||
        temOrganico(atual.organico.instagram))
      ? "organico"
      : "pago",
  );
  const [rede, setRede] = useState<Rede>("tiktok");

  const mudarPago = (m: Partial<ResultadoPago>) =>
    setR((x) => ({ ...x, pago: { ...x.pago, ...m } }));
  const mudarRede = (m: Partial<ResultadoOrganico>) =>
    setR((x) => ({
      ...x,
      organico: { ...x.organico, [rede]: { ...x.organico[rede], ...m } },
    }));
  const singular = r.pago.tipo === "conversas" ? "conversa" : "clique";
  const o = r.organico[rede];
  const daMetaNaRede = (campo: string) =>
    rede === "instagram" && daMetaInstagram(campo);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-6"
      onPointerDown={(e) => e.target === e.currentTarget && aoFechar()}
      role="dialog"
      aria-label="Resultado do vídeo"
    >
      <div className="cartao-zine max-h-full w-full max-w-lg overflow-y-auto p-5">
        <h2 className="font-display text-3xl leading-none tracking-wide uppercase">
          Resultado
        </h2>
        <p className="mt-1 font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
          {nomeProjeto}
        </p>
        {automatico &&
        (automatico.pago.length || automatico.instagram.length) ? (
          <p className="mt-3 border-l-4 border-verde pl-2 text-xs">
            Os campos marcados “da Meta” são preenchidos sozinhos e não se
            editam aqui. Os outros — como Vendas quando o anúncio não rastreia
            compras e Seguidores de reel —, a avaliação, a anotação, o visual e
            o TikTok são seus.
          </p>
        ) : null}

        <p className="rotulo-zine mt-5 mb-2">Esse vídeo deu resultado?</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ROTULO_AVALIACAO) as Resultado["avaliacao"][]).map(
            (a) => (
              <button
                key={a}
                onClick={() => setR((x) => ({ ...x, avaliacao: a }))}
                className={`border-2 border-tinta px-2 py-2 text-sm ${
                  r.avaliacao === a
                    ? a === "bom"
                      ? "bg-verde text-papel"
                      : a === "ruim"
                        ? "bg-spray text-papel"
                        : "bg-tinta text-papel"
                    : "hover:bg-zinc-900"
                }`}
              >
                {ROTULO_AVALIACAO[a]}
              </button>
            ),
          )}
        </div>

        {/* Pago × Orgânico */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setSecao("pago")}
            className={aba(secao === "pago")}
          >
            Pago · Meta Ads
            <Marcador ligado={temPago(r.pago)} />
          </button>
          <button
            onClick={() => setSecao("organico")}
            className={aba(secao === "organico")}
          >
            Orgânico
            <Marcador
              ligado={
                temOrganico(r.organico.tiktok) ||
                temOrganico(r.organico.instagram)
              }
            />
          </button>
        </div>

        <div className="mt-3 border-2 border-tinta p-3">
          {secao === "pago" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400">A campanha gera:</span>
                {(["conversas", "cliques"] as const).map((t) => (
                  <button
                    key={t}
                    disabled={daMetaPago("tipo")}
                    onClick={() => mudarPago({ tipo: t })}
                    className={`border-2 border-tinta px-2 py-0.5 font-mono uppercase ${
                      r.pago.tipo === t ? "bg-tinta text-papel" : ""
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CampoNumero
                  key={`res-${r.pago.tipo}`}
                  rotulo={r.pago.tipo === "conversas" ? "Conversas" : "Cliques"}
                  valor={r.pago.resultados}
                  aoMudar={(n) => mudarPago({ resultados: n })}
                  daMeta={daMetaPago("resultados")}
                />
                <CampoNumero
                  rotulo="CTR (%)"
                  valor={r.pago.ctr}
                  aoMudar={(n) => mudarPago({ ctr: n })}
                  dica="ex.: 1,8"
                  daMeta={daMetaPago("ctr")}
                />
                <CampoNumero
                  key={`custo-${r.pago.tipo}`}
                  rotulo={`Custo por ${singular} (${simboloDa(r.pago.moeda)})`}
                  valor={r.pago.custoPorResultado}
                  aoMudar={(n) => mudarPago({ custoPorResultado: n })}
                  dica="ex.: 3,20"
                  daMeta={daMetaPago("custoPorResultado")}
                />
                <CampoNumero
                  rotulo="Vendas"
                  valor={r.pago.vendas}
                  aoMudar={(n) => mudarPago({ vendas: n })}
                  daMeta={daMetaPago("vendas")}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(Object.keys(REDES) as Rede[]).map((x) => (
                  <button
                    key={x}
                    onClick={() => setRede(x)}
                    className={aba(rede === x)}
                  >
                    {REDES[x]}
                    <Marcador ligado={temOrganico(r.organico[x])} />
                  </button>
                ))}
              </div>
              {/* key = rede: troca os campos ao mudar de rede */}
              <div key={rede} className="grid grid-cols-2 gap-3">
                <CampoNumero
                  rotulo="Visualizações"
                  valor={o.visualizacoes}
                  aoMudar={(n) => mudarRede({ visualizacoes: n })}
                  daMeta={daMetaNaRede("visualizacoes")}
                />
                <CampoNumero
                  rotulo="Curtidas"
                  valor={o.curtidas}
                  aoMudar={(n) => mudarRede({ curtidas: n })}
                  daMeta={daMetaNaRede("curtidas")}
                />
                <CampoNumero
                  rotulo="Comentários"
                  valor={o.comentarios}
                  aoMudar={(n) => mudarRede({ comentarios: n })}
                  daMeta={daMetaNaRede("comentarios")}
                />
                <CampoNumero
                  rotulo="Compartilhamentos"
                  valor={o.compartilhamentos}
                  aoMudar={(n) => mudarRede({ compartilhamentos: n })}
                  daMeta={daMetaNaRede("compartilhamentos")}
                />
                <CampoNumero
                  rotulo="Salvamentos"
                  valor={o.salvamentos}
                  aoMudar={(n) => mudarRede({ salvamentos: n })}
                  daMeta={daMetaNaRede("salvamentos")}
                />
                <CampoNumero
                  rotulo="Seguidores ganhos"
                  valor={o.seguidores}
                  aoMudar={(n) => mudarRede({ seguidores: n })}
                  daMeta={daMetaNaRede("seguidores")}
                />
              </div>
            </div>
          )}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs text-zinc-400">
            Anotação (o que funcionou ou não, público, gancho…)
          </span>
          <textarea
            value={r.nota}
            onChange={(e) => {
              const nota = e.target.value;
              setR((x) => ({ ...x, nota }));
            }}
            rows={2}
            className={`${campo} resize-none`}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs text-zinc-400">
            Opinião sobre o visual dos clipes (o encEditor aprende com isso nos
            próximos roteiros)
          </span>
          <textarea
            value={r.opiniaoVisual}
            onChange={(e) => {
              const opiniaoVisual = e.target.value;
              setR((x) => ({ ...x, opiniaoVisual }));
            }}
            rows={2}
            placeholder="ex.: ângulo ruim da modelo; a loja apareceu pouco; roupas feias; iluminação escura"
            className={`${campo} resize-none`}
          />
        </label>

        <div className="mt-5 flex gap-2">
          {atual ? (
            <button
              onClick={() => aoSalvar(null)}
              className="border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
            >
              Apagar
            </button>
          ) : null}
          <button
            onClick={aoFechar}
            className="ml-auto border-2 border-tinta px-3 py-2 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              aoSalvar({
                ...r,
                nota: r.nota.trim(),
                opiniaoVisual: r.opiniaoVisual.trim(),
                registradoEm: Date.now(),
              })
            }
            className="botao-spray"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

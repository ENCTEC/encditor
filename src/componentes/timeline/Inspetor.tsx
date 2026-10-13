"use client";

import { useEffect, useState } from "react";
import { ESTILOS_LEGENDA, TRANSICOES } from "@/catalogo/estilos";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { EstiloLegenda } from "@/timeline/schema";
import {
  atualizarItem,
  definirFormato,
  Faixa,
  ItensPorFaixa,
  moverClipe,
  removerItem,
} from "@/timeline/operacoes";
import { Selecao } from "./Trilhas";

// "opcional": campo pode ficar vazio (= usar o padrão do projeto).
type Campo =
  | {
      chave: string;
      rotulo: string;
      tipo: "numero";
      passo?: number;
      opcional?: boolean;
    }
  | { chave: string; rotulo: string; tipo: "texto" }
  | {
      chave: string;
      rotulo: string;
      tipo: "opcoes";
      opcoes: { valor: string; rotulo: string }[];
      opcional?: boolean;
    };

const CAMPOS: Record<Faixa, Campo[]> = {
  clipes: [
    { chave: "inicio", rotulo: "Início no vídeo (s)", tipo: "numero" },
    { chave: "fim", rotulo: "Fim no vídeo (s)", tipo: "numero" },
    {
      chave: "transicao",
      rotulo: "Transição de entrada",
      tipo: "opcoes",
      opcoes: TRANSICOES.map((t) => ({
        valor: t.id,
        rotulo: `${t.nome} (${t.tag})`,
      })),
    },
    {
      chave: "direcao",
      rotulo: "Direção (slide, cortina, virar)",
      tipo: "opcoes",
      opcional: true,
      opcoes: [
        { valor: "", rotulo: "Padrão" },
        { valor: "esquerda", rotulo: "Da esquerda" },
        { valor: "direita", rotulo: "Da direita" },
        { valor: "cima", rotulo: "De cima" },
        { valor: "baixo", rotulo: "De baixo" },
      ],
    },
    {
      chave: "duracaoTransicao",
      rotulo: "Duração da transição (s, vazio = padrão)",
      tipo: "numero",
      opcional: true,
    },
    { chave: "volume", rotulo: "Volume (0 = mudo)", tipo: "numero" },
  ],
  inserts: [
    { chave: "inicio", rotulo: "Aparece em (s)", tipo: "numero" },
    { chave: "fim", rotulo: "Some em (s)", tipo: "numero" },
    {
      chave: "posicao",
      rotulo: "Posição",
      tipo: "opcoes",
      opcoes: [
        { valor: "tela-cheia", rotulo: "Tela cheia" },
        { valor: "janela", rotulo: "Janela no canto" },
      ],
    },
    { chave: "origemInicio", rotulo: "Começar do segundo", tipo: "numero" },
    { chave: "volume", rotulo: "Volume (0 = mudo)", tipo: "numero" },
  ],
  audios: [
    { chave: "inicio", rotulo: "Começa em (s)", tipo: "numero" },
    { chave: "fim", rotulo: "Termina em (s)", tipo: "numero" },
    { chave: "origemInicio", rotulo: "Começar do segundo", tipo: "numero" },
    { chave: "volume", rotulo: "Volume", tipo: "numero" },
    { chave: "fadeEntrada", rotulo: "Fade de entrada (s)", tipo: "numero" },
    { chave: "fadeSaida", rotulo: "Fade de saída (s)", tipo: "numero" },
  ],
  zooms: [
    { chave: "inicio", rotulo: "Início (s)", tipo: "numero" },
    { chave: "fim", rotulo: "Fim (s)", tipo: "numero" },
    {
      chave: "escala",
      rotulo: "Escala (1.5 = 50% mais perto)",
      tipo: "numero",
    },
    { chave: "focoX", rotulo: "Foco horizontal (%)", tipo: "numero", passo: 1 },
    { chave: "focoY", rotulo: "Foco vertical (%)", tipo: "numero", passo: 1 },
    {
      chave: "rampa",
      rotulo: "Rampa (s para aproximar/voltar; vazio = 0.4)",
      tipo: "numero",
      opcional: true,
    },
  ],
  legendas: [
    { chave: "texto", rotulo: "Texto", tipo: "texto" },
    { chave: "inicio", rotulo: "Início (s)", tipo: "numero" },
    { chave: "fim", rotulo: "Fim (s)", tipo: "numero" },
    {
      chave: "estilo",
      rotulo: "Estilo desta legenda",
      tipo: "opcoes",
      opcional: true,
      opcoes: [
        { valor: "", rotulo: "Padrão do projeto" },
        ...ESTILOS_LEGENDA.map((e) => ({
          valor: e.id,
          rotulo: `${e.nome} (${e.tag})`,
        })),
      ],
    },
  ],
};

const TITULO: Record<Faixa, string> = {
  clipes: "Cena",
  inserts: "Insert",
  audios: "Áudio",
  zooms: "Zoom",
  legendas: "Legenda",
};

const estiloCampo =
  "w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm outline-none focus:border-violet-500";

// Campo que só aplica a mudança ao sair do campo ou apertar Enter (assim
// cada tecla não vira um passo no desfazer).
const CampoEditavel: React.FC<{
  valor: string;
  numerico: boolean;
  passo?: number;
  aoConfirmar: (valor: string) => void;
}> = ({ valor, numerico, passo, aoConfirmar }) => {
  const [rascunho, setRascunho] = useState(valor);
  useEffect(() => setRascunho(valor), [valor]);

  const confirmar = () => {
    if (rascunho === valor) return;
    if (numerico && !Number.isFinite(Number(rascunho))) {
      setRascunho(valor);
      return;
    }
    aoConfirmar(rascunho);
  };

  return (
    <input
      type={numerico ? "number" : "text"}
      step={passo ?? 0.1}
      value={rascunho}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setRascunho(valor);
      }}
      className={estiloCampo}
    />
  );
};

const FORMATOS = [
  { rotulo: "16:9", largura: 1920, altura: 1080 },
  { rotulo: "9:16", largura: 1080, altura: 1920 },
  { rotulo: "1:1", largura: 1080, altura: 1080 },
  { rotulo: "4:5", largura: 1080, altura: 1350 },
];

export const Inspetor: React.FC<{
  selecao: Selecao;
  aoSelecionar: (s: Selecao) => void;
}> = ({ selecao, aoSelecionar }) => {
  const { projeto, aplicar } = useProjeto();
  const { timeline } = projeto;

  const item = selecao
    ? (timeline[selecao.faixa][selecao.indice] as
        | Record<string, unknown>
        | undefined)
    : undefined;

  // Sem item selecionado: configurações do vídeo final.
  if (!selecao || !item) {
    return (
      <div className="space-y-5">
        <h2 className="text-sm font-semibold">Projeto</h2>
        <div>
          <p className="mb-2 text-xs text-zinc-400">Formato</p>
          <div className="grid grid-cols-4 gap-1">
            {FORMATOS.map((f) => {
              const ativo =
                // Compara a proporção (1280x720 também é 16:9).
                Math.abs(
                  timeline.largura / timeline.altura - f.largura / f.altura,
                ) < 0.01;
              return (
                <button
                  key={f.rotulo}
                  onClick={() =>
                    aplicar((t) => definirFormato(t, f.largura, f.altura))
                  }
                  className={`border px-2 py-1.5 text-xs ${
                    ativo
                      ? "border-tinta bg-tinta text-papel"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {f.rotulo}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {timeline.largura}×{timeline.altura}
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">
            Quadros por segundo
          </span>
          <select
            value={timeline.fps}
            onChange={(e) =>
              aplicar((t) => ({ ...t, fps: Number(e.target.value) }))
            }
            className={estiloCampo}
          >
            {[24, 25, 30, 60].map((fps) => (
              <option key={fps} value={fps}>
                {fps} fps
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">
            Duração das transições (s)
          </span>
          <CampoEditavel
            valor={String(timeline.duracaoTransicao)}
            numerico
            aoConfirmar={(v) =>
              aplicar((t) => ({ ...t, duracaoTransicao: Number(v) }))
            }
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">
            Estilo das legendas
          </span>
          <select
            value={timeline.estiloLegenda ?? "classico"}
            onChange={(e) =>
              aplicar((t) => ({
                ...t,
                estiloLegenda: e.target.value as EstiloLegenda,
              }))
            }
            className={estiloCampo}
          >
            {ESTILOS_LEGENDA.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome} ({e.tag})
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-zinc-500">
          Clique num item da timeline para editar. Veja os exemplos de cada
          estilo na aba Estilos.
        </p>
      </div>
    );
  }

  const { faixa, indice } = selecao;

  const confirmar = (campo: Campo, valor: string) => {
    const vazio = valor.trim() === "" && "opcional" in campo && campo.opcional;
    const convertido = vazio
      ? undefined
      : campo.tipo === "numero"
        ? Number(valor)
        : valor;
    aplicar((t) =>
      atualizarItem(t, faixa, indice, {
        [campo.chave]: convertido,
      } as Partial<ItensPorFaixa[typeof faixa]>),
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">
        {TITULO[faixa]} {indice + 1}
      </h2>

      {CAMPOS[faixa].map((campo) => (
        <label key={campo.chave} className="block">
          <span className="mb-1 block text-xs text-zinc-400">
            {campo.rotulo}
          </span>
          {campo.tipo === "opcoes" ? (
            <select
              value={String(item[campo.chave] ?? "")}
              onChange={(e) => confirmar(campo, e.target.value)}
              className={estiloCampo}
            >
              {campo.opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          ) : (
            <CampoEditavel
              valor={String(item[campo.chave] ?? "")}
              numerico={campo.tipo === "numero"}
              passo={campo.tipo === "numero" ? campo.passo : undefined}
              aoConfirmar={(v) => confirmar(campo, v)}
            />
          )}
        </label>
      ))}

      {faixa === "clipes" ? (
        <div className="flex gap-2">
          <button
            disabled={indice === 0}
            onClick={() => {
              if (aplicar((t) => moverClipe(t, indice, indice - 1))) {
                aoSelecionar({ faixa, indice: indice - 1 });
              }
            }}
            className="flex-1 border border-zinc-700 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
          >
            ← Antes
          </button>
          <button
            disabled={indice === timeline.clipes.length - 1}
            onClick={() => {
              if (aplicar((t) => moverClipe(t, indice, indice + 1))) {
                aoSelecionar({ faixa, indice: indice + 1 });
              }
            }}
            className="flex-1 border border-zinc-700 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
          >
            Depois →
          </button>
        </div>
      ) : null}

      <button
        onClick={() => {
          if (aplicar((t) => removerItem(t, faixa, indice))) {
            aoSelecionar(null);
          }
        }}
        className="w-full border border-red-900 py-1.5 text-sm text-red-300 hover:bg-red-950"
      >
        Remover (Delete)
      </button>
    </div>
  );
};

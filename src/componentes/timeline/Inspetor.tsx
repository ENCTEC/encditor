"use client";

import { useEffect, useState } from "react";
import {
  EFEITOS_VISUAIS,
  ESTILOS_LEGENDA,
  FUNDOS,
  MOTIONS,
  TRANSICOES,
} from "@/catalogo/estilos";
import { useProjeto } from "@/projeto/ProjetoProvider";
import { FORMATOS } from "@/timeline/formatos";
import {
  AparenciaLegendas,
  EstiloFundo,
  estiloDoFundo,
  EstiloLegenda,
  PosicaoLegenda,
  urlDoFundo,
} from "@/timeline/schema";
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
  | { chave: string; rotulo: string; tipo: "texto"; opcional?: boolean }
  | {
      chave: string;
      rotulo: string;
      tipo: "opcoes";
      opcoes: { valor: string; rotulo: string }[];
      opcional?: boolean;
    };

// Cores de destaque dos motions (vazio = a do modelo: vermelho do
// encEditor; no kit neon, o degradê azul→roxo).
const CORES_MOTION = [
  { valor: "", rotulo: "Padrão (vermelho / degradê no neon)" },
  { valor: "#E1251B", rotulo: "Vermelho" },
  { valor: "#FFD60A", rotulo: "Amarelo" },
  { valor: "#FFFFFF", rotulo: "Branco" },
  { valor: "#111110", rotulo: "Preto" },
  { valor: "#FF4FA3", rotulo: "Rosa" },
  { valor: "#1F7A3A", rotulo: "Verde" },
  { valor: "#1D4F8C", rotulo: "Azul" },
];

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
    {
      chave: "velocidade",
      rotulo: "Velocidade (0,8 = câmera lenta; vazio = normal)",
      tipo: "numero",
      passo: 0.05,
      opcional: true,
    },
  ],
  inserts: [
    { chave: "inicio", rotulo: "Aparece em (s)", tipo: "numero" },
    { chave: "fim", rotulo: "Some em (s)", tipo: "numero" },
    { chave: "origemInicio", rotulo: "Começar do segundo", tipo: "numero" },
    { chave: "volume", rotulo: "Volume (0 = mudo)", tipo: "numero" },
    {
      chave: "rotacao",
      rotulo: "Inclinação (graus; vazio = reto)",
      tipo: "numero",
      passo: 1,
      opcional: true,
    },
    {
      chave: "rotulo",
      rotulo: "Texto à mão na polaroid",
      tipo: "texto",
      opcional: true,
    },
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
  motions: [
    {
      chave: "modelo",
      rotulo: "Modelo",
      tipo: "opcoes",
      opcoes: MOTIONS.map((m) => ({
        valor: m.id,
        rotulo: `${m.nome} (${m.tag})`,
      })),
    },
    {
      chave: "texto",
      rotulo: "Texto (*palavra* = cor de destaque)",
      tipo: "texto",
    },
    {
      chave: "detalhe",
      rotulo: "Detalhe (preço antigo, rótulo ou itens com |)",
      tipo: "texto",
      opcional: true,
    },
    { chave: "inicio", rotulo: "Aparece em (s)", tipo: "numero" },
    { chave: "fim", rotulo: "Some em (s)", tipo: "numero" },
    {
      chave: "posicao",
      rotulo: "Posição",
      tipo: "opcoes",
      opcional: true,
      opcoes: [
        { valor: "", rotulo: "Padrão do modelo" },
        { valor: "topo", rotulo: "Topo" },
        { valor: "centro", rotulo: "Centro" },
        { valor: "base", rotulo: "Base" },
      ],
    },
    {
      chave: "x",
      rotulo: "Ponto X % (seta, círculo, toque, curtida, brilho, fio…)",
      tipo: "numero",
      passo: 1,
      opcional: true,
    },
    {
      chave: "y",
      rotulo: "Ponto Y % (seta, círculo, toque, curtida, brilho, fio…)",
      tipo: "numero",
      passo: 1,
      opcional: true,
    },
    {
      chave: "x2",
      rotulo: "Fim do fio X %",
      tipo: "numero",
      passo: 1,
      opcional: true,
    },
    {
      chave: "y2",
      rotulo: "Fim do fio Y %",
      tipo: "numero",
      passo: 1,
      opcional: true,
    },
    {
      chave: "cor",
      rotulo: "Cor de destaque",
      tipo: "opcoes",
      opcional: true,
      opcoes: CORES_MOTION,
    },
  ],
  efeitos: [
    {
      chave: "tipo",
      rotulo: "Efeito",
      tipo: "opcoes",
      opcoes: EFEITOS_VISUAIS.map((e) => ({
        valor: e.id,
        rotulo: `${e.nome} (${e.tag})`,
      })),
    },
    { chave: "inicio", rotulo: "Início (s)", tipo: "numero" },
    { chave: "fim", rotulo: "Fim (s)", tipo: "numero" },
    {
      chave: "intensidade",
      rotulo: "Intensidade (0,1 sutil – 1 forte; vazio = 0,6)",
      tipo: "numero",
      passo: 0.1,
      opcional: true,
    },
  ],
};

const TITULO: Record<Faixa, string> = {
  clipes: "Cena",
  inserts: "Insert",
  audios: "Áudio",
  zooms: "Zoom",
  legendas: "Legenda",
  motions: "Motion",
  efeitos: "Efeito",
};

const estiloCampo =
  "w-full border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm outline-none focus:border-violet-500";

// Campo que só aplica a mudança ao sair do campo ou apertar Enter (assim
// cada tecla não vira um passo no desfazer).
// Número opcional: vazio = padrão do estilo; fora da faixa = encosta no
// limite.
const numeroOuPadrao = (texto: string, min: number, max: number) =>
  texto.trim() === "" ? undefined : Math.min(max, Math.max(min, Number(texto)));

// Tamanho, posição e espaço entre linhas de TODAS as legendas (valem para
// qualquer estilo). Campos vazios = padrão do estilo.
const AjustesDasLegendas: React.FC<{
  aparencia: AparenciaLegendas;
  ajustar: (mudancas: AparenciaLegendas) => void;
}> = ({ aparencia, ajustar }) => (
  <div className="space-y-2 border-l-2 border-zinc-700 pl-3">
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-400">Tamanho (%)</span>
        <CampoEditavel
          valor={
            aparencia.tamanho !== undefined
              ? String(Math.round(aparencia.tamanho * 100))
              : ""
          }
          numerico
          passo={5}
          aoConfirmar={(v) => {
            const pct = numeroOuPadrao(v, 30, 300);
            ajustar({ tamanho: pct === undefined ? undefined : pct / 100 });
          }}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-400">Posição</span>
        <select
          value={aparencia.posicao ?? ""}
          onChange={(e) =>
            ajustar({
              posicao: (e.target.value || undefined) as
                | PosicaoLegenda
                | undefined,
            })
          }
          className={estiloCampo}
        >
          <option value="">Padrão do estilo</option>
          <option value="topo">Topo</option>
          <option value="centro">Centro</option>
          <option value="base">Base</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-400">
          Distância da borda (%)
        </span>
        <CampoEditavel
          valor={aparencia.margem !== undefined ? String(aparencia.margem) : ""}
          numerico
          passo={1}
          aoConfirmar={(v) => ajustar({ margem: numeroOuPadrao(v, 0, 45) })}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-zinc-400">
          Espaço entre linhas
        </span>
        <CampoEditavel
          valor={
            aparencia.entrelinhas !== undefined
              ? String(aparencia.entrelinhas)
              : ""
          }
          numerico
          passo={0.05}
          aoConfirmar={(v) =>
            ajustar({ entrelinhas: numeroOuPadrao(v, 0.7, 2.5) })
          }
        />
      </label>
    </div>
    <p className="text-xs text-zinc-500">
      Vazio = padrão do estilo. Ex.: tamanho 80, posição Base, distância 6,
      espaço 1.3.
    </p>
  </div>
);

const ORIGEM_DA_DIRECAO = {
  automatica: "a IA decidiu pelo áudio",
  pedido: "do seu pedido",
  exemplo: "copiada do exemplo",
} as const;

// Direção de arte do vídeo (cores, fundo, tom): de onde veio e as cores.
// "Apagar" deixa a IA decidir de novo no próximo pedido.
const DirecaoDoVideo: React.FC = () => {
  const { projeto, aplicar } = useProjeto();
  const d = projeto.timeline.direcaoDeArte;
  return (
    <div className="space-y-1.5 border-l-2 border-zinc-700 pl-3">
      <p className="text-xs text-zinc-400">Direção de arte</p>
      {d ? (
        <>
          <div className="flex items-center gap-1.5">
            {d.cores.map((c) => (
              <span
                key={c}
                title={c}
                className="h-5 w-5 border-2 border-tinta"
                style={{ backgroundColor: c }}
              />
            ))}
            <span className="ml-1 font-mono text-[11px] text-zinc-500">
              fundo {d.fundo} · energia {d.energia}
            </span>
          </div>
          <p className="text-xs">
            <b>{d.nicho}</b> — {d.tom}. Para: {d.publico}.
          </p>
          <p className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">
            {ORIGEM_DA_DIRECAO[d.origem]}
          </p>
          <button
            onClick={() => aplicar((t) => ({ ...t, direcaoDeArte: undefined }))}
            className="border border-zinc-700 px-2 py-0.5 text-[11px] hover:border-violet-500"
          >
            Apagar (a IA decide de novo)
          </button>
        </>
      ) : (
        <p className="text-xs text-zinc-500">
          Nenhuma ainda. No chat, diga o estilo ("preto e dourado, calmo") ou
          mande um exemplo; se não disser nada, a IA escolhe pelo áudio quando
          montar o vídeo.
        </p>
      )}
    </div>
  );
};

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

export const Inspetor: React.FC<{
  selecao: Selecao;
  aoSelecionar: (s: Selecao) => void;
  aoPosicionarInsert: (indice: number) => void;
}> = ({ selecao, aoSelecionar, aoPosicionarInsert }) => {
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
                  key={f.id}
                  onClick={() =>
                    aplicar((t) => definirFormato(t, f.largura, f.altura))
                  }
                  className={`border px-2 py-1.5 text-xs ${
                    ativo
                      ? "border-tinta bg-tinta text-papel"
                      : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {f.id}
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
        <AjustesDasLegendas
          aparencia={timeline.aparenciaLegendas ?? {}}
          ajustar={(mudancas) =>
            aplicar((t) => {
              const juntas = { ...t.aparenciaLegendas, ...mudancas };
              const definidas = Object.fromEntries(
                Object.entries(juntas).filter(([, v]) => v !== undefined),
              );
              return {
                ...t,
                aparenciaLegendas: Object.keys(definidas).length
                  ? definidas
                  : undefined,
              };
            })
          }
        />
        <DirecaoDoVideo />
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

      {faixa === "clipes" && item.tipo === "fundo" ? (
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">
            Fundo animado
          </span>
          <select
            value={estiloDoFundo(String(item.url))}
            onChange={(e) =>
              aplicar((t) =>
                atualizarItem(t, "clipes", indice, {
                  url: urlDoFundo(e.target.value as EstiloFundo),
                }),
              )
            }
            className={estiloCampo}
          >
            {FUNDOS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} ({f.tag})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {faixa === "inserts" ? (
        <button
          onClick={() => aoPosicionarInsert(indice)}
          className="botao-spray w-full"
        >
          Posição e tamanho…
        </button>
      ) : null}

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

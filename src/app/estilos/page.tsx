"use client";

import { Player } from "@remotion/player";
import {
  arquivoDoSom,
  EFEITOS_VISUAIS,
  ESTILOS_LEGENDA,
  ItemCatalogo,
  MOTIONS,
  SONS,
  TRANSICOES,
} from "@/catalogo/estilos";
import { EfeitosAudio } from "@/componentes/estilos/EfeitosAudio";
import { citarNoChat } from "@/componentes/Mencoes";
import { useProjeto } from "@/projeto/ProjetoProvider";
import {
  DEMO,
  DemoEfeito,
  DemoLegenda,
  DemoMotion,
  DemoTransicao,
  DURACAO_DEMO_EFEITO,
  DURACAO_DEMO_LEGENDA,
  DURACAO_DEMO_MOTION,
  DURACAO_DEMO_TRANSICAO,
} from "@/remotion/demos/Demos";
import { atualizarItem } from "@/timeline/operacoes";
import { EstiloLegenda, TipoTransicao } from "@/timeline/schema";

// Aba "Estilos": menu de transições, estilos de legenda, motions, efeitos
// de imagem e efeitos sonoros, cada um com um exemplo. Cite no chat com #
// ou aplique direto no projeto.

// Toca um efeito sonoro (um de cada vez).
let tocando: HTMLAudioElement | null = null;
const ouvir = (url: string) => {
  tocando?.pause();
  tocando = new Audio(url);
  void tocando.play();
};

const Cartao: React.FC<{
  item: ItemCatalogo<string>;
  exemplo: React.ReactNode;
  emUso?: boolean;
  aplicar: { rotulo: string; executar: () => void } | null;
}> = ({ item, exemplo, emUso, aplicar }) => (
  <article className="cartao-zine flex flex-col">
    <div className="relative aspect-video border-b-2 border-tinta bg-black">
      {exemplo}
      {emUso ? (
        <span className="absolute top-2 left-2 bg-spray px-2 py-0.5 font-mono text-[10px] tracking-widest text-papel uppercase">
          em uso
        </span>
      ) : null}
    </div>
    <div className="flex flex-1 flex-col gap-1.5 p-3">
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-2xl leading-none tracking-wide uppercase">
          {item.nome}
        </h3>
        <span className="font-mono text-xs text-spray">{item.tag}</span>
      </div>
      <p className="text-sm">{item.descricao}</p>
      <p className="text-xs text-zinc-500">
        <b className="font-mono tracking-wider uppercase">Use em:</b>{" "}
        {item.quandoUsar}
      </p>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <button
          onClick={() => citarNoChat(item.tag)}
          className="border-2 border-tinta px-2.5 py-1 font-mono text-[11px] tracking-wider uppercase hover:bg-tinta hover:text-papel"
          title="Escreve a #tag na caixa do chat"
        >
          Citar {item.tag} no chat
        </button>
        {aplicar ? (
          <button
            onClick={aplicar.executar}
            className="border-2 border-spray px-2.5 py-1 font-mono text-[11px] tracking-wider text-spray uppercase hover:bg-spray hover:text-papel"
          >
            {aplicar.rotulo}
          </button>
        ) : null}
      </div>
    </div>
  </article>
);

const Exemplo: React.FC<{
  componente: React.FC<Record<string, unknown>>;
  props: Record<string, unknown>;
  duracao: number;
}> = ({ componente, props, duracao }) => (
  <Player
    component={componente}
    inputProps={props}
    durationInFrames={duracao}
    fps={DEMO.fps}
    compositionWidth={DEMO.largura}
    compositionHeight={DEMO.altura}
    style={{ width: "100%", height: "100%" }}
    autoPlay
    loop
    initiallyMuted
    acknowledgeRemotionLicense
  />
);

export default function PaginaEstilos() {
  const { projeto, carregado, aplicar } = useProjeto();
  if (!carregado) return null;
  const { timeline } = projeto;
  const temCenas = timeline.clipes.length > 1;
  const estiloAtual = timeline.estiloLegenda ?? "classico";

  const aplicarTransicao = (tipo: TipoTransicao) =>
    aplicar((t) =>
      t.clipes.reduce(
        (acc, _, i) =>
          i === 0 ? acc : atualizarItem(acc, "clipes", i, { transicao: tipo }),
        t,
      ),
    );

  const aplicarEstilo = (estilo: EstiloLegenda) =>
    aplicar((t) => ({
      ...t,
      estiloLegenda: estilo,
      legendas: t.legendas.map((l) => ({ ...l, estilo: undefined })),
    }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-10 p-6">
        <header>
          <h1 className="relative inline-block font-display text-6xl leading-none tracking-tight uppercase">
            Estilos
            <span className="absolute -top-5 -right-52 -rotate-12 font-marca text-3xl normal-case text-spray">
              escolha o seu!
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm">
            Veja cada efeito funcionando. Para usar, cite a{" "}
            <b className="font-mono">#tag</b> no chat — por exemplo{" "}
            <i>“coloque #cortina entre as cenas”</i> ou{" "}
            <i>“legende o vídeo com #karaoke”</i> ou{" "}
            <i>“aplique #sem-ruido no @principal”</i> ou{" "}
            <i>“coloque um #contador quando eu falo 5 mil clientes”</i> ou{" "}
            <i>“deixa o vídeo mais dinâmico”</i> — ou aplique direto aqui.
          </p>
        </header>

        <section>
          <h2 className="rotulo-zine mb-3">Transições entre cenas</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TRANSICOES.map((t) => (
              <Cartao
                key={t.id}
                item={t}
                exemplo={
                  <Exemplo
                    componente={
                      DemoTransicao as React.FC<Record<string, unknown>>
                    }
                    props={{ tipo: t.id }}
                    duracao={DURACAO_DEMO_TRANSICAO}
                  />
                }
                aplicar={
                  temCenas
                    ? {
                        rotulo: "Usar em todas as cenas",
                        executar: () => aplicarTransicao(t.id),
                      }
                    : null
                }
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="rotulo-zine mb-3">Estilos de legenda</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ESTILOS_LEGENDA.map((e) => (
              <Cartao
                key={e.id}
                item={e}
                emUso={estiloAtual === e.id}
                exemplo={
                  <Exemplo
                    componente={
                      DemoLegenda as React.FC<Record<string, unknown>>
                    }
                    props={{ estilo: e.id }}
                    duracao={DURACAO_DEMO_LEGENDA}
                  />
                }
                aplicar={{
                  rotulo: estiloAtual === e.id ? "Em uso" : "Usar nas legendas",
                  executar: () => aplicarEstilo(e.id),
                }}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="rotulo-zine mb-1">Motions (textos animados)</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Entram por cima do vídeo, abaixo das legendas. No texto,{" "}
            <b className="font-mono">*palavra*</b> sai na cor de destaque. Na
            Timeline: “+ Motion aqui” e troque o modelo no painel.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MOTIONS.map((m) => (
              <Cartao
                key={m.id}
                item={m}
                exemplo={
                  <Exemplo
                    componente={DemoMotion as React.FC<Record<string, unknown>>}
                    props={{ modelo: m.id }}
                    duracao={DURACAO_DEMO_MOTION}
                  />
                }
                aplicar={null}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="rotulo-zine mb-1">Efeitos de imagem</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Valem para um trecho do vídeo (cenas e inserts). Na Timeline: “+
            Efeito aqui” e troque o efeito no painel.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {EFEITOS_VISUAIS.map((e) => (
              <Cartao
                key={e.id}
                item={e}
                exemplo={
                  <Exemplo
                    componente={DemoEfeito as React.FC<Record<string, unknown>>}
                    props={{ tipo: e.id }}
                    duracao={DURACAO_DEMO_EFEITO}
                  />
                }
                aplicar={null}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="rotulo-zine mb-1">Efeitos sonoros</h2>
          <p className="mb-3 text-sm text-zinc-500">
            Criados pelo próprio encEditor (sem direito autoral). Na Timeline,
            “+ Som aqui”; no chat, “coloque efeitos sonoros” põe o som certo em
            cada transição, motion e efeito.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SONS.map((s) => (
              <div
                key={s.id}
                className="cartao-zine flex items-start gap-3 p-3"
              >
                <button
                  onClick={() => ouvir(arquivoDoSom(s.id))}
                  className="botao-spray shrink-0 !px-3 !py-2"
                  title="Ouvir"
                >
                  ▶
                </button>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <b className="font-display text-xl leading-none tracking-wide uppercase">
                      {s.nome}
                    </b>
                    <span className="font-mono text-xs text-spray">
                      {s.tag}
                    </span>
                  </p>
                  <p className="text-sm">{s.descricao}</p>
                  <p className="text-xs text-zinc-500">
                    <b className="font-mono tracking-wider uppercase">
                      Use em:
                    </b>{" "}
                    {s.quandoUsar}
                  </p>
                  <button
                    onClick={() => citarNoChat(s.tag)}
                    className="mt-1 font-mono text-[11px] text-spray uppercase underline"
                  >
                    Citar {s.tag} no chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <EfeitosAudio />
      </div>
    </div>
  );
}

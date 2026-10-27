import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Img,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
} from "remotion";
import {
  estiloDoFundo,
  normalizarTimeline,
  Timeline,
} from "../../timeline/schema";
import {
  calcularClipes,
  calcularDuracaoTotal,
  inicioDosClipes,
  validarTimeline,
} from "../../timeline/calculos";
import { Audios } from "./Audios";
import { Efeitos } from "./Efeitos";
import { FundoAnimado, FUNDOS_CLAROS } from "./Fundos";
import { TemaContexto } from "./motionBase";
import { Inserts } from "./Inserts";
import { Legendas } from "./Legendas";
import { Medidor } from "./Medidor";
import { Motions } from "./Motions";
import { PREMONTAR_S } from "./premontar";
import { ClipeComTransicoes } from "./transicoes";
import { Zoom } from "./Zoom";

// Ajusta duração, fps e tamanho do vídeo a partir do JSON recebido.
export const calcularMetadata: CalculateMetadataFunction<Timeline> = ({
  props,
}) => {
  validarTimeline(props);
  const clipes = calcularClipes(props);
  return {
    durationInFrames: Math.max(1, calcularDuracaoTotal(clipes)),
    fps: props.fps,
    width: props.largura,
    height: props.altura,
  };
};

// Camadas, de baixo para cima: trilha principal → inserts (os dois sob o
// zoom e os efeitos, como uma câmera) → motions → legendas. O áudio não
// aparece na tela.
export const EditorTimeline: React.FC<Timeline> = (recebida) => {
  // Versões exportadas antes das faixas Motion e Efeitos chegam sem elas.
  const timeline = normalizarTimeline(recebida);
  const clipes = calcularClipes(timeline);
  const inicios = inicioDosClipes(clipes);
  const duracaoTotal = calcularDuracaoTotal(clipes);
  const { width, height } = useVideoConfig();
  // Tema para os motions: a paleta da direção de arte e quando o fundo
  // atrás deles é claro (o texto solto fica escuro).
  const paleta = timeline.direcaoDeArte?.cores;
  const tema = {
    cores: paleta ?? null,
    fundoClaroEm: (segundo: number) => {
      const quadro = segundo * timeline.fps;
      const i = clipes.findIndex(
        (c, k) => quadro >= inicios[k] && quadro < inicios[k] + c.duracaoFrames,
      );
      return (
        i >= 0 &&
        clipes[i].tipo === "fundo" &&
        FUNDOS_CLAROS.includes(estiloDoFundo(clipes[i].url))
      );
    },
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }} data-raiz-video>
      <Efeitos efeitos={timeline.efeitos}>
        <Zoom zooms={timeline.zooms}>
          {clipes.map((clipe, i) => (
            <Sequence
              key={i}
              from={inicios[i]}
              durationInFrames={clipe.duracaoFrames}
              name={`Clipe ${i + 1}`}
              premountFor={PREMONTAR_S * timeline.fps}
              // A 1ª cena continua montada até o fim: ao repetir o vídeo
              // (ou voltar ao início) ela já está carregada, sem piscar.
              postmountFor={i === 0 ? duracaoTotal : undefined}
            >
              <ClipeComTransicoes
                clipe={clipe}
                proximo={clipes[i + 1]}
                largura={width}
                altura={height}
              >
                {clipe.tipo === "fundo" ? (
                  <FundoAnimado
                    estilo={estiloDoFundo(clipe.url)}
                    ajustes={clipe.fundo}
                    paleta={paleta}
                  />
                ) : clipe.tipo === "imagem" ? (
                  <Img
                    src={clipe.url}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <OffthreadVideo
                    src={clipe.url}
                    trimBefore={clipe.trimInicio}
                    trimAfter={clipe.trimFim}
                    volume={clipe.volume}
                    playbackRate={clipe.velocidade ?? 1}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </ClipeComTransicoes>
            </Sequence>
          ))}
          <Inserts inserts={timeline.inserts} />
        </Zoom>
      </Efeitos>
      <TemaContexto.Provider value={tema}>
        <Motions motions={timeline.motions} />
      </TemaContexto.Provider>
      <Legendas
        legendas={timeline.legendas}
        estiloPadrao={timeline.estiloLegenda}
        aparencia={timeline.aparenciaLegendas}
      />
      <Audios audios={timeline.audios} />
      <Medidor />
    </AbsoluteFill>
  );
};

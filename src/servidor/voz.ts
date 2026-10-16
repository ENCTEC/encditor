import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { lerPlanoSalvo, PlanoSalvo } from "@/plano/tipos";
import { Voz } from "@/plano/vozes";
import { apagarArquivos, reservarArquivo } from "./armazenamento";
import { lerPlano, salvarPlano } from "./banco";
import { rodarFfmpeg } from "./ffmpeg";
import { clienteOpenAI, comNovaTentativa, MODELOS } from "./openai";

// Narração de EXEMPLO com voz sintética, para o usuário ouvir e copiar a
// entonação na hora de gravar. Cada fala é lida seguindo as indicações do
// guia de gravação (entonação, ênfase, ritmo) e as falas são juntadas com
// as pausas do plano. Fica em cache: só refaz se o texto/indicações ou a
// voz mudarem.

const RITMO = {
  lento: "devagar, bem pausado",
  normal: "no ritmo natural de anúncio",
  rapido: "rápido e com energia",
} as const;

const instrucoesDaFala = (
  orientacoes: string,
  c: { entonacao: string; enfase: string[]; ritmo: keyof typeof RITMO },
) =>
  [
    "Narração de anúncio para Reels/TikTok, em português do Brasil, com sotaque brasileiro natural.",
    orientacoes ? `Tom geral: ${orientacoes}.` : "",
    c.entonacao ? `Neste trecho: ${c.entonacao}.` : "",
    `Fale ${RITMO[c.ritmo]}.`,
    c.enfase.length ? `Dê ênfase clara em: ${c.enfase.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

// Fala por fala (as que têm texto), com tudo o que influencia o áudio.
const falasDoPlano = (plano: PlanoSalvo) =>
  (plano.gerado?.cenas ?? [])
    .filter((c) => c.fala.trim())
    .map((c) => ({
      cena: c.numero,
      texto: c.fala.trim(),
      instrucoes: instrucoesDaFala(
        plano.gerado?.narracao?.orientacoes ?? "",
        c,
      ),
      pausa: Math.min(1.5, Math.max(0, c.pausa_depois_s)),
    }));

export const chaveDaVoz = (plano: PlanoSalvo, voz: string) =>
  createHash("sha1")
    .update(JSON.stringify([voz, MODELOS.voz, falasDoPlano(plano)]))
    .digest("hex");

const LEITURAS_AO_MESMO_TEMPO = 3;

export const gerarVozTeste = async (projetoId: string, voz: Voz) => {
  const plano = lerPlanoSalvo(lerPlano(projetoId));
  const falas = falasDoPlano(plano);
  if (!falas.length) throw new Error("O plano ainda não tem falas.");
  const chave = chaveDaVoz(plano, voz);
  if (plano.vozTeste?.chave === chave) return plano;

  const novos: string[] = [];
  try {
    // Lê as falas (algumas ao mesmo tempo) e guarda cada uma.
    const trechos: { cena: number; arquivo: string; caminho: string }[] =
      new Array(falas.length);
    for (let i = 0; i < falas.length; i += LEITURAS_AO_MESMO_TEMPO) {
      await Promise.all(
        falas.slice(i, i + LEITURAS_AO_MESMO_TEMPO).map(async (f, j) => {
          const resposta = await comNovaTentativa(() =>
            clienteOpenAI().audio.speech.create({
              model: MODELOS.voz,
              voice: voz,
              input: f.texto,
              instructions: f.instrucoes,
              response_format: "mp3",
            }),
          );
          const destino = await reservarArquivo(".mp3");
          await writeFile(
            destino.caminho,
            Buffer.from(await resposta.arrayBuffer()),
          );
          novos.push(destino.nome);
          trechos[i + j] = {
            cena: f.cena,
            arquivo: destino.nome,
            caminho: destino.caminho,
          };
        }),
      );
    }

    // Junta tudo com as pausas do plano (silêncio entre as falas).
    const completo = await reservarArquivo(".mp3");
    novos.push(completo.nome);
    const entradas: string[] = [];
    const rotulos: string[] = [];
    trechos.forEach((t, i) => {
      entradas.push("-i", t.caminho);
      rotulos.push(`[${rotulos.length}:a]`);
      const pausa = falas[i].pausa;
      if (pausa > 0 && i < trechos.length - 1) {
        entradas.push(
          "-f",
          "lavfi",
          "-t",
          String(pausa),
          "-i",
          "anullsrc=r=24000:cl=mono",
        );
        rotulos.push(`[${rotulos.length}:a]`);
      }
    });
    await rodarFfmpeg([
      ...entradas,
      "-filter_complex",
      `${rotulos
        .map((r) => `${r}aresample=24000,aformat=channel_layouts=mono`)
        .map((f, i) => `${f}[p${i}]`)
        .join(
          ";",
        )};${rotulos.map((_, i) => `[p${i}]`).join("")}concat=n=${rotulos.length}:v=0:a=1[saida]`,
      "-map",
      "[saida]",
      "-b:a",
      "128k",
      completo.caminho,
    ]);

    // Troca a narração de exemplo anterior (os arquivos velhos saem).
    const anterior = plano.vozTeste;
    const novo: PlanoSalvo = {
      ...plano,
      vozTeste: {
        voz,
        chave,
        doPlano: plano.geradoEm,
        arquivo: completo.nome,
        trechos: trechos.map(({ cena, arquivo }) => ({ cena, arquivo })),
      },
    };
    salvarPlano(projetoId, novo);
    if (anterior) {
      await apagarArquivos([
        anterior.arquivo,
        ...anterior.trechos.map((t) => t.arquivo),
      ]);
    }
    console.log(
      `[ia] voz de exemplo ${MODELOS.voz}/${voz}: ${falas.length} fala(s)`,
    );
    return novo;
  } catch (e) {
    await apagarArquivos(novos);
    throw e;
  }
};

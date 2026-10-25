/* global process, console -- script do Node */
// Gera a biblioteca de efeitos sonoros do encEditor (public/sons/*.mp3)
// com o ffmpeg, por síntese: ruído, tons e varreduras calculados por
// fórmula. Nada é gravado de terceiros, então não há direito autoral.
// Rodar de novo só se mudar alguma fórmula: node scripts/gerar-sons.mjs
//
// As fórmulas usam o aevalsrc do ffmpeg (t = tempo em segundos; random(0) =
// ruído). Vírgulas dentro de funções precisam ir como "\," no filtro.

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const PASTA = path.join(import.meta.dirname, "..", "public", "sons");
mkdirSync(PASTA, { recursive: true });

const ruido = "(2*random(0)-1)";

const SONS = [
  {
    id: "whoosh",
    d: 0.7,
    // Ruído que cresce e some (seno² como envelope), filtrado em banda e
    // com flanger para dar a sensação de passagem.
    expr: `${ruido}*sin(PI*t/0.7)*sin(PI*t/0.7)`,
    filtros:
      "bandpass=f=1000:width_type=o:width=2.5,flanger=delay=3:depth=6:speed=1.2,volume=2.6",
  },
  {
    id: "swoosh",
    d: 0.35,
    expr: `${ruido}*sin(PI*t/0.35)*sin(PI*t/0.35)`,
    filtros:
      "bandpass=f=2400:width_type=o:width=2,flanger=delay=2:depth=4:speed=2,volume=2.4",
  },
  {
    id: "pop",
    d: 0.18,
    // Tom que cai de 700 Hz para ~160 Hz bem rápido.
    expr: "0.9*sin(2*PI*(700*t-1500*t*t))*exp(-25*t)",
    filtros: "highpass=f=90",
  },
  {
    id: "clique",
    d: 0.05,
    expr: `${ruido}*exp(-300*t)`,
    filtros: "highpass=f=1500,volume=1.6",
  },
  {
    id: "boom",
    d: 1.4,
    // Grave que desce de 90 Hz com um "tum" de ruído no ataque.
    expr: `0.9*sin(2*PI*(90*t-25*t*t))*exp(-3.5*t)+0.5*${ruido}*exp(-25*t)`,
    filtros: "lowpass=f=320,volume=1.8",
  },
  {
    id: "ding",
    d: 1.3,
    // Sino: fundamental + harmônicos que somem mais rápido.
    expr: "0.55*sin(2*PI*1568*t)*exp(-3*t)+0.25*sin(2*PI*3136*t)*exp(-4.5*t)+0.12*sin(2*PI*4704*t)*exp(-7*t)",
    filtros: "",
  },
  {
    id: "caixa",
    d: 1.0,
    // "Tchan-tchan" de caixa registradora: dois sinos, o 2º mais agudo.
    expr: "0.45*sin(2*PI*1760*t)*exp(-6*t)+0.45*sin(2*PI*2637*(t-0.12))*exp(-5*(t-0.12))*gte(t\\,0.12)+0.15*sin(2*PI*5274*(t-0.12))*exp(-9*(t-0.12))*gte(t\\,0.12)",
    filtros: "",
  },
  {
    id: "subida",
    d: 1.6,
    // Riser: tom subindo de 150 Hz a ~1.270 Hz e ruído crescendo junto.
    expr: `0.5*sin(2*PI*(150*t+350*t*t))*(t/1.6)+0.3*${ruido}*(t/1.6)*(t/1.6)`,
    filtros: "highpass=f=120",
  },
  {
    id: "falha",
    d: 0.45,
    // Glitch: rajadas de ruído picotado + zumbido, com o som "esmagado".
    expr: `(0.6*${ruido}+0.35*sin(2*PI*180*t))*floor(1+0.5*sin(2*PI*17*t))`,
    filtros: "acrusher=bits=5:samples=12:mix=1,volume=1.4",
  },
  {
    id: "obturador",
    d: 0.25,
    // Dois cliques de câmera fotográfica.
    expr: `${ruido}*(exp(-120*t)+0.7*exp(-120*abs(t-0.07)))`,
    filtros: "bandpass=f=3000:width_type=o:width=3,volume=2.2",
  },
];

for (const som of SONS) {
  const saida = path.join(PASTA, `${som.id}.mp3`);
  const fimDoFade = Math.max(0, som.d - 0.03).toFixed(3);
  const filtros = [
    som.filtros,
    // Sem estalo no fim e sem passar do volume máximo.
    `afade=t=out:st=${fimDoFade}:d=0.03`,
    "alimiter=limit=0.89:attack=1:release=20",
  ]
    .filter(Boolean)
    .join(",");
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      `aevalsrc=exprs=${som.expr}:d=${som.d}:s=44100`,
      "-af",
      filtros,
      "-ac",
      "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "96k",
      saida,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(`✗ ${som.id}: ${r.stderr}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${som.id}.mp3`);
  }
}

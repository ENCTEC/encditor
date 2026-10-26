import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring } from "remotion";
import { caixaDoCelular } from "../../timeline/caixas";
import { EventoDaConversa } from "../../timeline/schema";
import { FONTES } from "./fontes";
import { BRANCO, Ctx, entrada, LIMITE, Lugar, semAsteriscos } from "./motionBase";
import {
  CINZA,
  comAlfa,
  COR_NEON,
  corDoBrilho,
  corNaPosicao,
  degrade,
  LINHA_VIDRO,
  MAO,
  pedacos,
  quadrosDasPalavras,
  TextoNeon,
  VIDRO,
} from "./neonBase";

// Telas "sob medida" do kit neon, como as dos vídeos feitos só de motion:
// conversa (um chat no estilo WhatsApp montado dentro de um celular, com o
// roteiro em motion.eventos), edicao (uma timeline de edição se montando
// sozinha) e rec (cartão de gravação com REC e relógio).

const SUAVE = Easing.inOut(Easing.cubic);

// ---------- conversa ----------

// Cores do modo escuro do app de mensagens.
const ZAP = {
  fundo: "#0B141A",
  barra: "#1F2C34",
  minha: "#005C4B",
  dele: "#1F2C34",
  verde: "#00A884",
  texto: "#E9EDEF",
  cinza: "#8696A0",
  azul: "#53BDEB",
  campo: "#2A3942",
};

// Contatos de mentira da lista (o 1º é sempre o da conversa).
const OUTROS = [
  { nome: "Mãe", previa: "Já chegou em casa?", hora: "21:30", cor: "#EF6C8A" },
  { nome: "Equipe Vendas", previa: "Bateu a meta hoje!", hora: "20:58", cor: "#26A69A" },
  { nome: "João Pedro", previa: "Valeu, mano!", hora: "19:12", cor: "#FFA726" },
  { nome: "Academia Fit", previa: "Seu treino de amanhã", hora: "18:40", cor: "#42A5F5" },
  { nome: "Pizzaria do Zé", previa: "Pedido saiu para entrega", hora: "Ontem", cor: "#8D6E63" },
  { nome: "Ana Clara", previa: "Kkkkk verdade", hora: "Ontem", cor: "#AB47BC" },
];

// Aproximações da câmera dentro do celular: o ponto "oy" (fração da altura
// do celular) vai para "destino" (fração da altura da tela), "escala" vezes
// maior.
const ZOOMS: Record<string, { escala: number; oy: number; destino: number }> = {
  baixo: { escala: 1.75, oy: 0.94, destino: 0.6 },
  mensagens: { escala: 1.5, oy: 0.8, destino: 0.56 },
  topo: { escala: 1.45, oy: 0.1, destino: 0.3 },
  meio: { escala: 1.35, oy: 0.55, destino: 0.52 },
  normal: { escala: 1, oy: 0.5, destino: 0.5 },
};

type Msg = {
  chave: string;
  tipo: "audio" | "texto" | "digitando" | "joinha";
  minha: boolean;
  q: number;
  ate?: number;
  texto?: string;
  palavras?: EventoDaConversa["palavras"];
};

// Visto duplo (azul = lido).
const Vistos: React.FC<{ tamanho: number; lido: boolean }> = ({ tamanho, lido }) => (
  <svg width={tamanho * 1.5} height={tamanho} viewBox="0 0 24 16">
    <path
      d="M1 9 L5 13 L13 3 M9 11 L11 13 L19 3"
      fill="none"
      stroke={lido ? ZAP.azul : ZAP.cinza}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Avatar: React.FC<{ nome: string; cor: string; tamanho: number }> = ({
  nome,
  cor,
  tamanho,
}) => (
  <div
    style={{
      width: tamanho,
      height: tamanho,
      flexShrink: 0,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${cor}, ${comAlfa(cor, 0.6)})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: BRANCO,
      fontWeight: 700,
      fontSize: tamanho * 0.45,
    }}
  >
    {nome.trim().charAt(0).toUpperCase()}
  </div>
);

// Barras da onda de um áudio: "valores" de 0 a 1.
const Onda: React.FC<{
  valores: number[];
  altura: number;
  largura: number;
  cor: string;
}> = ({ valores, altura, largura, cor }) => {
  const passo = largura / Math.max(1, valores.length);
  return (
    <div style={{ display: "flex", alignItems: "center", height: altura, width: largura }}>
      {valores.map((v, i) => (
        <div
          key={i}
          style={{
            width: passo * 0.55,
            marginRight: passo * 0.45,
            height: Math.max(altura * 0.12, altura * Math.min(1, v)),
            borderRadius: passo,
            backgroundColor: cor,
          }}
        />
      ))}
    </div>
  );
};

// Volume da voz num instante (segundos desde o início do motion), pelo
// motion.onda; sem onda, um valor "de voz" inventado (sempre igual).
const volumeEm = (c: Ctx, s: number) => {
  const onda = c.motion.onda;
  if (onda?.valores.length) {
    const i = Math.floor((s - onda.de) * onda.taxa);
    return i >= 0 && i < onda.valores.length ? onda.valores[i] : 0;
  }
  return 0.25 + 0.6 * Math.abs(Math.sin(s * 7.3) * Math.sin(s * 2.1 + 1));
};

const Conversa: React.FC<{ c: Ctx }> = ({ c }) => {
  const { frame, fps, largura, altura, u, motion } = c;
  const contato = semAsteriscos(motion.detalhe?.trim() || "Contato");
  const caixa = caixaDoCelular(largura / altura, null);
  const L = (caixa.largura / 100) * largura;
  const A = (caixa.altura / 100) * altura;
  const topo = (caixa.y / 100) * altura;
  const borda = L * 0.034;
  const raio = L * 0.13;
  const sw = L - borda * 2;
  const sh = A - borda * 2;
  // Medida da tela do celular: um pouco maior que a de um celular de
  // verdade, para dar para ler no vídeo.
  const p = (sw / 100) * 1.2;

  // Roteiro em quadros, na ordem.
  const evs = (motion.eventos ?? [])
    .map((e, i) => ({ ...e, q: Math.round(e.de * fps), i }))
    .sort((a, b) => a.q - b.q || a.i - b.i);
  const primeiro = (acao: string) => evs.find((e) => e.acao === acao);
  const listaQ = primeiro("lista")?.q ?? 0;
  const abrirQ = primeiro("abrir")?.q ?? Infinity;
  const gravarQ = primeiro("gravar")?.q ?? Infinity;
  const enviarAudioQ = primeiro("enviar_audio")?.q ?? Infinity;
  const gravando = frame >= gravarQ && frame < enviarAudioQ;

  // Mensagens (na ordem em que aparecem).
  const msgs: Msg[] = [];
  let escrita: (typeof evs)[number] | null = null;
  evs.forEach((e, k) => {
    if (e.acao === "enviar_audio") {
      msgs.push({ chave: `a${k}`, tipo: "audio", minha: true, q: e.q });
    } else if (e.acao === "digitando") {
      const fim = evs.find(
        (x) => x.q > e.q && (x.acao === "recebe" || x.acao === "joinha"),
      );
      msgs.push({ chave: `d${k}`, tipo: "digitando", minha: false, q: e.q, ate: fim?.q ?? e.q + fps * 2 });
    } else if (e.acao === "recebe") {
      msgs.push({ chave: `r${k}`, tipo: "texto", minha: false, q: e.q, texto: e.texto ?? "", palavras: e.palavras });
    } else if (e.acao === "escreve") {
      escrita = e;
    } else if (e.acao === "envia") {
      msgs.push({ chave: `e${k}`, tipo: "texto", minha: true, q: e.q, texto: escrita?.texto ?? e.texto ?? "" });
    } else if (e.acao === "joinha") {
      msgs.push({ chave: `j${k}`, tipo: "joinha", minha: false, q: e.q });
    }
  });
  const escreveEv = [...evs].reverse().find((e) => e.acao === "escreve" && e.q <= frame);
  const enviaDepois = escreveEv
    ? evs.find((e) => e.acao === "envia" && e.q > escreveEv.q)
    : undefined;
  const escrevendo = !!escreveEv && (!enviaDepois || frame < enviaDepois.q);
  const digitandoAgora = msgs.some(
    (m) => m.tipo === "digitando" && frame >= m.q && frame < (m.ate ?? 0),
  );

  // Entrada (sobe de baixo, um pouco torto) e saída (desce).
  const sobe = spring({ frame, fps, config: { stiffness: 110, damping: 17, mass: 0.9 } });
  const desce = interpolate(frame, [c.duracao - 10, c.duracao], [0, 1], {
    ...LIMITE,
    easing: Easing.in(Easing.cubic),
  });

  // Câmera dentro do celular (eventos "zoom").
  const zooms = evs.filter((e) => e.acao === "zoom" && e.q <= frame);
  const atualZ = zooms.at(-1);
  const anteriorZ = zooms.at(-2);
  const alvo = { ...ZOOMS[atualZ?.texto ?? "normal"] ?? ZOOMS.normal };
  const antes = { ...ZOOMS[anteriorZ?.texto ?? "normal"] ?? ZOOMS.normal };
  if (antes.escala === 1) antes.oy = alvo.oy;
  if (alvo.escala === 1) alvo.oy = antes.oy;
  const t = atualZ
    ? interpolate(frame, [atualZ.q, atualZ.q + 14], [0, 1], { ...LIMITE, easing: SUAVE })
    : 1;
  const escala = antes.escala + (alvo.escala - antes.escala) * t;
  const oy = antes.oy + (alvo.oy - antes.oy) * t;
  const deslocamento = (z: typeof alvo) =>
    z.escala === 1 ? 0 : z.destino * altura - (topo + z.oy * A);
  const dy = deslocamento(antes) + (deslocamento(alvo) - deslocamento(antes)) * t;

  // Telas: lista (com esqueleto antes) e conversa (desliza da direita).
  const abre = interpolate(frame, [abrirQ, abrirQ + 10], [0, 1], { ...LIMITE, easing: SUAVE });
  const carregada = interpolate(frame, [listaQ, listaQ + 6], [0, 1], LIMITE);
  const brilhoEsqueleto = ((frame % 40) / 40) * 140 - 20;

  const barraDeStatus = (
    <div
      style={{
        height: p * 9,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: `0 ${p * 7}px ${p * 1.2}px`,
        fontSize: p * 3.6,
        fontWeight: 600,
        color: ZAP.texto,
      }}
    >
      <span>21:47</span>
      <span style={{ display: "flex", gap: p * 1, alignItems: "flex-end" }}>
        {[1.2, 1.8, 2.4, 3].map((h, i) => (
          <span key={i} style={{ width: p * 0.8, height: p * h, background: ZAP.texto, borderRadius: p * 0.3 }} />
        ))}
        <span style={{ width: p * 5.5, height: p * 2.8, border: `${p * 0.35}px solid ${ZAP.texto}`, borderRadius: p * 0.8, marginLeft: p }} />
      </span>
    </div>
  );

  const contatos = [
    { nome: contato, previa: "Bora gravar aquele vídeo?", hora: "21:45", cor: "#7C4DFF", naoLidas: 2 },
    ...OUTROS.map((o) => ({ ...o, naoLidas: 0 })),
  ];
  const itemAltura = p * 17;
  const listaTopo = p * 9 + p * 13 + p * 11 + p * 9; // status + título + busca + filtros

  const lista = (
    <AbsoluteFill style={{ backgroundColor: ZAP.fundo }}>
      {barraDeStatus}
      <div style={{ height: p * 13, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${p * 5}px` }}>
        <span style={{ fontSize: p * 7, fontWeight: 700, color: ZAP.texto, opacity: carregada }}>WhatsApp</span>
        <span style={{ display: "flex", gap: p * 4 }}>
          <span style={{ width: p * 4.5, height: p * 4.5, borderRadius: p, border: `${p * 0.5}px solid ${ZAP.texto}` }} />
          <span style={{ display: "flex", flexDirection: "column", gap: p * 0.7, justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: p * 1, height: p * 1, borderRadius: "50%", background: ZAP.texto }} />
            ))}
          </span>
        </span>
      </div>
      <div style={{ margin: `0 ${p * 4}px`, height: p * 9, borderRadius: p * 5, background: ZAP.campo, display: "flex", alignItems: "center", padding: `0 ${p * 4}px`, fontSize: p * 3.6, color: ZAP.cinza }}>
        Pesquisar
      </div>
      <div style={{ display: "flex", gap: p * 2, padding: `${p * 2.5}px ${p * 4}px` }}>
        {["Tudo", "Não lidas", "Favoritas", "Grupos"].map((x, i) => (
          <span key={x} style={{ padding: `${p * 1.2}px ${p * 3}px`, borderRadius: p * 5, fontSize: p * 3.2, fontWeight: 600, background: i === 0 ? "#103529" : ZAP.campo, color: i === 0 ? "#D9FDD3" : ZAP.cinza }}>
            {x}
          </span>
        ))}
      </div>
      {contatos.map((k, i) => {
        const surge = spring({ frame: frame - listaQ - i * 3, fps, config: { stiffness: 200, damping: 20 } });
        const carregou = frame >= listaQ + i * 3;
        return (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: listaTopo + i * itemAltura, height: itemAltura, display: "flex", alignItems: "center", gap: p * 4, padding: `0 ${p * 5}px` }}>
            {carregou ? (
              <div style={{ display: "flex", alignItems: "center", gap: p * 4, width: "100%", opacity: surge, transform: `translateY(${(1 - surge) * p * 4}px)` }}>
                <Avatar nome={k.nome} cor={k.cor} tamanho={p * 12} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: p * 4.2, fontWeight: 600, color: ZAP.texto }}>{k.nome}</span>
                    <span style={{ fontSize: p * 3, color: k.naoLidas ? ZAP.verde : ZAP.cinza }}>{k.hora}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: p * 0.8 }}>
                    <span style={{ fontSize: p * 3.5, color: ZAP.cinza, whiteSpace: "nowrap", overflow: "hidden" }}>{k.previa}</span>
                    {k.naoLidas ? (
                      <span style={{ minWidth: p * 5, height: p * 5, borderRadius: p * 3, background: ZAP.verde, color: ZAP.fundo, fontSize: p * 3, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{k.naoLidas}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              // Esqueleto carregando (com brilho passando).
              <div style={{ display: "flex", alignItems: "center", gap: p * 4, width: "100%" }}>
                <div style={{ width: p * 12, height: p * 12, borderRadius: "50%", background: ZAP.campo }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: "55%", height: p * 3.4, borderRadius: p, background: `linear-gradient(90deg, ${ZAP.campo} ${brilhoEsqueleto - 20}%, #3B4A54 ${brilhoEsqueleto}%, ${ZAP.campo} ${brilhoEsqueleto + 20}%)` }} />
                  <div style={{ width: "80%", height: p * 2.8, marginTop: p * 2, borderRadius: p, background: ZAP.campo }} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );

  // ---- dentro da conversa ----
  const bolhaFonte = p * 4;
  const linhaAltura = bolhaFonte * 1.3;
  const larguraBolha = p * 64;
  const porLinha = Math.floor(larguraBolha / (bolhaFonte * 0.5));
  const alturaDa = (m: Msg) =>
    m.tipo === "audio"
      ? p * 15
      : m.tipo === "digitando"
        ? p * 11
        : m.tipo === "joinha"
          ? p * 30
          : Math.ceil(((m.texto ?? "").length + 8) / porLinha) * linhaAltura + p * 6;

  const bolha = (m: Msg) => {
    const s = spring({ frame: frame - m.q, fps, config: { stiffness: 230, damping: 19, mass: 0.6 } });
    // O "digitando" some quando a mensagem chega.
    const some =
      m.tipo === "digitando" && m.ate !== undefined
        ? interpolate(frame, [m.ate, m.ate + 5], [1, 0], LIMITE)
        : 1;
    const h = alturaDa(m) * s * some;
    const lado = m.minha ? "flex-end" : "flex-start";
    const fundo = m.minha ? ZAP.minha : ZAP.dele;
    const hora = (
      <span style={{ fontSize: p * 2.8, color: m.minha ? "#9FD6C6" : ZAP.cinza, marginLeft: p * 2, display: "inline-flex", alignItems: "center", gap: p * 0.6, whiteSpace: "nowrap" }}>
        21:48
        {m.minha ? <Vistos tamanho={p * 2.6} lido={frame > m.q + fps * 1.2} /> : null}
      </span>
    );
    let conteudo: React.ReactNode = null;
    if (m.tipo === "digitando") {
      conteudo = (
        <div style={{ display: "flex", gap: p * 1.2, padding: `${p * 3}px ${p * 4}px` }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: p * 2, height: p * 2, borderRadius: "50%", background: ZAP.cinza, transform: `translateY(${Math.sin((frame - m.q) / 3 - i) * p * 0.8}px)`, opacity: 0.6 + 0.4 * Math.sin((frame - m.q) / 3 - i) }} />
          ))}
        </div>
      );
    } else if (m.tipo === "audio") {
      const dur = (enviarAudioQ - gravarQ) / fps;
      const barras = Array.from({ length: 30 }, (_, i) =>
        volumeEm(c, gravarQ / fps + ((i + 0.5) / 30) * dur),
      );
      conteudo = (
        <div style={{ display: "flex", alignItems: "center", gap: p * 3, padding: `${p * 2.5}px ${p * 3}px` }}>
          <svg width={p * 5} height={p * 5} viewBox="0 0 24 24">
            <path d="M7 4 L20 12 L7 20 Z" fill={ZAP.texto} />
          </svg>
          <div>
            <Onda valores={barras} altura={p * 6} largura={p * 32} cor="#C7E8DF" />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: p * 2.8, color: "#9FD6C6", marginTop: p * 0.5 }}>
              <span>{`0:${String(Math.max(1, Math.round(dur))).padStart(2, "0")}`}</span>
              {hora}
            </div>
          </div>
          <div style={{ width: p * 9, height: p * 9, borderRadius: "50%", background: "#7C4DFF", position: "relative" }}>
            <span style={{ position: "absolute", right: -p, bottom: -p * 0.5, width: p * 4, height: p * 4, borderRadius: "50%", background: ZAP.azul }} />
          </div>
        </div>
      );
    } else if (m.tipo === "joinha") {
      const estouro = interpolate(frame - m.q, [0, 16], [0, 1], { ...LIMITE, easing: Easing.out(Easing.cubic) });
      conteudo = (
        <div style={{ position: "relative", padding: p * 2 }}>
          {Array.from({ length: 8 }, (_, i) => {
            const ang = (i / 8) * Math.PI * 2;
            const dist = p * (8 + estouro * 10);
            return (
              <span key={i} style={{ position: "absolute", left: p * 14 + Math.cos(ang) * dist, top: p * 14 + Math.sin(ang) * dist, width: p * 1.6, height: p * 1.6, borderRadius: "50%", background: i % 2 ? "#FFD54F" : "#FFB300", opacity: 1 - estouro }} />
            );
          })}
          <svg width={p * 24} height={p * 24} viewBox="0 0 24 24" style={{ transform: `rotate(${(1 - s) * -25}deg)`, filter: `drop-shadow(0 ${p}px ${p * 2}px rgba(0,0,0,0.4))` }}>
            <defs>
              <linearGradient id="joinha" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFE082" />
                <stop offset="1" stopColor="#FFA000" />
              </linearGradient>
            </defs>
            <path d={MAO} fill="url(#joinha)" />
          </svg>
        </div>
      );
      return (
        <div style={{ height: h, display: "flex", justifyContent: lado, alignItems: "flex-end", overflow: "visible" }}>
          <div style={{ transform: `scale(${s})`, transformOrigin: "left bottom", opacity: Math.min(1, s * 2) }}>{conteudo}</div>
        </div>
      );
    } else {
      // Texto: recebida = palavras aparecem no tempo da fala; minha = inteira.
      const texto = m.texto ?? "";
      const palavras = texto.split(/\s+/).filter(Boolean);
      const quadros = m.minha
        ? palavras.map(() => m.q)
        : quadrosDasPalavras(c, palavras.length, m.q + 2, m.palavras);
      conteudo = (
        <div style={{ padding: `${p * 2}px ${p * 3}px ${p * 2}px`, fontSize: bolhaFonte, lineHeight: 1.3, color: ZAP.texto, maxWidth: larguraBolha }}>
          {palavras.map((w, i) => (
            <span key={i} style={{ opacity: frame >= quadros[i] ? 1 : 0 }}>{w} </span>
          ))}
          {hora}
        </div>
      );
    }
    return (
      <div style={{ height: h, display: "flex", justifyContent: lado, alignItems: "flex-end", overflow: "visible", opacity: some }}>
        <div
          style={{
            background: fundo,
            borderRadius: p * 3,
            borderTopRightRadius: m.minha ? p * 0.6 : p * 3,
            borderTopLeftRadius: m.minha ? p * 3 : p * 0.6,
            boxShadow: "0 1px 1px rgba(0,0,0,0.3)",
            transform: `scale(${0.85 + 0.15 * s})`,
            transformOrigin: m.minha ? "right bottom" : "left bottom",
            opacity: Math.min(1, s * 2),
            marginBottom: p * 1.5,
          }}
        >
          {conteudo}
        </div>
      </div>
    );
  };

  // Barra de baixo: campo + microfone; gravando = ponto vermelho, tempo e a
  // onda da voz correndo; escrevendo = texto digitado e botão de enviar.
  const segundos = Math.max(0, (frame - gravarQ) / fps);
  const ondaAoVivo = Array.from({ length: 28 }, (_, i) => {
    const s = (frame - (27 - i) * 2) / fps; // uma barra a cada 2 quadros
    return s * fps < gravarQ ? 0 : volumeEm(c, s);
  });
  const palavrasEscritas = escreveEv ? (escreveEv.texto ?? "").split(/\s+/).filter(Boolean) : [];
  const quadrosEscrita = escreveEv
    ? quadrosDasPalavras(c, palavrasEscritas.length, escreveEv.q + 2, escreveEv.palavras)
    : [];
  const botaoEnviar = gravando || escrevendo;
  const barraDeBaixo = (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: p * 16, display: "flex", alignItems: "center", gap: p * 2, padding: `0 ${p * 3}px ${p * 3}px` }}>
      <div style={{ flex: 1, height: p * 11, borderRadius: p * 6, background: ZAP.campo, display: "flex", alignItems: "center", gap: p * 2, padding: `0 ${p * 4}px`, fontSize: p * 3.8, color: ZAP.cinza, overflow: "hidden" }}>
        {gravando ? (
          <>
            <span style={{ width: p * 3, height: p * 3, borderRadius: "50%", background: "#F15C6D", opacity: Math.floor(frame / 10) % 2 ? 0.35 : 1 }} />
            <span style={{ color: ZAP.texto, fontVariantNumeric: "tabular-nums", minWidth: p * 9 }}>
              {`0:${String(Math.floor(segundos)).padStart(2, "0")}`}
            </span>
            <Onda valores={ondaAoVivo} altura={p * 7} largura={p * 36} cor={ZAP.texto} />
          </>
        ) : escrevendo ? (
          <span style={{ color: ZAP.texto, whiteSpace: "nowrap" }}>
            {palavrasEscritas.filter((_, i) => frame >= quadrosEscrita[i]).join(" ")}
            <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1, color: ZAP.verde }}>|</span>
          </span>
        ) : (
          "Mensagem"
        )}
      </div>
      <div style={{ width: p * 12, height: p * 12, borderRadius: "50%", background: ZAP.verde, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${gravando ? 1.08 + 0.05 * Math.sin(frame / 3) : 1})` }}>
        {botaoEnviar ? (
          <svg width={p * 6} height={p * 6} viewBox="0 0 24 24">
            <path d="M3 20 L21 12 L3 4 L5 11 L14 12 L5 13 Z" fill={ZAP.fundo} />
          </svg>
        ) : (
          <svg width={p * 6} height={p * 6} viewBox="-12 -12 24 24">
            <rect x={-3.6} y={-10} width={7.2} height={12.5} rx={3.6} fill={ZAP.fundo} />
            <path d="M -7 0 A 7 7 0 0 0 7 0 M 0 7 L 0 10.5" fill="none" stroke={ZAP.fundo} strokeWidth={2.2} strokeLinecap="round" />
          </svg>
        )}
      </div>
    </div>
  );

  const conversa = (
    <AbsoluteFill style={{ backgroundColor: ZAP.fundo, transform: `translateX(${(1 - abre) * 100}%)`, boxShadow: abre < 1 ? "-20px 0 40px rgba(0,0,0,0.6)" : undefined }}>
      {/* Desenho de fundo bem sutil. */}
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1.2px, transparent 1.6px)", backgroundSize: `${p * 6}px ${p * 6}px` }} />
      <div style={{ background: ZAP.barra }}>
        {barraDeStatus}
        <div style={{ height: p * 14, display: "flex", alignItems: "center", gap: p * 3, padding: `0 ${p * 3}px` }}>
          <svg width={p * 5} height={p * 5} viewBox="0 0 24 24">
            <path d="M15 4 L7 12 L15 20" fill="none" stroke={ZAP.texto} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <Avatar nome={contato} cor="#7C4DFF" tamanho={p * 10} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: p * 4.4, fontWeight: 600, color: ZAP.texto }}>{contato}</div>
            <div style={{ fontSize: p * 3.2, color: digitandoAgora ? ZAP.verde : ZAP.cinza }}>
              {digitandoAgora ? "digitando…" : "online"}
            </div>
          </div>
          <span style={{ width: p * 6, height: p * 4, borderRadius: p, border: `${p * 0.5}px solid ${ZAP.texto}` }} />
          <span style={{ width: p * 4, height: p * 4, borderRadius: "50%", border: `${p * 0.5}px solid ${ZAP.texto}`, marginLeft: p * 2 }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: p * 3, right: p * 3, top: p * 25, bottom: p * 16, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
        <div style={{ alignSelf: "center", marginBottom: p * 3, padding: `${p}px ${p * 3}px`, borderRadius: p * 2, background: ZAP.barra, color: ZAP.cinza, fontSize: p * 3, fontWeight: 600 }}>HOJE</div>
        {msgs.filter((m) => frame >= m.q).map((m) => (
          <React.Fragment key={m.chave}>{bolha(m)}</React.Fragment>
        ))}
      </div>
      {barraDeBaixo}
    </AbsoluteFill>
  );

  // Toques (dedo + onda) nos alvos da tela.
  const alvoDoToque = (nome: string | undefined): [number, number] =>
    nome === "conversa"
      ? [p * 30, listaTopo + itemAltura / 2]
      : nome === "campo"
        ? [p * 40, sh - p * 8.5]
        : [sw - p * 9, sh - p * 8.5];
  const toques = evs.filter((e) => e.acao === "toque" && frame >= e.q && frame < e.q + 24);

  return (
    <AbsoluteFill style={{ fontFamily: FONTES.interface }}>
      <div
        style={{
          position: "absolute",
          left: (caixa.x / 100) * largura,
          top: topo,
          width: L,
          height: A,
          transformOrigin: `50% ${oy * 100}%`,
          transform: `translateY(${dy + (1 - sobe + desce) * (altura - topo + A * 0.1)}px) scale(${escala}) rotate(${-(1 - sobe) * 7}deg)`,
          opacity: Math.min(1, sobe * 3),
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: raio,
            background: "linear-gradient(145deg, #3B3E4B 0%, #15161C 42%, #2B2D38 100%)",
            boxShadow: `0 ${u * 3}px ${u * 8}px rgba(0,0,0,0.55), 0 0 ${u * 5}px ${comAlfa(COR_NEON, 0.35)}, inset 0 0 0 ${Math.max(1, u * 0.25)}px rgba(255,255,255,0.2)`,
          }}
        />
        <div style={{ position: "absolute", inset: borda, borderRadius: raio - borda, overflow: "hidden", backgroundColor: ZAP.fundo }}>
          {frame < abrirQ + 10 ? lista : null}
          {frame >= abrirQ ? conversa : null}
          {toques.map((e) => {
            const [x, y] = alvoDoToque(e.texto);
            const f = frame - e.q;
            const chega = interpolate(f, [0, 5], [0, 1], LIMITE);
            const aperto = interpolate(f, [6, 9, 13], [1, 0.72, 1], LIMITE);
            const onda = interpolate(f, [8, 22], [0, 1], { ...LIMITE, easing: Easing.out(Easing.cubic) });
            const r = p * 5;
            return (
              <React.Fragment key={e.i}>
                <div style={{ position: "absolute", left: x - r * (1 + onda * 2), top: y - r * (1 + onda * 2), width: r * 2 * (1 + onda * 2), height: r * 2 * (1 + onda * 2), borderRadius: "50%", border: `${p * 0.7}px solid ${BRANCO}`, opacity: f >= 8 ? 0.85 * (1 - onda) : 0 }} />
                <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: "rgba(255,255,255,0.6)", border: `${p * 0.5}px solid rgba(255,255,255,0.95)`, opacity: chega * interpolate(f, [18, 24], [1, 0], LIMITE), transform: `scale(${(1.5 - 0.5 * chega) * aperto})` }} />
              </React.Fragment>
            );
          })}
          <div style={{ position: "absolute", top: sw * 0.03, left: "50%", width: sw * 0.3, height: sw * 0.08, transform: "translateX(-50%)", borderRadius: sw, backgroundColor: "#000" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- edição ----------

// Blocos da timeline: faixa, começo e tamanho (frações da largura).
const BLOCOS: { faixa: 0 | 1; x: number; w: number }[] = [
  { faixa: 1, x: 0, w: 0.24 },
  { faixa: 0, x: 0.02, w: 0.16 },
  { faixa: 1, x: 0.25, w: 0.2 },
  { faixa: 0, x: 0.2, w: 0.12 },
  { faixa: 1, x: 0.46, w: 0.17 },
  { faixa: 0, x: 0.36, w: 0.22 },
  { faixa: 1, x: 0.64, w: 0.15 },
  { faixa: 0, x: 0.6, w: 0.14 },
  { faixa: 1, x: 0.8, w: 0.2 },
  { faixa: 0, x: 0.77, w: 0.23 },
];

// Timeline de edição se montando sozinha: os blocos das faixas V1/V2
// entram um a um, a onda do áudio aparece em A1 e o cursor corre.
const Edicao: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, largura, motion, duracao } = c;
  const s = entrada(c, 0, 200, 18);
  const larguraCartao = Math.min(largura * 0.9, u * 92);
  const rotulos = u * 6;
  const pista = larguraCartao - u * 6 - rotulos;
  const altFaixa = u * 5.2;
  const montagem = Math.max(10, duracao * 0.75);
  const cursor = interpolate(frame, [4, duracao - 4], [0, 1], LIMITE);
  return (
    <Lugar posicao={motion.posicao} padrao="centro" estilo={{ opacity: c.saida }}>
      <div
        style={{
          width: larguraCartao,
          padding: u * 3,
          borderRadius: u * 2.4,
          background: VIDRO,
          border: `${Math.max(1, u * 0.15)}px solid ${LINHA_VIDRO}`,
          boxShadow: `0 ${u * 2}px ${u * 6}px rgba(0,0,0,0.5), 0 0 ${u * 4}px ${comAlfa(corDoBrilho(c), 0.25)}`,
          transform: `translateY(${(1 - s) * u * 6}px) scale(${0.92 + 0.08 * s})`,
          opacity: Math.min(1, s * 2),
          fontFamily: FONTES.forte,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: u * 2 }}>
          <span style={{ fontWeight: 800, fontSize: u * 2.4, letterSpacing: u * 0.3, color: CINZA, textTransform: "uppercase" }}>
            {semAsteriscos(motion.detalhe?.trim() || "Timeline · edição automática")}
          </span>
          <span style={{ display: "flex", gap: u * 0.8 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: u * 1.2, height: u * 1.2, borderRadius: "50%", background: corNaPosicao(c, i / 2) }} />
            ))}
          </span>
        </div>
        <div style={{ position: "relative" }}>
          {["V2", "V1", "A1"].map((nome, f) => (
            <div key={nome} style={{ display: "flex", alignItems: "center", height: altFaixa, marginBottom: u * 0.9 }}>
              <span style={{ width: rotulos, fontSize: u * 2.2, fontWeight: 800, color: CINZA }}>{nome}</span>
              <div style={{ position: "relative", width: pista, height: "100%", borderRadius: u * 0.6, background: "rgba(255,255,255,0.04)" }}>
                {f < 2
                  ? BLOCOS.filter((b) => b.faixa === (f === 0 ? 1 : 0)).map((b, i) => {
                      const ordem = BLOCOS.indexOf(b);
                      const q = 3 + (ordem / BLOCOS.length) * montagem;
                      const g = spring({ frame: frame - q, fps: c.fps, config: { stiffness: 260, damping: 22 } });
                      return (
                        <div
                          key={i}
                          style={{
                            position: "absolute",
                            left: b.x * pista,
                            width: b.w * pista - u * 0.5,
                            top: u * 0.4,
                            bottom: u * 0.4,
                            borderRadius: u * 0.7,
                            background: f === 0 ? `linear-gradient(90deg, ${corNaPosicao(c, 0.65)}, ${corNaPosicao(c, 1)})` : `linear-gradient(90deg, ${corNaPosicao(c, 0)}, ${corNaPosicao(c, 0.35)})`,
                            transform: `scaleX(${g})`,
                            transformOrigin: "left center",
                            opacity: frame >= q ? 1 : 0,
                          }}
                        />
                      );
                    })
                  : (
                    // A onda do áudio aparece atrás do cursor.
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: u * 0.25, padding: `0 ${u * 0.4}px`, clipPath: `inset(0 ${(1 - cursor) * 100}% 0 0)` }}>
                      {Array.from({ length: 64 }, (_, i) => (
                        <span key={i} style={{ flex: 1, height: `${18 + random(`a1-${i}`) * 70}%`, borderRadius: u, background: corNaPosicao(c, 0.5) }} />
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ))}
          {/* Cursor. */}
          <div style={{ position: "absolute", top: -u * 1, bottom: 0, left: rotulos + cursor * pista, width: u * 0.35, background: BRANCO, boxShadow: `0 0 ${u}px ${BRANCO}` }}>
            <div style={{ position: "absolute", top: -u * 0.6, left: -u * 0.8, width: u * 1.9, height: u * 1.6, borderRadius: u * 0.4, background: BRANCO }} />
          </div>
        </div>
      </div>
    </Lugar>
  );
};

// ---------- rec ----------

// Cartão de gravação: ● REC piscando, relógio correndo, o texto no meio e
// a linha do tempo enchendo.
const Rec: React.FC<{ c: Ctx }> = ({ c }) => {
  const { u, frame, fps, largura, motion, duracao } = c;
  const s = entrada(c, 0, 210, 16);
  const larguraCartao = Math.min(largura * 0.68, u * 66);
  const total = 3 * fps + frame;
  const tempo = `00:00:${String(Math.floor(total / fps)).padStart(2, "0")}:${String(total % fps).padStart(2, "0")}`;
  const progresso = interpolate(frame, [0, duracao], [0.08, 0.5], LIMITE);
  const linhas = pedacos(motion.texto);
  return (
    <Lugar posicao={motion.posicao} padrao="centro" estilo={{ opacity: c.saida }}>
      <div
        style={{
          width: larguraCartao,
          aspectRatio: "16 / 9.5",
          position: "relative",
          borderRadius: u * 2,
          background: VIDRO,
          border: `${Math.max(1, u * 0.15)}px solid ${LINHA_VIDRO}`,
          boxShadow: `0 ${u * 2}px ${u * 6}px rgba(0,0,0,0.5)`,
          transform: `scale(${0.85 + 0.15 * s})`,
          opacity: Math.min(1, s * 2),
          fontFamily: FONTES.forte,
        }}
      >
        <span style={{ position: "absolute", left: u * 2.4, top: u * 2, display: "flex", alignItems: "center", gap: u * 0.8, fontSize: u * 2.3, fontWeight: 800, color: BRANCO }}>
          <span style={{ width: u * 1.4, height: u * 1.4, borderRadius: "50%", background: "#FF3B4E", opacity: Math.floor(frame / 12) % 2 ? 0.3 : 1 }} />
          REC
        </span>
        <span style={{ position: "absolute", right: u * 2.4, top: u * 2, fontFamily: FONTES.mono, fontSize: u * 2.1, color: CINZA, fontVariantNumeric: "tabular-nums" }}>{tempo}</span>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: u * 7.5, lineHeight: 1.05, color: BRANCO, textTransform: "uppercase", textAlign: "center" }}>
          {linhas.map((l, i) => (
            <div key={i}>
              <TextoNeon c={c} texto={l.map((x) => (x.destaque ? `*${x.texto}*` : x.texto)).join(" ")} />
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: u * 2.4, right: u * 2.4, bottom: u * 2.2, height: u * 0.5, borderRadius: u, background: "rgba(255,255,255,0.12)" }}>
          <div style={{ width: `${progresso * 100}%`, height: "100%", borderRadius: u, backgroundImage: degrade(c) }} />
        </div>
      </div>
    </Lugar>
  );
};

export const MODELOS_TELAS = {
  conversa: Conversa,
  edicao: Edicao,
  rec: Rec,
} satisfies Record<"conversa" | "edicao" | "rec", React.FC<{ c: Ctx }>>;

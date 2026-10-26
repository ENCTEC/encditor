"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Gravador de áudio do encEditor (narração direto no app): escolher o
// microfone, ver o volume, contagem 3-2-1, gravar com pausa, ouvir e
// regravar antes de usar. Com "roteiro", as falas ficam na tela como num
// teleprompter (palavras de ênfase em destaque). Quem chama decide o que
// fazer com o arquivo (aoSalvar): a aba Arquivos guarda na biblioteca e o
// Planejar liga ao plano como narração.

export type FalaDoRoteiro = { fala: string; enfase: string[]; pausa: number };

type Etapa =
  | "pedindo"
  | "pronto"
  | "contagem"
  | "gravando"
  | "pausado"
  | "revisando"
  | "salvando";

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// A fala com as palavras de ênfase destacadas.
const FalaComEnfase: React.FC<{ fala: string; enfase: string[] }> = ({
  fala,
  enfase,
}) => {
  const alvos = enfase.map(sem).filter(Boolean);
  const base = sem(fala);
  const pedacos: { texto: string; forte: boolean }[] = [];
  let i = 0;
  while (i < fala.length) {
    const achado = alvos
      .map((a) => ({ a, pos: base.indexOf(a, i) }))
      .filter((x) => x.pos >= 0)
      .sort((x, y) => x.pos - y.pos)[0];
    if (!achado) {
      pedacos.push({ texto: fala.slice(i), forte: false });
      break;
    }
    if (achado.pos > i) pedacos.push({ texto: fala.slice(i, achado.pos), forte: false });
    pedacos.push({ texto: fala.slice(achado.pos, achado.pos + achado.a.length), forte: true });
    i = achado.pos + achado.a.length;
  }
  return (
    <>
      {pedacos.map((p, j) =>
        p.forte ? (
          <b key={j} className="bg-spray px-1 text-papel">
            {p.texto}
          </b>
        ) : (
          <span key={j}>{p.texto}</span>
        ),
      )}
    </>
  );
};

// Formato que o navegador sabe gravar (Chrome/Edge: webm; Firefox: ogg;
// Safari: mp4).
const FORMATOS = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
];
const extensaoDe = (tipo: string) =>
  tipo.includes("ogg") ? "ogg" : tipo.includes("mp4") ? "m4a" : "webm";

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const GravadorDeAudio: React.FC<{
  titulo: string;
  // Apelido sugerido (com o campo para mudar); sem valor, o campo some
  // (quem chama já sabe o nome, ex.: a narração do plano).
  apelidoInicial?: string;
  roteiro?: FalaDoRoteiro[];
  dica?: string;
  aoSalvar: (arquivo: File, apelido: string) => Promise<void>;
  aoFechar: () => void;
}> = ({ titulo, apelidoInicial, roteiro, dica, aoSalvar, aoFechar }) => {
  const [etapa, setEtapa] = useState<Etapa>("pedindo");
  const [erro, setErro] = useState<string | null>(null);
  const [microfones, setMicrofones] = useState<MediaDeviceInfo[]>([]);
  const [microfone, setMicrofone] = useState("");
  const [nivel, setNivel] = useState(0);
  const [contagem, setContagem] = useState(3);
  const [segundos, setSegundos] = useState(0);
  const [gravacao, setGravacao] = useState<{ blob: Blob; url: string } | null>(
    null,
  );
  const [apelido, setApelido] = useState(apelidoInicial ?? "");

  const fluxo = useRef<MediaStream | null>(null);
  const contexto = useRef<AudioContext | null>(null);
  const quadro = useRef(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const acumulado = useRef(0);
  const inicioTrecho = useRef(0);

  const fecharMicrofone = useCallback(() => {
    cancelAnimationFrame(quadro.current);
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
    void contexto.current?.close().catch(() => {});
    contexto.current = null;
  }, []);

  // Abre o microfone escolhido e liga o medidor de volume.
  useEffect(() => {
    let cancelado = false;
    const abrir = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro(
          "Este endereço não permite usar o microfone. Abra o encEditor por http://enceditor.localhost (neste PC) ou por HTTPS.",
        );
        return;
      }
      try {
        const novo = await navigator.mediaDevices.getUserMedia({
          audio: microfone ? { deviceId: { exact: microfone } } : true,
        });
        if (cancelado) {
          novo.getTracks().forEach((t) => t.stop());
          return;
        }
        fecharMicrofone();
        fluxo.current = novo;
        const ctx = new AudioContext();
        contexto.current = ctx;
        const analisador = ctx.createAnalyser();
        analisador.fftSize = 1024;
        ctx.createMediaStreamSource(novo).connect(analisador);
        const amostras = new Float32Array(analisador.fftSize);
        let suave = 0;
        const medir = () => {
          analisador.getFloatTimeDomainData(amostras);
          let soma = 0;
          for (const v of amostras) soma += v * v;
          const db = 20 * Math.log10(Math.sqrt(soma / amostras.length) || 1e-6);
          // -60 dB = silêncio, 0 dB = no talo; sobe rápido e desce devagar.
          const alvo = Math.max(0, Math.min(1, (db + 60) / 60));
          suave = alvo > suave ? alvo : suave * 0.92 + alvo * 0.08;
          setNivel(suave);
          quadro.current = requestAnimationFrame(medir);
        };
        medir();
        const lista = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "audioinput",
        );
        if (!cancelado) {
          setMicrofones(lista);
          setErro(null);
          setEtapa((e) => (e === "pedindo" ? "pronto" : e));
        }
      } catch (e) {
        if (cancelado) return;
        const nome = e instanceof DOMException ? e.name : "";
        setErro(
          nome === "NotAllowedError"
            ? "O navegador não deixou usar o microfone. Clique no cadeado ao lado do endereço → Microfone → Permitir, e abra o gravador de novo."
            : nome === "NotFoundError"
              ? "Nenhum microfone encontrado. Conecte um e abra o gravador de novo."
              : `Não consegui abrir o microfone: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    };
    void abrir();
    return () => {
      cancelado = true;
    };
  }, [microfone, fecharMicrofone]);

  // Ao fechar: desliga o microfone e libera a gravação.
  useEffect(
    () => () => {
      fecharMicrofone();
      if (gravador.current?.state !== "inactive") gravador.current?.stop();
    },
    [fecharMicrofone],
  );
  useEffect(
    () => () => {
      if (gravacao) URL.revokeObjectURL(gravacao.url);
    },
    [gravacao],
  );

  // Cronômetro (só conta enquanto grava; pausa não conta).
  useEffect(() => {
    if (etapa !== "gravando") return;
    const relogio = setInterval(
      () =>
        setSegundos(
          acumulado.current + (Date.now() - inicioTrecho.current) / 1000,
        ),
      200,
    );
    return () => clearInterval(relogio);
  }, [etapa]);

  const iniciarGravacao = useCallback(() => {
    const atual = fluxo.current;
    if (!atual) return;
    const tipo = FORMATOS.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const rec = new MediaRecorder(
      atual,
      tipo ? { mimeType: tipo, audioBitsPerSecond: 160_000 } : undefined,
    );
    pedacos.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) pedacos.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(pedacos.current, {
        type: rec.mimeType || tipo || "audio/webm",
      });
      setGravacao({ blob, url: URL.createObjectURL(blob) });
      setEtapa("revisando");
    };
    gravador.current = rec;
    acumulado.current = 0;
    inicioTrecho.current = Date.now();
    setSegundos(0);
    rec.start(250);
    setEtapa("gravando");
  }, []);

  // Contagem 3-2-1 antes de gravar.
  useEffect(() => {
    if (etapa !== "contagem") return;
    if (contagem === 0) {
      iniciarGravacao();
      return;
    }
    const t = setTimeout(() => setContagem((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [etapa, contagem, iniciarGravacao]);

  const comecar = () => {
    setContagem(3);
    setEtapa("contagem");
  };
  const pausar = () => {
    gravador.current?.pause();
    acumulado.current += (Date.now() - inicioTrecho.current) / 1000;
    setEtapa("pausado");
  };
  const continuar = () => {
    gravador.current?.resume();
    inicioTrecho.current = Date.now();
    setEtapa("gravando");
  };
  const parar = () => gravador.current?.stop();
  const regravar = () => {
    setGravacao(null);
    setSegundos(0);
    setEtapa("pronto");
  };
  const salvar = async () => {
    if (!gravacao) return;
    setEtapa("salvando");
    setErro(null);
    const tipo = gravacao.blob.type.split(";")[0] || "audio/webm";
    const nome = `${apelido.trim() || "gravacao"}.${extensaoDe(tipo)}`;
    try {
      await aoSalvar(new File([gravacao.blob], nome, { type: tipo }), apelido.trim());
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setEtapa("revisando");
    }
  };

  const gravando = etapa === "gravando" || etapa === "pausado";
  // Atalhos: Espaço começa/para; Esc fecha (fora da gravação).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, select, textarea, audio")) return;
      if (e.key === "Escape" && !gravando && etapa !== "salvando") aoFechar();
      if (e.key === " ") {
        e.preventDefault();
        if (etapa === "pronto") comecar();
        else if (gravando) parar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  });

  const db = nivel * 60 - 60;
  const corDoNivel =
    db > -6 ? "bg-amber-500" : db > -38 ? "bg-verde" : "bg-zinc-500";
  const dicaDoNivel =
    etapa === "pedindo"
      ? "abrindo o microfone…"
      : db > -6
        ? "alto demais — afaste um pouco o microfone"
        : db > -38
          ? "bom"
          : "fale para testar o volume";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/60 p-4"
      role="dialog"
      aria-label={titulo}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !gravando && etapa !== "salvando") aoFechar();
      }}
    >
      <div className="cartao-zine flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl leading-none tracking-wide uppercase">
              {titulo}
            </h2>
            {dica ? <p className="mt-1 text-sm text-zinc-500">{dica}</p> : null}
          </div>
          <button
            onClick={aoFechar}
            disabled={gravando || etapa === "salvando"}
            className="border-2 border-tinta px-2 py-0.5 font-mono text-xs uppercase hover:bg-tinta hover:text-papel disabled:opacity-40"
          >
            Fechar ✕
          </button>
        </div>

        {roteiro?.length ? (
          <div className="max-h-[40vh] space-y-3 overflow-y-auto border-2 border-tinta bg-papel p-4">
            <p className="font-mono text-[11px] tracking-widest text-zinc-500 uppercase">
              Roteiro — leia no seu ritmo
            </p>
            {roteiro.map((r, i) => (
              <p key={i} className="text-2xl leading-snug">
                <FalaComEnfase fala={r.fala} enfase={r.enfase} />
                {r.pausa > 0 ? (
                  <span className="ml-2 font-mono text-sm text-zinc-500">
                    ⏸ {r.pausa.toString().replace(".", ",")}s
                  </span>
                ) : null}
              </p>
            ))}
          </div>
        ) : null}

        {erro ? (
          <p className="border-2 border-red-700 bg-red-950/30 p-3 text-sm text-red-300">
            {erro}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {microfones.length > 1 ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-zinc-500">Microfone</span>
              <select
                value={microfone}
                disabled={gravando || etapa === "salvando"}
                onChange={(e) => setMicrofone(e.target.value)}
                className="w-full border-2 border-tinta bg-papel px-2 py-1.5"
              >
                <option value="">Padrão do sistema</option>
                {microfones.map((m, i) => (
                  <option key={m.deviceId || i} value={m.deviceId}>
                    {m.label || `Microfone ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="text-sm">
            <span className="mb-1 block text-xs text-zinc-500">
              Volume: <b>{dicaDoNivel}</b>
            </span>
            <div className="relative h-4 border-2 border-tinta bg-papel">
              <div
                className={`h-full ${corDoNivel}`}
                style={{ width: `${Math.round(nivel * 100)}%` }}
              />
              {/* Faixa boa: entre -38 dB e -6 dB. */}
              <span className="absolute inset-y-0 left-[37%] border-l border-dashed border-tinta/40" />
              <span className="absolute inset-y-0 left-[90%] border-l border-dashed border-tinta/40" />
            </div>
          </div>
          {apelidoInicial !== undefined ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-zinc-500">
                Nome no projeto (para citar no chat)
              </span>
              <span className="flex items-center border-2 border-tinta bg-papel px-2">
                <span className="text-spray">@</span>
                <input
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  disabled={etapa === "salvando"}
                  className="w-full bg-transparent py-1.5 outline-none"
                />
              </span>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-tinta pt-4">
          {etapa === "contagem" ? (
            <span className="font-display text-6xl leading-none text-spray">
              {contagem || "●"}
            </span>
          ) : null}

          {etapa === "pronto" || etapa === "pedindo" ? (
            <button
              onClick={comecar}
              disabled={etapa === "pedindo" || !!erro}
              className="botao-spray !px-5 !py-3 !text-lg disabled:opacity-40"
            >
              ● Gravar
            </button>
          ) : null}

          {gravando ? (
            <>
              <span className="flex items-center gap-2 font-mono text-2xl tabular-nums">
                <span
                  className={`h-3 w-3 rounded-full bg-red-600 ${etapa === "gravando" ? "animate-pulse" : "opacity-30"}`}
                />
                {mmss(segundos)}
              </span>
              {etapa === "gravando" ? (
                <button
                  onClick={pausar}
                  className="border-2 border-tinta px-3 py-2 font-mono text-xs uppercase hover:bg-tinta hover:text-papel"
                >
                  ❚❚ Pausar
                </button>
              ) : (
                <button
                  onClick={continuar}
                  className="border-2 border-tinta px-3 py-2 font-mono text-xs uppercase hover:bg-tinta hover:text-papel"
                >
                  ▶ Continuar
                </button>
              )}
              <button onClick={parar} className="botao-spray !px-4 !py-2">
                ■ Parar
              </button>
              {etapa === "pausado" ? (
                <span className="text-sm text-zinc-500">pausado</span>
              ) : null}
            </>
          ) : null}

          {(etapa === "revisando" || etapa === "salvando") && gravacao ? (
            <>
              <audio src={gravacao.url} controls className="h-10 min-w-64 flex-1" />
              <span className="font-mono text-sm tabular-nums text-zinc-500">
                {mmss(segundos)}
              </span>
              <button
                onClick={regravar}
                disabled={etapa === "salvando"}
                className="border-2 border-tinta px-3 py-2 font-mono text-xs uppercase hover:bg-tinta hover:text-papel disabled:opacity-40"
              >
                ↺ Regravar
              </button>
              <button
                onClick={() => void salvar()}
                disabled={etapa === "salvando" || segundos < 0.5}
                className="botao-spray !px-4 !py-2 disabled:opacity-40"
              >
                {etapa === "salvando" ? "Salvando…" : "✓ Usar esta gravação"}
              </button>
            </>
          ) : null}
        </div>
        <p className="font-mono text-[11px] tracking-wider text-zinc-500 uppercase">
          {etapa === "salvando"
            ? "enviando, convertendo para mp3 e mandando transcrever…"
            : "Espaço: gravar / parar · use fone para não captar o som do PC"}
        </p>
      </div>
    </div>
  );
};

/* global process, console -- script do Node */
// "Porteiro" do encEditor: programa levíssimo que fica sempre ligado (sobe
// junto com o Windows) e atende em http://enceditor.localhost (porta 80).
// - App ligado: repassa tudo para ele (porta 3000), inclusive o websocket
//   de recarga do modo de desenvolvimento.
// - App desligado: liga o app escondido (npm run dev) e mostra a tela
//   "Ligando o encEditor…", que entra sozinha quando ele estiver pronto.
// Assim basta abrir o endereço; não precisa do VS Code nem de terminal.
//
// Rodar na mão: node scripts/porteiro.mjs
// Instalar para subir com o Windows: node scripts/instalar-porteiro.mjs

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const PASTA = path.resolve(import.meta.dirname, "..");
const PORTA_APP = 3000;
const PORTA_PORTEIRO = 80;
const LOG = path.join(PASTA, "dados", "logs", "servidor.log");

let ligandoDesde = 0;

// O app responde? (pergunta barata: o ícone)
const appNoAr = () =>
  new Promise((resolve) => {
    const req = http.get(
      { host: "127.0.0.1", port: PORTA_APP, path: "/icon.svg", timeout: 1500 },
      (res) => {
        res.resume();
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });

// Porta 3000 ocupada = o app já está subindo (ou alguém ligou na mão).
const portaOcupada = () =>
  new Promise((resolve) => {
    const s = net.connect(PORTA_APP, "127.0.0.1");
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
  });

const ligarApp = async () => {
  // Já mandou ligar há pouco, ou já tem algo na porta: só espera.
  if (Date.now() - ligandoDesde < 90_000 || (await portaOcupada())) return;
  ligandoDesde = Date.now();
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const saida = fs.openSync(LOG, "a");
  fs.writeSync(
    saida,
    `\n===== ${new Date().toLocaleString("pt-BR")} ligando o app =====\n`,
  );
  // O Next roda direto pelo Node, sem cmd e sem console novo: herda o
  // console invisível do porteiro. (Com "detached" ou pelo cmd, o Windows
  // Terminal — padrão do Windows 11 — abre uma janela mesmo pedindo
  // escondido.) A saída vai para o log; o Next 16 também grava o dele em
  // .next/dev/logs/next-development.log.
  const app = spawn(
    process.execPath,
    // -H 127.0.0.1: o app só atende este computador (sem login ainda).
    [
      path.join(PASTA, "node_modules", "next", "dist", "bin", "next"),
      "dev",
      "-H",
      "127.0.0.1",
    ],
    { cwd: PASTA, windowsHide: true, stdio: ["ignore", saida, saida] },
  );
  fs.closeSync(saida);
  app.unref();
  console.log(`[porteiro] ligando o app (log em ${LOG})`);
};

const TELA_LIGANDO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Ligando o encEditor…</title><link rel="icon" href="data:,">
<style>
  body{margin:0;height:100vh;display:grid;place-items:center;background:#ebe8e1;color:#111110;font-family:Arial,sans-serif}
  .cartao{border:4px solid #111110;box-shadow:8px 8px 0 #111110;background:#ebe8e1;padding:32px 40px;text-align:center}
  h1{font:900 48px/1 Impact,'Arial Narrow',sans-serif;margin:0;letter-spacing:.5px;border-bottom:6px solid #e1251b;display:inline-block}
  h1 small{font:700 16px monospace;color:#777;letter-spacing:.1em;margin-right:2px}
  p{font:12px monospace;letter-spacing:.15em;text-transform:uppercase;color:#555;margin:14px 0 0}
  .spray{color:#e1251b;font-style:italic;transform:rotate(-6deg);display:inline-block;font-weight:700}
  .barra{margin-top:18px;height:10px;border:3px solid #111110;overflow:hidden}
  .barra i{display:block;height:100%;width:30%;background:#e1251b;animation:anda 1.1s infinite ease-in-out}
  @keyframes anda{0%{transform:translateX(-100%)}100%{transform:translateX(340%)}}
</style></head><body><div class="cartao">
<h1><small>enc</small>Editor</h1>
<p>Ligando o app… entra sozinho em alguns segundos</p>
<div class="barra"><i></i></div></div>
<script>
  const tentar = () => fetch("/__porteiro/pronto", { cache: "no-store" })
    .then((r) => r.json()).then((d) => d.pronto ? location.reload() : setTimeout(tentar, 1000))
    .catch(() => setTimeout(tentar, 1500));
  setTimeout(tentar, 1000);
</script></body></html>`;

const servidor = http.createServer(async (pedido, resposta) => {
  if (pedido.url === "/__porteiro/pronto") {
    const pronto = await appNoAr();
    resposta.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    return resposta.end(JSON.stringify({ pronto }));
  }
  const ida = http.request(
    {
      host: "127.0.0.1",
      port: PORTA_APP,
      method: pedido.method,
      path: pedido.url,
      headers: pedido.headers,
    },
    (volta) => {
      resposta.writeHead(volta.statusCode ?? 502, volta.headers);
      volta.pipe(resposta);
    },
  );
  ida.on("error", async () => {
    // App desligado: liga e mostra a tela de espera (páginas) ou 503 (API).
    await ligarApp();
    if (resposta.headersSent) return resposta.end();
    const pagina = (pedido.headers.accept ?? "").includes("text/html");
    resposta.writeHead(503, {
      "Content-Type": pagina ? "text/html; charset=utf-8" : "application/json",
      "Cache-Control": "no-store",
      "Retry-After": "2",
    });
    resposta.end(
      pagina
        ? TELA_LIGANDO
        : JSON.stringify({ erro: "O encEditor está ligando." }),
    );
  });
  pedido.pipe(ida);
});

// Websocket (recarga automática do modo de desenvolvimento): conexão crua.
servidor.on("upgrade", (pedido, socket, inicio) => {
  const destino = net.connect(PORTA_APP, "127.0.0.1", () => {
    const cabecalhos = Object.entries(pedido.headers)
      .flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]))
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    destino.write(
      `${pedido.method} ${pedido.url} HTTP/${pedido.httpVersion}\r\n${cabecalhos}\r\n\r\n`,
    );
    if (inicio.length) destino.write(inicio);
    destino.pipe(socket);
    socket.pipe(destino);
  });
  const fechar = () => {
    socket.destroy();
    destino.destroy();
  };
  destino.on("error", fechar);
  socket.on("error", fechar);
});

servidor.on("error", (e) => {
  console.error(
    `[porteiro] não consegui usar a porta ${PORTA_PORTEIRO}: ${e.code}`,
  );
  process.exit(1);
});
// Só no endereço local (IPv4 e IPv6): ninguém da rede chega ao encEditor,
// que ainda não tem login.
servidor.listen(PORTA_PORTEIRO, "127.0.0.1", () =>
  console.log(
    `[porteiro] atendendo em http://enceditor.localhost (app na porta ${PORTA_APP})`,
  ),
);
const servidorV6 = http.createServer((pedido, resposta) =>
  servidor.emit("request", pedido, resposta),
);
servidorV6.on("upgrade", (pedido, socket, inicio) =>
  servidor.emit("upgrade", pedido, socket, inicio),
);
// Sem IPv6 na máquina: tudo bem, o IPv4 basta.
servidorV6.on("error", () => undefined);
servidorV6.listen(PORTA_PORTEIRO, "::1");

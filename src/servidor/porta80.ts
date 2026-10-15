import http from "node:http";
import net from "node:net";

// Endereço fácil no navegador: http://enceditor.localhost (sem ":3000").
// O Chrome e o Edge mandam qualquer *.localhost para este PC; este
// repassador escuta na porta 80 e entrega tudo (inclusive o websocket de
// recarga do modo de desenvolvimento) para a porta do Next. O Next não
// roda direto na 80 porque, nela, o modo de desenvolvimento fica
// recarregando a página sem parar.
// Desligar: ENCEDITOR_PORTA80=0 no .env.local.

const global = globalThis as unknown as { repassadorPorta80?: http.Server };

export const iniciarPorta80 = (portaDoNext: number) => {
  if (global.repassadorPorta80 || process.env.ENCEDITOR_PORTA80 === "0") {
    return;
  }
  const servidor = http.createServer((pedido, resposta) => {
    const ida = http.request(
      {
        host: "127.0.0.1",
        port: portaDoNext,
        method: pedido.method,
        path: pedido.url,
        headers: pedido.headers,
      },
      (volta) => {
        resposta.writeHead(volta.statusCode ?? 502, volta.headers);
        volta.pipe(resposta);
      },
    );
    ida.on("error", () => {
      if (!resposta.headersSent) resposta.writeHead(502);
      resposta.end("ENCeditor: servidor não respondeu.");
    });
    pedido.pipe(ida);
  });
  // Websocket (recarga automática): repassa a conexão crua.
  servidor.on("upgrade", (pedido, socket, inicio) => {
    const destino = net.connect(portaDoNext, "127.0.0.1", () => {
      const cabecalhos = Object.entries(pedido.headers)
        .flatMap(([k, v]) =>
          Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]],
        )
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
  servidor.on("error", (e: NodeJS.ErrnoException) => {
    // Porta 80 ocupada por outro programa: segue só com a porta do Next.
    console.log(
      `[enceditor] porta 80 indisponível (${e.code}); use http://localhost:${portaDoNext}`,
    );
  });
  servidor.listen(80, () =>
    console.log("[enceditor] também em http://enceditor.localhost"),
  );
  global.repassadorPorta80 = servidor;
};

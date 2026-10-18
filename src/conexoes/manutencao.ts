import { listarConexoes } from "@/servidor/banco";
import type { InfoMeta } from "./meta";
import { sincronizarCliente } from "./sincronizar";

// Enquanto o encEditor está ligado, lê os números de cada cliente conectado
// à Meta a cada 6 h — mesmo sem ninguém abrir a aba Resultados. Isso também
// mantém o app de cada cliente "ativo" (a Meta invalida as chaves de apps
// sem nenhum uso por 90 dias). Ligado em src/instrumentation.ts.

const SEIS_HORAS = 6 * 60 * 60 * 1000;
const UM_MINUTO = 60 * 1000;

const global = globalThis as unknown as { manutencaoMeta?: boolean };

const rodar = async () => {
  for (const c of listarConexoes("meta")) {
    const info = c.info as InfoMeta;
    if (info.ultimaLeitura && Date.now() - info.ultimaLeitura < SEIS_HORAS) {
      continue;
    }
    try {
      const r = await sincronizarCliente(c.clienteId);
      if (r.parou) console.log(`[meta] ${c.clienteId}: ${r.parou}`);
    } catch (e) {
      console.error(`[meta] ${c.clienteId}:`, e);
    }
  }
};

export const iniciarManutencaoMeta = () => {
  if (global.manutencaoMeta) return;
  global.manutencaoMeta = true;
  console.log("[meta] leitura automática dos números ligada (a cada 6 h)");
  setTimeout(() => void rodar(), UM_MINUTO);
  setInterval(() => void rodar(), SEIS_HORAS);
};

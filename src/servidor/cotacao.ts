import { lerUltimaCotacao, salvarCotacao } from "./banco";

// Dólar do dia para mostrar os custos da IA em real. Fonte: dólar
// comercial (venda) da AwesomeAPI — grátis, sem chave, atualiza ao longo
// do dia; se não responder, a PTAX (venda) do Banco Central do último dia
// útil. Guardada no banco por 6 h; sem internet, vale a última conhecida.
// Soma o IOF de compras internacionais no cartão: 3,5% (alíquota única
// desde 17/07/2025, Decreto 12.499/2025; conferido em 27/10/2026). O
// spread do banco do cartão não entra (muda de banco para banco).

export const IOF_CARTAO = 0.035;
const VALIDADE_MS = 6 * 60 * 60 * 1000;

export type Cotacao = {
  // R$ por US$ 1, sem e com o IOF.
  dolar: number;
  comIof: number;
  iof: number;
  fonte: string;
  // Quando foi lida.
  quando: number;
};

const doDia = (d: Date) => d.toISOString().slice(0, 10);

const daAwesome = async () => {
  const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`AwesomeAPI ${r.status}`);
  const j = (await r.json()) as { USDBRL?: { ask?: string } };
  const dolar = Number(j.USDBRL?.ask);
  if (!(dolar > 1 && dolar < 50)) throw new Error("cotação estranha");
  return { dolar, fonte: "dólar comercial, AwesomeAPI" };
};

// PTAX do Banco Central: tenta hoje e os 6 dias antes (fim de semana e
// feriado não têm).
const daPtax = async () => {
  for (let k = 0; k < 7; k++) {
    const d = new Date(Date.now() - k * 24 * 60 * 60 * 1000);
    const mdy = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
    const r = await fetch(
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${mdy}'&$format=json`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) continue;
    const j = (await r.json()) as { value?: { cotacaoVenda?: number }[] };
    const dolar = j.value?.[0]?.cotacaoVenda;
    if (dolar && dolar > 1) {
      return { dolar, fonte: `PTAX do Banco Central de ${d.toLocaleDateString("pt-BR")}` };
    }
  }
  throw new Error("PTAX sem cotação");
};

const comIof = (dolar: number, fonte: string, quando: number): Cotacao => ({
  dolar,
  comIof: dolar * (1 + IOF_CARTAO),
  iof: IOF_CARTAO,
  fonte,
  quando,
});

export const cotacaoDoDia = async (): Promise<Cotacao | null> => {
  const ultima = lerUltimaCotacao();
  if (ultima && Date.now() - ultima.buscadoEm < VALIDADE_MS) {
    return comIof(ultima.dolar, ultima.fonte, ultima.buscadoEm);
  }
  for (const buscar of [daAwesome, daPtax]) {
    try {
      const { dolar, fonte } = await buscar();
      const agora = Date.now();
      salvarCotacao({ dia: doDia(new Date()), dolar, fonte, buscadoEm: agora });
      return comIof(dolar, fonte, agora);
    } catch (e) {
      console.error("[cotação] falhou:", e instanceof Error ? e.message : e);
    }
  }
  // Sem internet: a última conhecida (mesmo velha) ou nada.
  return ultima ? comIof(ultima.dolar, `${ultima.fonte}, última conhecida`, ultima.buscadoEm) : null;
};

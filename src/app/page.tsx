import { redirect } from "next/navigation";

// A aba "Criar" saiu (pedido de 2026-10-17): o chat já fica ao lado da
// Timeline. O endereço raiz leva para a Timeline, mantendo ?projeto=.
export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(await searchParams)) {
    for (const v of [valor ?? []].flat()) parametros.append(chave, v);
  }
  const busca = parametros.toString();
  redirect(`/timeline${busca ? `?${busca}` : ""}`);
}

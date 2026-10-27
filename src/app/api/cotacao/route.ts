import { NextResponse } from "next/server";
import { cotacaoDoDia } from "@/servidor/cotacao";

// O dólar do dia com o IOF (para as telas mostrarem custos em real).
export async function GET() {
  return NextResponse.json(
    { cotacao: await cotacaoDoDia() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

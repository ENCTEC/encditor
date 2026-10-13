import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Banco de dados do Encditor: um arquivo SQLite (padrão dados/encditor.db),
// usando o SQLite que já vem no Node — sem serviço externo nem custo.
// Guarda os projetos (timeline, biblioteca, conversa) e as análises de IA
// de cada arquivo, para nunca analisar o mesmo arquivo duas vezes.

const ARQUIVO = path.resolve(process.env.BANCO_ARQUIVO ?? "dados/encditor.db");

// Em desenvolvimento o Next recarrega módulos; guardar a conexão no
// globalThis evita abrir o mesmo arquivo várias vezes.
const global = globalThis as unknown as { bancoEncditor?: DatabaseSync };

const banco = () => {
  if (global.bancoEncditor) return global.bancoEncditor;
  mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  const db = new DatabaseSync(ARQUIVO);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS projetos (
      id TEXT PRIMARY KEY,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analises (
      arquivo TEXT PRIMARY KEY,
      dados TEXT NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
  `);
  global.bancoEncditor = db;
  return db;
};

export const lerProjeto = (id: string) => {
  const linha = banco()
    .prepare("SELECT dados, atualizado_em FROM projetos WHERE id = ?")
    .get(id) as { dados: string; atualizado_em: number } | undefined;
  return linha
    ? {
        projeto: JSON.parse(linha.dados) as unknown,
        atualizadoEm: linha.atualizado_em,
      }
    : null;
};

export const salvarProjeto = (id: string, projeto: unknown) => {
  const agora = Date.now();
  banco()
    .prepare(
      `INSERT INTO projetos (id, dados, atualizado_em) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(id, JSON.stringify(projeto), agora);
  return agora;
};

export const lerAnaliseDoBanco = (arquivo: string): unknown => {
  const linha = banco()
    .prepare("SELECT dados FROM analises WHERE arquivo = ?")
    .get(arquivo) as { dados: string } | undefined;
  return linha ? JSON.parse(linha.dados) : null;
};

export const salvarAnaliseNoBanco = (arquivo: string, analise: unknown) => {
  banco()
    .prepare(
      `INSERT INTO analises (arquivo, dados, atualizado_em) VALUES (?, ?, ?)
       ON CONFLICT(arquivo) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em`,
    )
    .run(arquivo, JSON.stringify(analise), Date.now());
};

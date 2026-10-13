import path from "node:path";

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Desligado: no modo de desenvolvimento o Strict Mode monta tudo duas
  // vezes, e o <Img> do Remotion cancela o carregamento da 1ª montagem,
  // gerando o aviso "EncodingError" no console. Não afeta produção.
  reactStrictMode: false,
  // Indicador do Next (só em desenvolvimento) no canto inferior direito,
  // para não cobrir os nomes das faixas da timeline.
  devIndicators: { position: "bottom-right" },
  // Raiz do projeto fixa: existe um package-lock.json solto na pasta do
  // usuário que confundiria o Next na hora de achar a raiz.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;

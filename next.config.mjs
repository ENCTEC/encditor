import path from "node:path";

/** @type {import("next").NextConfig} */
const nextConfig = {
  // Desligado: no modo de desenvolvimento o Strict Mode monta tudo duas
  // vezes, e o <Img> do Remotion cancela o carregamento da 1ª montagem,
  // gerando o aviso "EncodingError" no console. Não afeta produção.
  reactStrictMode: false,
  // Pacotes de renderização do Remotion rodam direto no Node (não podem
  // ser empacotados pelo Next).
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/compositor-win32-x64-msvc",
    "@remotion/compositor-linux-x64-gnu",
  ],
  // Sem o indicador "N" do Next (só aparece em desenvolvimento e cobria o
  // botão Enviar do chat e os nomes das faixas da timeline).
  devIndicators: false,
  // Raiz do projeto fixa: existe um package-lock.json solto na pasta do
  // usuário que confundiria o Next na hora de achar a raiz.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;

# Encditor

Editor de vídeo com IA. Você sobe as cenas (geradas no Higgsfield), inserts e áudios, pede a edição em texto na aba **Criar** e faz os ajustes finais na aba **Timeline**. O vídeo é montado com [Remotion](https://www.remotion.dev).

## Comandos

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências |
| `npm run dev` | Abre o app em http://localhost:3000 |
| `npm run remotion` | Abre o Remotion Studio (porta livre seguinte, ex.: 3001) |
| `npm run lint` | Verifica o código (ESLint + TypeScript) |
| `npm run build` / `npm start` | Gera e roda a versão de produção |

## Estrutura

```
src/
  app/                  Páginas (Criar, Timeline) e rotas de API do Next.js
    api/midia/          Upload e entrega dos arquivos enviados
  componentes/          Interface (chat, player, timeline, inspetor, biblioteca)
  projeto/              Estado do projeto no navegador (biblioteca, mensagens, desfazer)
  servidor/             Código que só roda no servidor (armazenamento em disco)
  timeline/             Formato do JSON de timeline, cálculos e operações de edição
  ia/                   Ferramentas, instruções e resumo do projeto usados pelo Claude
  remotion/             Composição "EditorTimeline" que transforma o JSON em vídeo
midia/                  Arquivos enviados (fora do git)
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. Depois de mudar o `.env.local`, reinicie o `npm run dev`.

| Variável | Padrão | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Obrigatória para o chat editar sozinho.** Chave da API do Claude |
| `MIDIA_DIR` | `./midia` | Pasta onde os arquivos enviados são gravados |
| `MIDIA_LIMITE_MB` | `1024` | Tamanho máximo por arquivo |

Remotion é gratuito para empresas de até 3 pessoas; acima disso precisa de licença (veja https://www.remotion.pro/license).

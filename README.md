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
  servidor/             Só no servidor: armazenamento em disco, ffmpeg, OpenAI e análise dos arquivos
  timeline/             Formato do JSON de timeline, cálculos e operações de edição
  ia/                   Ferramentas de edição da IA, instruções e adaptadores (OpenAI e Claude)
  remotion/             Composição "EditorTimeline" que transforma o JSON em vídeo
midia/                  Arquivos enviados (fora do git)
```

## Requisitos

- Node.js e **ffmpeg** (no Windows: `winget install Gyan.FFmpeg`; na VPS: `apt install ffmpeg`). Sem ffmpeg do sistema, o app tenta usar o que vem com o Remotion.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. Depois de mudar o `.env.local`, reinicie o `npm run dev`.

| Variável | Padrão | Uso |
|---|---|---|
| `OPENAI_API_KEY` | — | **Obrigatória para a IA**: chat que edita, ditado por voz, legendas automáticas e análise dos vídeos |
| `OPENAI_MODELO` / `OPENAI_MODELO_VISAO` / `OPENAI_MODELO_DITADO` | `gpt-6.1-sol` / `gpt-6.1-sol` / `gpt-transcribe` | Modelos usados |
| `FFMPEG_PATH` | ffmpeg do sistema | Usado para extrair áudio e quadros dos vídeos |
| `ANTHROPIC_API_KEY` | — | Alternativa: editor com Claude (só se não houver chave da OpenAI) |
| `MIDIA_DIR` | `./midia` | Pasta onde os arquivos enviados são gravados |
| `MIDIA_LIMITE_MB` | `1024` | Tamanho máximo por arquivo |

Remotion é gratuito para empresas de até 3 pessoas; acima disso precisa de licença (veja https://www.remotion.pro/license).

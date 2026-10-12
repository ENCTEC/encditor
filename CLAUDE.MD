# Encditor — App editor de vídeos com IA

## Objetivo
App de EDIÇÃO (não de geração). O usuário sobe os vídeos de cada cena — gerados fora do app, no Higgsfield com Seedance 2.0 — além de inserts, imagens e áudios, e pede a edição em linguagem natural ("coloque esse insert enquanto esse vídeo passa", "adicione esse áudio no minuto X", "corte 2 segundos", "dê zoom", "legende o vídeo"). A IA aplica as edições; o usuário faz os ajustes finais numa timeline.

Fluxo em 2 etapas separadas: (1) geração no Higgsfield, fora do app; (2) edição no Encditor. Integração com a API do Higgsfield é opcional e futura.

## Telas
1. **Criar (principal, estilo chat):** upload de arquivos + pedidos em texto; a IA aplica e o preview (Remotion Player) atualiza.
2. **Timeline:** visão de edição com faixas para os ajustes finais manuais.
Ambas leem/alteram o MESMO JSON de timeline.

## Decisões de arquitetura
- O Claude não reescreve o JSON inteiro: devolve comandos via tool use (cortar, adicionarInsert, adicionarAudio, zoom, gerarLegendas…) que o app aplica no JSON → permite desfazer/refazer e preserva ajustes manuais.
- JSON de timeline com faixas: trilha principal (clipes, cortes, transições), inserts/B-roll sobrepostos, áudio (início, volume, fade), efeitos por trecho (zoom), legendas.
- Cada arquivo enviado vira item da biblioteca com nome/número ("insert 2", "áudio 1") para a IA entender referências como "esse insert".
- A API do Claude NÃO transcreve áudio. Legendas exigem transcrição separada (Whisper local via @remotion/install-whisper-cpp, ou API paga: OpenAI/Deepgram/AssemblyAI). Claude entra depois: quebrar legendas, analisar jeito de falar, copy.

## Stack
- Next.js no Vercel + Supabase (Storage para vídeos, banco para projetos).
- Uploads vão direto do navegador para o Supabase Storage (URL assinada) — não passam pela função do Vercel (limite de ~4,5 MB por requisição).
- Remotion: composição "EditorTimeline" alimentada pelo JSON. Preview com Remotion Player; render final via Remotion Lambda.

## Etapa atual
Base Remotion criada (composição EditorTimeline com clipes, transições corte/fade/slide e legendas). Próximo: ampliar schema/composição (inserts, áudio, zoom) e depois o app Next.js com as duas telas.

## Custos e licenças a considerar
- Remotion: gratuito só para empresas de até 3 pessoas. Acima disso, licença "Remotion for Automators" (US$ 0,01 por render, mínimo US$ 100/mês).
- Higgsfield: o plano do site NÃO dá acesso à API. A API é produto separado, saldo pré-pago em dólar, chave gerada em console.higgsfield.ai.
- Claude API e serviço de transcrição: pagos por uso.

## Ambiente
- Windows, VS Code, terminal PowerShell.
- Conectores do claude.ai desativados no Claude Code (disableClaudeAiConnectors). Supabase e Vercel serão adicionados localmente só quando necessário.

## Como trabalhar comigo
- Responder sempre em português.
- Ao mandar código, enviar sempre o arquivo/bloco completo para copiar e colar, nunca só o trecho alterado.
- Explicar o que cada arquivo novo faz.
- Pedir confirmação antes de instalar serviços pagos ou criar contas/recursos na nuvem.

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

## Stack e infraestrutura
- **VPS Contabo (Europa):** Ubuntu, 6 vCPU, 12 GB RAM, 100 GB NVMe. Hospeda tudo, provavelmente via Docker:
  - App Next.js (sem Vercel → sem limite de 4,5 MB de upload).
  - Arquivos de mídia no disco da VPS (pastas simples, sem MinIO), servidos com HTTPS. São material de trabalho reciclável: os originais ficam no Higgsfield.
  - Limpeza automática: apagar mídia de projetos X dias após exportar, ou quando o disco passar de um limite.
  - Render final do MP4 com Remotion na própria VPS (sem Remotion Lambda / AWS), uma render por vez em fila.
- **Supabase (plano grátis), região na Europa (Frankfurt), perto da VPS:** apenas banco (projetos, timeline JSON, histórico do chat) e login. Sem Supabase Storage.
- Armazenamento isolado em um único módulo do código, para poder migrar (ex.: Cloudflare R2) sem mexer no resto.
- Remotion: composição "EditorTimeline" alimentada pelo JSON. Preview no app com Remotion Player.
- Repositório: https://github.com/ENCTEC/encditor (branch main). Commits como "Encditor" <contato@enctec.com.br> (config local do repo).
- Domínio: enctec.com.br (registro/hospedagem na HostGator, mas o DNS é gerenciado na **Cloudflare**; e-mail no Google). O app usará um subdomínio (sugestão: encditor.enctec.com.br) com registro A apontando para o IP da VPS, em modo "DNS only" (nuvem cinza, sem proxy da Cloudflare — o proxy grátis limita uploads a 100 MB e restringe tráfego de vídeo). HTTPS via Let's Encrypt na própria VPS. Não mexer no domínio raiz nem nos registros MX.

## Etapa atual
App Next.js 16 funcionando localmente com as duas abas:
- **Criar:** chat com anexos (cena/insert/áudio), upload para o disco (`/api/midia`, com Range), preview e biblioteca. Cenas entram sozinhas na trilha principal. Pedidos em texto vão para `/api/ia`: Claude Opus 5.5 (tool runner do SDK, `src/ia/ferramentas.ts`) edita uma cópia da timeline e o app aplica tudo como um único passo de desfazer. Precisa de `ANTHROPIC_API_KEY` no `.env.local` (ainda não configurada).
- Transições: corte, fade, slide, cortina (wipe), virar (flip), relogio (clock-wipe), iris, impacto (push-cut); direção e duração por cena. Transições "shader" do Remotion ficaram de fora (dependem de recurso experimental do navegador).
- **Timeline:** player + faixas (cenas, inserts, áudio, zoom, legendas), arrastar para mover/aparar, inspetor com campos, desfazer/refazer (Ctrl+Z/Ctrl+Y), Delete remove.
- Estado salvo no localStorage (depois: Supabase). Edições passam por `src/timeline/operacoes.ts` (serão as ferramentas da IA).
Próximo: usuário configurar a chave e testar o chat; depois exportar MP4, login (contato@enctec.com.br, senha só como hash no .env.local) e deploy na VPS.

Estrutura: Next.js na raiz; composição Remotion em `src/remotion/` (Studio: `npm run remotion`).

## Custos e licenças a considerar
- Remotion: gratuito só para empresas de até 3 pessoas. Acima disso, licença "Remotion for Automators" (US$ 0,01 por render, mínimo US$ 100/mês).
- VPS Contabo: custo fixo mensal; sem cobrança por tráfego de vídeo como em storage na nuvem.
- Higgsfield: o plano do site NÃO dá acesso à API. A API é produto separado, saldo pré-pago em dólar, chave gerada em console.higgsfield.ai.
- Claude API e serviço de transcrição: pagos por uso.

## Ambiente
- Windows, VS Code, terminal PowerShell.
- Conectores do claude.ai desativados no Claude Code (disableClaudeAiConnectors). Supabase será adicionado localmente só quando necessário.

## Como trabalhar comigo
- Responder sempre em português.
- Ao mandar código, enviar sempre o arquivo/bloco completo para copiar e colar, nunca só o trecho alterado.
- Explicar o que cada arquivo novo faz.
- Pedir confirmação antes de instalar serviços pagos ou criar contas/recursos na nuvem.

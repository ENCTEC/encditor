# ENCeditor — App editor de vídeos com IA

Nome do produto: **ENCeditor** (renomeado de "Encditor" em 2026-10-14). Nomes internos continuam "encditor" (pasta, repositório, pacote npm, domínio encditor.enctec.com.br, banco dados/encditor.db, chaves do navegador) para não perder dados nem quebrar links.

## Objetivo
App de EDIÇÃO (não de geração). O usuário sobe os vídeos de cada cena — gerados fora do app, no Higgsfield com Seedance 2.0 — além de inserts, imagens e áudios, e pede a edição em linguagem natural ("coloque esse insert enquanto esse vídeo passa", "adicione esse áudio no minuto X", "corte 2 segundos", "dê zoom", "legende o vídeo"). A IA aplica as edições; o usuário faz os ajustes finais numa timeline.

Fluxo em 2 etapas separadas: (1) geração no Higgsfield, fora do app; (2) edição no ENCeditor. Integração com a API do Higgsfield é opcional e futura.

## Telas
1. **Criar (principal, estilo chat):** upload de arquivos + pedidos em texto; a IA aplica e o preview (Remotion Player) atualiza.
2. **Timeline:** visão de edição com faixas para os ajustes finais manuais.
Ambas leem/alteram o MESMO JSON de timeline.

## Decisões de arquitetura
- A IA não reescreve o JSON inteiro: devolve comandos via tool use / function calling (cortar, adicionarInsert, adicionarAudio, zoom, gerarLegendas…) que o app aplica no JSON → permite desfazer/refazer e preserva ajustes manuais.
- JSON de timeline com faixas: trilha principal (clipes, cortes, transições), inserts/B-roll sobrepostos, áudio (início, volume, fade), efeitos por trecho (zoom), legendas.
- Cada arquivo enviado vira item da biblioteca com nome/número ("insert 2", "áudio 1") para a IA entender referências como "esse insert".
- **IA = OpenAI (decisão do usuário, 2026-10-13):** uma chave (`OPENAI_API_KEY`) para tudo. Editor do chat: `gpt-6.1-sol` (Responses API + function calling, `src/ia/openai.ts`). Transcrição com tempo por palavra (legendas e "quando eu falo X"): `whisper-1` (único da OpenAI com timestamps de palavra). Ditado do chat: `gpt-transcribe`. Análise visual: quadros extraídos com ffmpeg (OpenAI não aceita vídeo) descritos pelo `gpt-6.1-sol`, com texto na tela e minutagem. Claude (`src/ia/claude.ts`) ficou como alternativa, usado só se não houver chave da OpenAI.
- Cada arquivo enviado é analisado automaticamente (`/api/analisar`); resultado salvo em `midia/<arquivo>.analise.json` e na biblioteca. `src/ia/conteudo.ts` converte tempos do arquivo para o vídeo final (cortes, transições, posição).

## Identidade visual (pedido do usuário, 2026-10-13)
Estilo pôster punk/zine (referência: pôster grafitado preto/vermelho): papel claro com retícula e grão, tinta preta, tipografia condensada (Anton), spray vermelho (Permanent Marker), texto em Archivo e ficha técnica em Space Mono; cantos retos, bordas grossas e sombras "carimbadas". Implementado em `src/app/globals.css`: a escala zinc do Tailwind foi redefinida como papel→tinta e violet como vermelho, então classes zinc/violet nos componentes já seguem o tema. Rabiscos SVG em `src/componentes/Rabiscos.tsx`; classes `.botao-spray`, `.cartao-zine`, `.rotulo-zine`. Usar só o estilo — nada de marcas/textos do pôster original.

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
- **Criar:** chat com anexos (cena/insert/áudio) e ditado por voz (🎤), upload para o disco (`/api/midia`, com Range), preview e biblioteca (mostra estado da análise). Cenas entram sozinhas na trilha principal. Pedidos vão para `/api/ia`: a IA edita uma cópia da timeline com as ferramentas de `src/ia/ferramentas.ts` (inclui buscar_fala, ver_conteudo, legendar_automaticamente) e o app aplica tudo como um único passo de desfazer. `OPENAI_API_KEY` configurada no `.env.local` e TESTADA DE VERDADE em 2026-10-13 (créditos ativos): análise, legendas automáticas, insert por frase falada, zoom por texto na tela, transição + música e corte funcionaram. Custos medidos: pedido ao editor ≈ US$ 0,015–0,04 (7k–17k tokens de entrada); análise visual ≈ US$ 0,005–0,01 por vídeo curto; whisper ≈ US$ 0,001 por 10 s. Com saldo baixo a OpenAI recusa chamadas simultâneas como insufficient_quota → análises rodam em fila no navegador e o servidor tenta de novo (comNovaTentativa). Whisper alucina em trechos sem fala → segmentos com no_speech_prob > 0,5 são descartados; palavras são alinhadas ao texto para manter pontuação e "50%".
- Zoom é de câmera: envolve cenas E inserts (legendas fora); tem `rampa` (s) para zoom rápido/lento. Imagens podem ser cenas da trilha (`clipe.tipo = "imagem"`), o que permite transição vídeo→imagem. Instrução da IA: nunca afirmar algo sem "OK" de ferramenta.
- Transições: corte, fade, slide, cortina (wipe), virar (flip), relogio (clock-wipe), iris, impacto (push-cut); direção e duração por cena. Transições "shader" do Remotion ficaram de fora (dependem de recurso experimental do navegador).
- **Chat fixo:** o chat mora no layout (`src/componentes/AreaDeTrabalho.tsx`) e nunca desmonta: na aba Criar é a área principal; em Timeline/Arquivos vira coluna lateral (ocultável). Só some com "Limpar chat". Cenas enviadas NÃO entram sozinhas na trilha (usuário define a ordem; ferramenta montar_sequencia; botão "+ trilha" na Timeline).
- **Estilos (aba):** menu com exemplos animados (Remotion Player) de 8 transições e 8 estilos de legenda (`src/catalogo/estilos.ts` é a fonte única: menu, "#" no chat e instruções da IA). No chat, `#tag` cita transição/estilo (autocompletar como o @). Legendas animadas em `src/remotion/EditorTimeline/Legendas.tsx` (classico, karaoke, pop, destaque, gigante, spray, maquina, neon) com fontes via @remotion/google-fonts; legendas automáticas guardam o tempo de cada palavra (relativo ao início da legenda). Estilo padrão em `timeline.estiloLegenda`, por legenda em `legenda.estilo`. Ferramenta da IA: estilo_das_legendas.
- **Posição dos inserts:** `insert.caixa` (x/y/largura/altura em % do vídeo) + `acabamento` (borda/cantos/sombra); lógica em `src/timeline/caixas.ts` (grade 3×3, tamanhos P25/M40/G60, layouts de metade/tela cheia, proporção da mídia). Popup `PopupPosicao` (fundo = quadro real do vídeo; arrastar, scroll e alça redimensionam) abre ao colocar insert pela biblioteca da Timeline e pelo botão "Posição e tamanho…" do inspetor. IA: colocar_insert (posicao/tamanho) e posicionar_insert.
- **Efeitos de áudio:** 8 efeitos (#normalizar, #sem-ruido, #voz-clara, #radio, #telefone, #eco, #reverb, #grave) via ffmpeg no servidor (`src/servidor/efeitos.ts`, cache na tabela `efeitos`). Geram arquivo novo; a mídia guarda `efeitosAudio` e `urlOriginal` e o arquivo é trocado em toda a timeline (`trocarUrl`). Aba Estilos tem ouvir original/com efeito (voz de exemplo em `public/exemplos/voz-exemplo.mp3`) e aplicar/tirar; IA: efeitos_de_audio (ferramentas podem ser assíncronas).
- **Arquivos (aba):** upload com escolha por arquivo de papel, @apelido e "Analisar com IA" (padrão: cenas sim; inserts/áudios não = arquivo "frio", sem custo). Tabela da biblioteca com apelido editável, analisar arquivo frio e ver o que a IA entendeu. No chat, "@" abre sugestões de arquivos; a IA aceita @apelido nas ferramentas.
- **Timeline:** player + faixas (cenas, inserts, áudio, zoom, legendas), arrastar para mover/aparar, inspetor com campos, desfazer/refazer (Ctrl+Z/Ctrl+Y), Delete remove.
- **Banco:** SQLite embutido no Node (`node:sqlite`, sem dependência), arquivo `dados/encditor.db` (fora do git). Tabelas `projetos` (JSON do projeto; id "principal"; `?projeto=<id>` na URL abre outro — usar SEMPRE nos testes automáticos para não sobrescrever o projeto do usuário) e `analises` (cache por arquivo; as antigas .analise.json são migradas na leitura). O navegador salva no banco ~0,8s após cada mudança (cópia de reserva no localStorage) e mostra "✓ salvo" no cabeçalho. Supabase deixou de ser necessário para isso. Edições passam por `src/timeline/operacoes.ts` (serão as ferramentas da IA).
Próximo: usuário configurar a chave e testar o chat; depois exportar MP4, login (contato@enctec.com.br, senha só como hash no .env.local) e deploy na VPS.

Estrutura: Next.js na raiz; composição Remotion em `src/remotion/` (Studio: `npm run remotion`).

## Custos e licenças a considerar
- Remotion: gratuito só para empresas de até 3 pessoas. Acima disso, licença "Remotion for Automators" (US$ 0,01 por render, mínimo US$ 100/mês).
- VPS Contabo: custo fixo mensal; sem cobrança por tráfego de vídeo como em storage na nuvem.
- Higgsfield: o plano do site NÃO dá acesso à API. A API é produto separado, saldo pré-pago em dólar, chave gerada em console.higgsfield.ai.
- OpenAI (por uso): gpt-6.1-sol US$ 2/US$ 10 por 1M tokens (entrada/saída); whisper-1 US$ 0,006/min; gpt-transcribe US$ 0,0045/min (preços consultados em 2026-10-13).

## Ambiente
- Windows, VS Code, terminal PowerShell. ffmpeg 8.1 instalado via winget (na VPS: apt install ffmpeg).
- Conectores do claude.ai desativados no Claude Code (disableClaudeAiConnectors). Supabase será adicionado localmente só quando necessário.

## Como trabalhar comigo
- Responder sempre em português.
- Ao mandar código, enviar sempre o arquivo/bloco completo para copiar e colar, nunca só o trecho alterado.
- Explicar o que cada arquivo novo faz.
- Pedir confirmação antes de instalar serviços pagos ou criar contas/recursos na nuvem.

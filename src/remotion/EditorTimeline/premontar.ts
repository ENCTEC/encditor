// Segundos de antecedência para montar (carregar) cada vídeo, imagem e
// áudio no preview. Sem isso, o arquivo só começa a carregar quando entra
// na tela: numa transição a cena nova aparece vazia e "pula" depois.
// Não muda o MP4 exportado.
export const PREMONTAR_S = 2;

// Tags de áudio "compartilhadas" do Player (numberOfSharedAudioTags). O
// padrão (5) é um limite fixo: com mais áudios montados ao mesmo tempo
// (narração + música + efeitos sonoros, cada um montado PREMONTAR_S antes)
// o preview trava com "Tried to simultaneously mount 6 <Html5Audio /> tags"
// e fica preto, e o número não pode mudar com o Player aberto. Com 0, cada
// áudio usa a sua própria tag: sem limite. O navegador só toca som depois
// de um clique/tecla na página — no app o play é sempre um clique ou o
// Espaço.
export const TAGS_DE_AUDIO_DO_PLAYER = 0;

import { loadFont as carregarAnton } from "@remotion/google-fonts/Anton";
import { loadFont as carregarInter } from "@remotion/google-fonts/Inter";
import { loadFont as carregarMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as carregarMarker } from "@remotion/google-fonts/PermanentMarker";
import { loadFont as carregarSpaceMono } from "@remotion/google-fonts/SpaceMono";

// Fontes usadas DENTRO do vídeo (legendas). Carregadas pelo Remotion, para
// saírem iguais no preview e no vídeo final.
export const FONTES = {
  condensada: carregarAnton("normal", { weights: ["400"], subsets: ["latin"] })
    .fontFamily,
  forte: carregarMontserrat("normal", {
    weights: ["800", "900"],
    subsets: ["latin"],
  }).fontFamily,
  spray: carregarMarker("normal", { weights: ["400"], subsets: ["latin"] })
    .fontFamily,
  mono: carregarSpaceMono("normal", { weights: ["700"], subsets: ["latin"] })
    .fontFamily,
  // Letra de aplicativo (telas de celular: conversa, listas).
  interface: carregarInter("normal", {
    weights: ["400", "600", "700"],
    subsets: ["latin"],
  }).fontFamily,
};

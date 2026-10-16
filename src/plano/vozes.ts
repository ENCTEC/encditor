// Vozes da narração de exemplo (voz sintética da OpenAI), usadas na tela
// e no servidor.
export const VOZES = {
  marin: "Feminina (natural)",
  coral: "Feminina (calorosa)",
  cedar: "Masculina (natural)",
  onyx: "Masculina (grave)",
} as const;
export type Voz = keyof typeof VOZES;

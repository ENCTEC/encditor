/**
 * Configuração do Remotion Studio/CLI (npm run remotion).
 * Não vale para as APIs Node.js — nelas as opções são passadas direto.
 *
 * Todas as opções: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/remotion/index.ts");
Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

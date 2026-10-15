/* global process, console -- script do Node */
// Instala (ou remove) o porteiro do ENCeditor na inicialização do Windows:
// um arquivo .vbs na pasta "Inicializar" do usuário roda o porteiro
// escondido (sem janela) a cada login. Também liga o porteiro agora.
//
//   node scripts/instalar-porteiro.mjs            instala e liga
//   node scripts/instalar-porteiro.mjs --remover  tira da inicialização

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORTEIRO = path.resolve(import.meta.dirname, "porteiro.mjs");
const INICIALIZAR = path.join(
  process.env.APPDATA ?? "",
  "Microsoft",
  "Windows",
  "Start Menu",
  "Programs",
  "Startup",
);
const VBS = path.join(INICIALIZAR, "ENCeditor-porteiro.vbs");

if (process.argv.includes("--remover")) {
  fs.rmSync(VBS, { force: true });
  console.log("Porteiro tirado da inicialização do Windows.");
  console.log(
    "(Se estiver rodando agora, ele para no próximo reinício do PC.)",
  );
  process.exit(0);
}

// Aspas dobradas = aspas dentro de texto no VBScript.
const comando = `""${process.execPath}"" ""${PORTEIRO}""`;
fs.writeFileSync(
  VBS,
  [
    "' Liga o porteiro do ENCeditor (http://enceditor.localhost) sem janela.",
    "' Para remover: node scripts/instalar-porteiro.mjs --remover",
    'Set shell = CreateObject("WScript.Shell")',
    `shell.Run "${comando}", 0, False`,
    "",
  ].join("\r\n"),
);
console.log(`Instalado na inicialização do Windows: ${VBS}`);

// Liga agora (se a porta 80 já estiver em uso, ele mesmo avisa e sai).
spawn("wscript.exe", [VBS], { detached: true, stdio: "ignore" }).unref();
try {
  execFileSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Start-Sleep -Seconds 2",
  ]);
} catch {
  // só uma pausa
}
console.log("Porteiro ligado. Abra http://enceditor.localhost");

/* global process, console -- script do Node */
// Cria o atalho "encEditor" na área de trabalho: clique duplo liga tudo
// escondido (sem janela de terminal) e abre o app no navegador. Nada sobe
// com o Windows: o app só liga quando você abre o atalho.
//
//   node scripts/criar-atalho.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PASTA = path.resolve(import.meta.dirname, "..");
const LANCADOR = path.join(PASTA, "scripts", "abrir-enceditor.vbs");
const ICONE = path.join(PASTA, "public", "enceditor.ico");
const WSCRIPT = path.join(
  process.env.WINDIR ?? "C:/Windows",
  "System32",
  "wscript.exe",
);

// Área de trabalho de verdade (pode estar no OneDrive).
const powershell = (comando) =>
  execFileSync("powershell.exe", ["-NoProfile", "-Command", comando], {
    encoding: "utf8",
  }).trim();
const areaDeTrabalho = powershell("[Environment]::GetFolderPath('Desktop')");
const atalho = path.join(areaDeTrabalho, "encEditor.lnk");
// Nome antigo (o Windows não diferencia maiúsculas: apaga para o novo
// nome valer).
fs.rmSync(path.join(areaDeTrabalho, "ENCeditor.lnk"), { force: true });

powershell(
  [
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('" +
      atalho +
      "')",
    "$s.TargetPath = '" + WSCRIPT + "'",
    "$s.Arguments = '\"" + LANCADOR + "\"'",
    "$s.WorkingDirectory = '" + PASTA + "'",
    "$s.IconLocation = '" + ICONE + ",0'",
    "$s.Description = 'Abre o encEditor (liga em segundo plano, sem janela)'",
    "$s.Save()",
  ].join("; "),
);

// Limpa versões antigas: o atalho de link (.url) e a inicialização com o
// Windows (não é mais usada).
fs.rmSync(path.join(areaDeTrabalho, "encEditor.url"), { force: true });
fs.rmSync(
  path.join(
    process.env.APPDATA ?? "",
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "encEditor-porteiro.vbs",
  ),
  { force: true },
);
console.log(`Atalho criado: ${atalho}`);

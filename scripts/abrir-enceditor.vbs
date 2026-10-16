' Abre o ENCeditor sem nenhuma janela de terminal:
' liga o porteiro escondido (se ja estiver ligado, ele mesmo sai) e abre o
' navegador em http://enceditor.localhost. O porteiro liga o app (tambem
' escondido) e mostra "Ligando o ENCeditor..." ate ficar pronto.
' Usado pelo atalho da area de trabalho (node scripts/criar-atalho.mjs).
Set shell = CreateObject("WScript.Shell")
pasta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "node """ & pasta & "\porteiro.mjs""", 0, False
WScript.Sleep 1000
shell.Run "http://enceditor.localhost/", 1, False

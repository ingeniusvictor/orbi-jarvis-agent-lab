Option Explicit
Dim shell, fso, repo, cmd
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
repo = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
cmd = "cmd.exe /d /s /c ""cd /d """ & repo & """ && node scripts\lumia-desktop-launcher.mjs"""
shell.Run cmd, 0, False

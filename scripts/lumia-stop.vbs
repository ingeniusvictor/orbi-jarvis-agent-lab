Option Explicit

Dim shell, fso, repo, stopper, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

repo = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
stopper = fso.BuildPath(repo, "scripts\lumia-desktop-stop.mjs")

If Not fso.FileExists(stopper) Then
  MsgBox "No se encontro el cierre de L.U.M.I.A.:" & vbCrLf & stopper, vbExclamation, "L.U.M.I.A."
  WScript.Quit 2
End If

shell.CurrentDirectory = repo
command = "node.exe """ & stopper & """"
shell.Run command, 0, False

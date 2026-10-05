Option Explicit

Dim shell, fso, repo, launcher, logPath, command, exitCode, errorText
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

repo = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
launcher = fso.BuildPath(repo, "scripts\lumia-desktop-launcher.mjs")
logPath = fso.BuildPath(repo, ".local-runtime\lumia-launcher.log")

If Not fso.FileExists(launcher) Then
  MsgBox "No se encontro el launcher de L.U.M.I.A.:" & vbCrLf & launcher, vbExclamation, "L.U.M.I.A."
  WScript.Quit 2
End If

shell.CurrentDirectory = repo
command = "node.exe """ & launcher & """"

On Error Resume Next
exitCode = shell.Run(command, 0, True)
If Err.Number <> 0 Then
  errorText = Err.Description
  Err.Clear
  On Error GoTo 0
  MsgBox "No se pudo iniciar L.U.M.I.A. sin consola." & vbCrLf & _
         "Verifica que Node.js este instalado y disponible en PATH." & vbCrLf & vbCrLf & _
         errorText, vbExclamation, "L.U.M.I.A."
  WScript.Quit 3
End If
On Error GoTo 0

If exitCode <> 0 Then
  MsgBox "L.U.M.I.A. no pudo completar el arranque." & vbCrLf & _
         "Revisa el registro:" & vbCrLf & logPath, vbExclamation, "L.U.M.I.A."
End If

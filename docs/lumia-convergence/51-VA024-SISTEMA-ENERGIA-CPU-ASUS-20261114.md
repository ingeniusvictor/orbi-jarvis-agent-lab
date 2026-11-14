# VA-02.4 — Diagnóstico del entorno de CPU, sin volver a forzar Kokoro

**Fecha:** 14-11-2026. **Destino:** solo clon `LUMIA-VQ03-QA` del borrador PR #83. **No aplica cambios** a la ASUS de producción ni al plan de energía.

## Hallazgo físico VA-02.3

El usuario ejecutó en la ASUS los cuatro bloques sucesivos de Kokoro **auto → 4 → 4 → auto**, cada uno con ocho fragmentos y el mismo conjunto de cuatro frases españolas; WAV temporales eliminados. La prueba funcional devolvió `VA-02.3 PASS`.

| Bloque | Hilos | p50 síntesis | p95 |
| --- | --- | ---: | ---: |
| 1 | automático | **1536.4 ms** | 1650.1 ms |
| 2 | 4 | 1652.1 ms | 1892.4 ms |
| 3 | 4 | 2216.3 ms | 2770.3 ms |
| 4 | automático | **3099.6 ms** | 3948.9 ms |

Agregados: auto p50 **1650.1 ms**, p95 **3948.9 ms**; 4 hilos p50 **1844.6 ms**, p95 **2770.3 ms**. Variación 4 vs auto **+11.8% (más lento)**. La mediana auto creció **+101.7%** desde el primer al cuarto bloque, superando en mucho la barrera de deriva 15% del propio ensayo. **El A/B es INCONCLUSO sobre el rendimiento relativo de hilos**: no usar el p95 agregado ni la diferencia de p50 para decidir. No atribuir causalmente a temperatura sin telemetría y descartar por ahora seguir ajustando hilos. VA-02.2 anterior indicó que 2 hilos era +28.6% más lento, y que 4 hilos empataba −0.3% con auto, pero ese ensayo también tenía deriva temporal entre sesiones.

**Decisión inmediata:** conservar modelo, voz, pesos y CPU threading automático. No introducir CUDA, plugins ni nuevo modelo. No promover PR #83 a LUMIA-ASUS. Separar toda medición de Chrome (pausas audio) de la síntesis ONNX, y recordar que la LUMIA diaria ya hace prefetch del siguiente fragmento.

## VA-02.4: observación ligera, de solo lectura

`scripts/lumia-host-health-va024.ps1` se ejecuta solo tras verificar:
- que su propia carpeta es `LUMIA-VQ03-QA`, nunca `LUMIA-ASUS`;
- que el original conserva SHA protegido `1580a5182eba540893e35e37065be77da4ed014c`;
- que el clon sigue en `feature/lumia-vq03-vrm-intent-clarity-20261113`.

Recoge **sin síntesis, sin micrófono y sin grabar nada**:
- estado CA/batería de Windows, si el sistema lo expone;
- plan de energía actual, mediante `powercfg /getactivescheme` (**solo lectura**, no /set);
- RAM disponible aproximada;
- ocho muestras aproximadamente consecutivas de carga de CPU, porcentaje de frecuencia máxima y límite de rendimiento, **solo si los contadores CIM están disponibles**; muestra ND en caso contrario.

**Limitaciones decisivas:** el contador `PercentofMaximumFrequency` es un porcentaje relativo, no MHz medidos; `Win32_Processor.CurrentClockSpeed` procede de SMBIOS y no es una medición térmica ni una frecuencia en tiempo real. Windows CIM no ofrece consistentemente temperatura de paquete CPU: **el script NO mide temperatura ni demuestra thermal throttling**. Estas ocho muestras en reposo no prueban que la velocidad del CPU cambie bajo carga; son un primer descarte de problemas evidentes de energía o saturación en reposo. Si no muestran anomalías, hacer la siguiente instrumentación con frecuencia y temperatura fiables **durante una prueba controlada y corta**, idealmente con sensores ya instalados y sin ampliar la carga, no repetir cuatro bloques pesados de Kokoro inmediatamente.

Referencias para interpretación:
- https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-processor
- https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-perfformatteddata
- https://learn.microsoft.com/en-us/windows/win32/wmisdk/wmi-tasks--performance-monitoring

## Uso físico, una vez PASS de CI

1. Cerrar cualquier voz de VQ-03, VA-02, VA-02.1, VA-02.2, VA-02.3 con Ctrl+C. Evitar iniciar otro ensayo de Kokoro. Mantener CPU sin carga intencionada durante las ocho muestras.
2. Verificar baseline original y Git limpio en clon, actualizar **solo clon QA** por fast-forward a SHA certificado.
3. Ejecutar desde el clon:

```powershell
Push-Location "$env:USERPROFILE\LUMIA-VQ03-QA"
try {
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lumia-host-health-va024.ps1
  if ($LASTEXITCODE -ne 0) { throw "VA-02.4 fallo." }
} finally { Pop-Location }
```

4. Compartir solo líneas `[VA-02.4]`, sin información de identificación del equipo. Si hay datos ND, no asumir cero. No ejecutar tareas de «optimización» automáticas.
5. No afirmar que la ASUS está térmicamente limitada ni cambiar energía o ventiladores sin evidencia física.

El resultado de CI protege el script y analiza su sintaxis en Windows. No constituye ejecución del diagnóstico en la ASUS física.

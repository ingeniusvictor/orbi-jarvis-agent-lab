# VA-02.3 — Comprobación equilibrada de Kokoro: auto vs 4 hilos

Fecha: 14-11-2026. Estado: experimento exclusivo del clon `LUMIA-VQ03-QA` del PR #83. **Nunca se modifica `LUMIA-ASUS` ni se promociona un perfil automáticamente.**

## Evidencia de la ASUS aportada por el propietario

VA-02.2 — cuatro frases fijas, dos rondas, tres perfiles secuenciales:

| Perfil | p50 total | p95 total | p50 ONNX | vs. auto |
| --- | ---: | ---: | ---: | ---: |
| auto | 2063 ms | 2506.8 ms | 2055.2 ms | referencia |
| CPU 2 hilos | 2652.1 ms | 2775.5 ms | 2643.5 ms | **+28.6% más lento** |
| CPU 4 hilos | 2056.6 ms | 2208.3 ms | 2045.6 ms | **-0.3%**, empate práctico |

El usuario obtuvo `VA-02.2 PASS`, proveedor CPU verificado, misma voz/modelo y proceso independiente por perfil. **No modificar configuración diaria por esta diferencia de p50**. La p95 menor de cuatro hilos es exploratoria (ocho observaciones por variante, posibles efectos de orden). VA-02.1 anterior tuvo p50 total **1332.9 ms**, casi 55% menos que este auto p50. Es una diferencia entre sesiones, no un efecto causal demostrado de cambiar hilos.

## Diseño VA-02.3 (A-B-B-A)

- Utiliza `VA023_ORDER = ['auto','4','4','auto']` y excluye 2 hilos porque en el ensayo previo fue sustancialmente más lento.
- Inicia/cierra **cuatro** procesos residentes de Kokoro sucesivos, nunca superpuestos.
- Por cada bloque: verificar proveedor `CPUExecutionProvider`, precalentar y medir **las mismas cuatro frases, dos rondas**, descartando la frase de calentamiento. No reproducir ni guardar WAV.
- Entrega los p50/p95 de cada bloque, agregados de **16 fragmentos auto y 16 fragmentos 4 hilos**, y la deriva entre el primer y último bloque auto.
- Si la mediana auto difiere más del **15%** entre principio y final, etiqueta referencia inestable y **prohíbe inferir un ganador**. Ese 15% es umbral orientativo de diagnóstico, no garantía estadística.
- Si el cambio de p50 con 4 hilos no llega al **10% de reducción**, no propone acelerar la versión principal. Una reducción superior exige segunda réplica y pruebas auditivas/carga con Qwen y Motion R8; **no configura ni despliega nada**.
- Valida que los WAV de la misma frase sean plausiblemente comparables en longitud (tolerancia 5%) pero esto no garantiza calidad acústica o identidad de timbre.
- Sin dependencias nuevas, instalación, micrófono, grabaciones ni archivos persistentes. El control de cambios Git mantiene `LUMIA-ASUS` en `1580a5182eba540893e35e37065be77da4ed014c`; el experimento solo corre desde `LUMIA-VQ03-QA`.

## Uso en Windows, únicamente después de CI PASS para HEAD

Cierra el laboratorio de voz y cualquier VA-02 previo. Revisa `git status` limpio del clon y que el original conserva el commit protegido. Actualiza únicamente `LUMIA-VQ03-QA` mediante `git fetch` y `git merge --ff-only FETCH_HEAD`. Una vez confirmado el SHA aprobado:

```powershell
Push-Location "$env:USERPROFILE\LUMIA-VQ03-QA"
try {
  node .\scripts\certify-lumia-va023-cpu-stability.mjs
  if ($LASTEXITCODE -ne 0) { throw 'VA-02.3 certification failed' }
  node .\scripts\lumia-kokoro-cpu-stability-va023.mjs
  if ($LASTEXITCODE -ne 0) { throw 'VA-02.3 physical benchmark failed' }
}
finally { Pop-Location }
```

Compartir únicamente líneas `[VA-02.3]`. No instalar Python, CUDA ni ONNX nuevos. Si el perfil auto usa un proveedor no CPU, el script falla cerrado en vez de comparar no equivalentes.

**No asumir que los 32 fragmentos reflejan conversación real.** Habría que evaluar temperatura/carga CPU y GPU, tiempos de reproducción Chrome y coexistencia con Qwen. Prefetch del próximo fragmento y primer chunk corto ya estaban disponibles en el lanzador diario de LUMIA.

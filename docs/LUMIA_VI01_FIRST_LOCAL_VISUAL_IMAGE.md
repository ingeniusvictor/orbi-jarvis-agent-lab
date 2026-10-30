# VI-01 — Primera foto multimodal local, sin reemplazar voz ni avatar

## Certificación externa obtenida por el propietario

ASUS TUF i5-10300H / 32 GB / GTX 1650 Ti 4 GB / driver NVIDIA
617.42 con Ollama `qwen3.5:2b-q4_K_M` y `think:false`.
La prueba PowerShell `/api/chat` con una fotografía real recibió:

- `ollama ps`: **100 % GPU**, contexto 4096, modelo residente 1,6 GB.
- `nvidia-smi`: **2345 MiB / 4096 MiB** VRAM global usada.
- Respuesta total **23,57 s**; 150 tokens generados a **73,43 tok/s**.
- La imagen era una captura de WhatsApp con cuadrícula de cámaras vinculadas
  al PMGD El Parral. La descripción Qwen incluía la cuadrícula y una flecha,
  pero **identificar cámaras térmicas, un objeto flotante o la causa del
  brillo no está demostrado**. No emitir hallazgos técnicos sin revisar
  originales, metadatos y detalle.
- `num_predict=150` interrumpió la respuesta a mitad de una transcripción.
- Estimación de generación: 150 / 73,43 ≈ 2,04 s; el restante ≈ 21,53 s
  incluye procesamiento de imagen, tokenización, carga y evaluación.
  No atribuir la demora exclusivamente a la GPU ni a cargar pesos.

## Alcance

Primera fase opt-in **seleccionar foto JPG/PNG/WebP y preguntarle a LUMIA**.
La foto se transforma en el navegador a JPEG escalado (1024 → 512)
con límite de 12 MB del archivo original y máximo de 2 millones de
caracteres de base64. El backend valida tipo, formato, cabecera y tamaño,
rechaza las imágenes no autorizadas y envía `images` a Ollama
`/api/chat` con `think:false`, texto en español y hasta 256 tokens.

La respuesta alimenta el flujo existente de HUD, voz y Kokoro sin
modificar el modelo activo, la identidad LUMIA ni el GLB.
El texto de la pregunta y la respuesta se guardan como siempre en
memoria de conversación, pero **no la foto ni los datos base64**.
No se habilita cámara, captura de pantalla, almacenamiento ni vigilancia.
No funciona con backend remoto direct.

## Activación experimental

Ambas variables son obligatorias en el mismo proceso que arranca LUMIA:

```powershell
$env:VITE_LUMIA_VISUAL_INPUT_VI01 = '1'
$env:ORBIA_LUMIA_VISION_ENABLED = '1'
$env:JARVIS_OLLAMA_MODEL = 'qwen3.5:2b-q4_K_M'
$env:ORBIA_LUMIA_MODEL = 'qwen3.5:2b-q4_K_M'
npm run start:lumia
```

En ASUS, la instalación física completa de LUMIA, Whisper, Kokoro,
su GLB privado y ajustes locales aún necesita validación; no afirmar
que la aplicación está desplegada por haber pasado CI en GitHub.
La prueba puede ejecutarse en la copia experimental cuando los
prerrequisitos locales estén presentes. El 2B confirmado está en ASUS;
**no asumir que existe en el Ryzen**. Antes de probar, `ollama list`
debe confirmar que el modelo visual seleccionado existe en ese equipo.

## Seguimiento

- Botón «VISIÓN · FOTO» esquina inferior derecha, detrás de un flag.
- Seleccionar archivo y escribir una pregunta. El modelo no inspecciona
  fotografías ocultas ni se activa la webcam por sí sola.
- Probar captura de WhatsApp o foto de equipo solar, inspeccionando
  alucinaciones: **observado** vs **hipótesis** vs **no verificable**.
- Medir `load_duration`, `prompt_eval_duration`, `eval_duration`,
  tiempo hasta primera voz y `ollama ps` por separado.
- No abrir documentos con contraseñas, números personales, secretos
  ni información de terceros sin autorización.
- Pantalla, webcam y multiframe son etapas posteriores con consentimiento
  explícito y permiso separado. Aún no implementados en VI-01.
- Base encadenada: WR-01 #26, MI-02 #25, RA-01 #24.
  `main` sigue protegido. Resguardar
  `src/scene/LumiaAvatar.tsx` local (rostro calibrado) antes de actualizar.

## Certificación adicional: resolución visual Ryzen (28-oct-2026)

Propietario ejecutó benchmark local en Ryzen 7 4700U con Ollama 0.40.12,
`qwen3.5:0.8b` en CPU, `think:false`, `num_ctx:4096`,
`num_predict:250`. Fuente: salida de consola suministrada por el propietario.
Misma infografía de 2048 × 1152, misma pregunta de lectura de seis encabezados,
una ejecución por resolución, sin truncamiento reportado.

| Imagen | Dimensiones | Total (s) | Imagen + prompt (s) | Generación (tok/s) | Encabezados exactos |
| --- | --- | ---: | ---: | ---: | ---: |
| Original | 2048 × 1152 | 49,03 | 36,43 | 21,92 | 6/6 |
| 1280 | 1280 × 720 | 19,76 | 11,35 | 24,97 | 6/6 |
| **1024** | **1024 × 576** | **15,53** | **7,10** | **24,65** | **6/6** |
| 768 | 768 × 432 | 21,53 | 13,02 | 24,20 | 6/6 |

**Conclusión limitada a esta infografía:** 1024 px redujo tiempo total un
**68,3 %** (49,03 → 15,53 s, ~3,16×) y procesamiento de imagen+prompt
**80,5 %** (36,43 → 7,10 s), manteniendo seis encabezados reconocidos.
768 px fue más lento que 1024 px en esta medición; investigar variación,
paginación y tokenización, no dar por sentada la monotonicidad por tamaño.

El cliente VI-01 **ya intenta 1024 px como primer tamaño** antes de
800/640/512 (solo desciende cuando el límite de base64 lo requiere):
`src/lib/visual-input.ts`. La coincidencia con este óptimo de prueba es
positiva, **no requiere aumentar resolución ni cambiar código de producción**.
El navegador recompone la foto a JPEG calidad 0,76 y límites de tamaño;
ello puede modificar la legibilidad respecto del benchmark. Las pruebas
locales con API de Ollama **no validan aún la integración en interfaz
LUMIA, ni el desempeño simultáneo de Whisper/Kokoro/avatar**.

Pendientes de confirmación:
- Comparar el CSV y TXT completos, no solo 6/6 encabezados, para evaluar
  transcripción de todos los renglones y posibles errores de texto.
- Repetir 1024 y 1280 con el mismo prompt, 2–3 veces, registrar RAM/
  `prompt_eval_count`, `load_duration` y temperaturas.
- Probar fotografías técnicas con números de serie y capturas largas con
  letras pequeñas antes de generalizar. Para documentos con texto fino,
  habilitar recorte explícito o examen de regiones por separado.
- El Ryzen mantiene `qwen3:1.7b` como candidato de voz rápido y
  `qwen3.5:0.8b` como candidato visual; el enrutamiento entre ambos NO
  está certificado en LUMIA ni debe asumirse implementado.

## Auditoría de calidad de transcripción — CSV/TXT revisados (28-oct-2026)

Se analizaron los originales `LUMIA_VISION_METRICAS.csv` y
`LUMIA_VISION_RESPUESTAS.txt` proporcionados por el propietario,
contrastándolos con la infografía fuente de 2048 × 1152 («DÍA 1 TU
PRIMER AGENTE: CORREO Y WHATSAPP»). El conjunto de referencia tiene
**26 líneas significativas**: título (1), encabezados numerados (6),
indicaciones de los seis bloques (18) y cierre inferior (1).
Las métricas no incluyen calentamiento; se hizo **una ejecución por resolución**.

| Variante | Tiempo total | Tiempo imagen+prompt | Tokens generados | Exactas/26 | Errores |
| --- | ---: | ---: | ---: | ---: | --- |
| Original 2048×1152 | 49,03 s | 36,43 s | 204 | 24/26 | «Crealo», «yelige» |
| 1280×720 | 19,76 s | 11,35 s | 205 | 24/26 | «Crealo», «eliges» |
| **1024×576** | **15,53 s** | **7,10 s** | **205** | **26/26** | **ninguno** |
| 768×432 | 21,53 s | 13,02 s | 204 | 24/26 | «Creao», «uso limitado» |

**Diferencia semántica importante:** a 768 píxeles la línea fuente
«No es uso ilimitado» se convirtió en «No es uso limitado». Este error
cambia el sentido de la advertencia y muestra por qué «6/6 encabezados»
NO equivale a una transcripción completa y segura.

En esta ejecución única, 1024 píxeles fue **68,3 %** más rápido en tiempo
total frente al original (3,16×), y **80,5 %** más rápido en evaluación de
imagen+prompt. Las velocidades de generación (21,92 / 24,97 / 24,65 /
24,20 tok/s) no explican la mayor parte de la diferencia.

**Decisión AV/VI-01:** Mantener 1024 píxeles como primer tamaño del
selector visual local. Ya está implementado en
`src/lib/visual-input.ts`; no se necesita ajustar ese archivo para
este experimento. Para capturas verticales, texto denso o seriales,
considerar recortes dirigidos o pruebas de mayor resolución. Una
reducción a 1024 por el lado mayor no garantiza legibilidad del texto
pequeño (en una captura de 720×1600 pasa a 461×1024).

**Límites de certificación:** 
- Se evaluó **una sola imagen**, con una corrida por resolución.
- No se certifican OCR general, exactitud de seriales, lectura de alarmas,
  ausencia de alucinaciones o comportamiento durante voz y micrófono.
- La conversión a JPEG del navegador VI-01 puede diferir del
  preprocesamiento realizado por el benchmark PowerShell.
- La ruta dual `qwen3:1.7b` conversación /
  `qwen3.5:0.8b` visión Ryzen sigue siendo propuesta,
  **no conmutador ya implementado**.
- La integración ASUS `qwen3.5:2b-q4_K_M` y la validación física
  completa con avatar y Whisper/Kokoro permanecen pendientes.


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

# LUMIA VISION-03 — Ojos verificables, no descripciones aisladas

## Punto de partida y alcance real (8 noviembre 2026)

En la ASUS con `qwen3.5:2b-q4_K_M`, el proyecto ya tiene **fotografía manual**, **un único fotograma autorizado de webcam**, **visor previo de 90 s**, **resolución AUTO 768/1024**, **seguimientos sobre el mismo JPEG durante 5 minutos**, **trazabilidad y restricciones sobre alucinaciones de conteos**. No está certificada la percepción continua; describir una foto no es observar movimiento.

Las pruebas con Kokoro/Qwen de noviembre confirman buena latencia de texto ordinario, pero **no garantizan la misma rapidez con imágenes**. Todo avance debe contrastar calidad, latencia y VRAM física en ASUS.

## Modelo de madurez visual

| Nivel | Acción observable | Estado |
| --- | --- | --- |
| OJO-0 | Analiza foto seleccionada y señala incertidumbre | Implementado, calidad variable |
| OJO-1 | Captura autorizada de webcam, muestra el JPEG real, memoria temporal corta | Implementado |
| **OJO-2** | Diferencia «fotograma anterior» de «escena actual»; impide afirmaciones temporales no observadas | **Este PR: VI-03.0** |
| OJO-3 | Compara dos fotografías recientes con consentimiento y tiempos explícitos; informa solo diferencias verificables | Siguiente fase, por implementar |
| OJO-4 | Sesión de observación visual opt-in acotada (indicador visible, duración finita, cancelación inmediata, muestreo limitado) | Diseñar y probar después de OJO-3 |
| OJO-5 | Atención espacial a zonas/objetos, recorte autorizado, consistencia multimodal y conversación sobre cambios con memoria visual efímera | Futuro, condicionado a QA |

No confundir OJO-4 con streaming de video de alta frecuencia: el 2B no está demostrado para inferencia visual a 30 FPS. Lo razonable es muestreo espaciado, sin capturas ocultas y con límites claros de procesamiento.

## Primer cambio: VI-03.0 · Veracidad temporal

Cuando el dueño haya analizado una foto y pregunte «¿qué cambió?», «¿sigue ahí?» o «¿qué ves ahora?», LUMIA **no debe responder con información actual imaginaria** ni abrir la cámara de manera automática.

La nueva barrera se activa solo en un seguimiento claramente temporal de una foto vigente. Informa que la escena está congelada y orienta al control ya existente «Volver a encuadrar → Capturar y analizar». Para foto cargada, pide otra imagen. Preguntas atemporales (color, fondo, cantidad visible) siguen por la vía normal del JPEG. Comandos explícitos de cámara mantienen sus permisos existentes.

- Opt-in en sesión: `VITE_LUMIA_VISION_TEMPORAL_VI030=1` para aislar el piloto de la base certificada.
- No se guardan fotos nuevas ni se altera el algoritmo, tamaño o modelo.
- El usuario sigue pudiendo cerrar el visor; la foto vence a los cinco minutos.
- No añadir texto temporal a la memoria como si proviniera de nueva observación.

## Próximas entregas propuestas

### VI-03.1 — Dos instantes, una comparación honesta

1. Modo **Comparar escenas** abierto manualmente en el visor; consentimiento claro para exactamente dos capturas.
2. Capturas con marca de tiempo, indicador de cada disparo y opción de cancelar; la cámara se cierra antes de inferir.
3. Contrato de backend de máximo dos JPEG independientes (nunca historial de webcam ni video completo), dentro de límites existentes de memoria/tamaño.
4. Pregunta controlada: «Entre instante A e instante B, ¿qué diferencias VISIBLES hay?». Separar *detectado*, *posible* y *no comprobable*; nunca inventar desplazamiento si no aparece evidencia.
5. Evaluación en ASUS: objeto entra/sale, cambio de posición, ningún cambio, fondo, poca luz, cambio de ángulo, personas ocluidas, texto pequeño, cancelación a mitad de captura. Calidad y tiempos se medirán con el modelo actual.

### VI-03.2 — Sesión ocular acotada, no vigilancia

- Control explícito «Empezar observación»/«Detener», indicador persistente y corte por tiempo máximo.
- Frecuencia conservadora y máximo de fotogramas; nunca cámara silenciosa en reposo.
- Sólo analizar eventos necesarios; impedir consultas acumuladas o procesamiento concurrente sin límite.
- Pausar inmediatamente por cancelación, pérdida de permiso, cambio de pestaña, interrupción explícita o cierre del visor.
- No grabar audio/video y no guardar JPEG en localStorage, IndexedDB ni disco.

### VI-03.3 — Atención dirigida

- Resolver «el objeto detrás», «el número en el medidor», «¿qué cambió a la izquierda?» con recorte de región confirmado por el usuario y/o referencias espaciales.
- Verificación de lectura OCR/etiquetas, incertidumbre cuantificable cuando sea técnicamente posible; **no** porcentajes de confianza inventados por el modelo.
- Pilotos con equipos fotovoltaicos reales sólo cuando los datos e imágenes sean autorizados.

## Gates antes de certificar «ojos»

1. No cámara o recaptura sin autorización; cierre y caducidad comprobados.
2. Identificación inequívoca de origen, momento y número de fotogramas que recibió Ollama.
3. Descripción no confunde pasado/actualidad; ante incertidumbre solicita otra observación.
4. Pruebas de no regresión: Qwen 2B, visión AUTO, voz Kokoro, seguimiento de fotos y memoria de conversación.
5. QA físico en ASUS con 2–3 ensayos por escena; comparar latencia, errores y uso de VRAM.
6. **Nunca anunciar visión continua, percepción 3D fiable o reconocimiento de identidades** antes de demostración y certificación reales.

## Regresión / reversión

Base de esta rama: `feature/lumia-amr030-daily-2b-voice-continuity-20261108`. La mejora VI-03.0 es independiente del diagnóstico de voz AMR-03.1. El lanzador del piloto activa una protección lógica y reutiliza el lanzador 2B AMR-03.0; la configuración anterior queda disponible al cerrar y abrir con el lanzador AMR-03.0.

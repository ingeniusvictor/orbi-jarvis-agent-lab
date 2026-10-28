# MI-02 — Inventario local real y preguntas de seguimiento en LUMIA

## Problema reproducido en Ryzen 7 4700U

El usuario probó `qwen3:1.7b` en la interfaz con Whisper y Kokoro.
La pantalla mostró:
- «Puedes indicarme cuántos modelos tienes para cambiar»
- «¿Cuáles son esos modelos?»
- respuestas genéricas («depende del contexto», «modelos de visión...») en vez del
  inventario concreto de Ollama
- primera respuesta textual de una de esas preguntas alrededor de +23,34 s.

La invocación anterior de `parseModelControl(prompt)` solamente cubría
ciertas formulaciones muy específicas. Una pregunta en español natural
quedaba en el flujo de inferencia del modelo, y ese modelo podía inventar
una taxonomía de IA. El registro de modelos ya existía y consulta
`GET /api/tags` en Ollama; no hacía falta consultar un LLM para esto.

## Cambios

- Las preguntas «¿Cuántos modelos tienes?», «¿Cuántos modelos de IA tienes
  disponibles para cambiar?», etc., producen una **cuenta exacta** del
  inventario local y el nombre del modelo activo, sin generar respuesta por LLM.
- «¿Qué modelos tienes?», «¿Cuáles son los modelos que tienes disponibles?»
  siguen listando los modelos reales del runtime.
- «¿Cuáles son esos modelos?» y «¿Cuáles son los modelos?» se resuelven como
  consultas al inventario **solo si las últimas tres conversaciones user/
  assistant hablan de los modelos locales disponibles**. Si no hay ese
  contexto, mantienen el procesamiento conversacional normal.
- El inventario lee los modelos presentes en **esa computadora**. No confunde
  los modelos del Ryzen con los instalados en la ASUS y no adivina nombres.
- Se conserva el control explícito de cambio de modelo; no hay cambios de
  configuración en Windows ni escrituras de archivos por voz.
- Un test determinista cubre las frases exactas de la captura, negaciones,
  preguntas genéricas, cambio de modelo y enlace a /api/tags.

## Límites

Este cambio evita inferencia innecesaria únicamente para consultas al
inventario. **No se puede inferir de él que el tiempo de una consulta general
baje de 20 segundos a 2**. Whisper, Kokoro, concurrencia de CPU y respuesta
abierta del modelo seguirán dependiendo del hardware.

La transcripción «guía local» podría referirse legítimamente a una guía
instalada en el computador; no se reescribe como «IA local» porque eso
supondría alterar el significado de una orden ambigua.

La captura indica que el rostro se ve con mucha luminosidad turquesa,
pero no se toca la calibración visual ni el GLB, ambos aprobados localmente.

## Continuidad

- Rama: `feature/lumia-model-inventory-context-mi02`
- Base encadenada: RA-01 → RC-01 → VA-01 → TL-01.
- No fusionar con `main`; no modificar accesos directos de Windows.
- En TL-01 existe una versión ajustada localmente de
  `src/scene/LumiaAvatar.tsx`. Respaldar y preservar esa versión antes
  de traer nuevas ramas.
- Para probar: preguntar por cuántos modelos instalados tiene LUMIA;
  luego «¿Cuáles son esos modelos?», y revisar el nombre exacto de cada modelo
  y la latencia en `COPIAR REGISTRO`.

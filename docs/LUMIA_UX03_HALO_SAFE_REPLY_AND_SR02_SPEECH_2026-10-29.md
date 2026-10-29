# UX-03 + SR-02 — Respuestas legibles junto al halo y español regional

## Evidencia

Captura de propietario ~1761 x 831 muestra respuestas avanzando hacia el borde derecho del aro. Registro local 28 Oct: `Lumidime 5 formas`, `hacer una agarriba`, `hacer una haripa`, `rellenos ... ARIPA`, mientras Kokoro comenzó a hablar entre 1.91 y 7.46 s según el turno. La velocidad y el error léxico son fenómenos separados.

## UX-03

En escritorios amplios >=1201px, limitar la anchura visible del panel de respuestas según 50vw menos margen derecho, radio de seguridad del halo y 16px de separación. No usar máscara/clipping que destruya texto; preservar desplazamiento vertical de respuestas y evidencias. En ventanas medianas o móviles, ofrecer una tarjeta oscura pequeña desplazable, por legibilidad, hasta diseñar un layout móvil específico. No modificar geometría ni escala del avatar/aro, audio, paneles de entrada, ni 'Copiar registro'.

## SR-02

Continuar con la normalización contextual local del STT: reparar `agarriba/haripa/aripa` solo después de `hacer/preparar/cocinar una`, con plato regional, o con pistas alimentarias en la misma cláusula. No sustituir cualquier `arriba` ni palabras parecidas fuera de ese contexto. Reparar `Lumidime` solo al comienzo de un enunciado y seguido de marcadores claros de pregunta, no si es un nombre propio aislado. Mantener expresiones explicitas de corrección como `no es ARIPA, es AREPA` sin transformación. El filtro corre tanto para Whisper residente como CLI antes de llegar a Qwen. No es una mejora del modelo acústico; STT-02 seguirá comparando Whisper Small y Moonshine en el ASUS.

## Validación

Ejecutar tests SR-01 (extendidos), RC-01, UX-03, CI integrado, lint y build. Certificación visual real en la ASUS pendiente; revisar anchos 1761, 1440, 1280 y 1024 píxeles, desplazamiento largo, ring-right clearance y escritura intacta.
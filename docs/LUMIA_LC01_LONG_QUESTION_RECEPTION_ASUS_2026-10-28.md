# LUMIA LC-01 — Conversaciones largas en voz local ASUS

Problema reportado: al dictar una consulta con muchos detalles, LUMIA la entendió aproximadamente hasta la mitad. En la implementación previa el VAD genera archivos de hasta 20 s, Whisper tarda varios segundos por segmento, el ensamblador puede cerrar una oración cuando aún hay un segundo segmento grabándose y el comando expira a los 35 s aun si el interlocutor sigue hablando.

Experimento LC-01 opt-in para el ASUS, sin alterar el perfil por defecto:

- Tras un segmento COMMAND local de al menos 8 s, o si llega una transcripción mientras continúa la siguiente grabación COMMAND, entra en recepción larga; en WAKE, GUARD, DEAF o proveedores no locales no se activa.
- Solo una extensión del temporizador del comando: máximo 100 s DESDE la primera apertura de listen(), nunca 100 s renovables por cada ruido. La activación sigue requiriendo la ventana ordinaria de comando y no permite nuevas autorizaciones ni escritura.
- En recepción larga el ensamblador espera al menos 2400 ms desde el último segmento transcrito, y sigue esperando mientras hay fragmentos COMMAND pendientes o continúa una captura del micrófono. Límite de ensamblado de 90 s.
- El VAD sigue enviando fragmentos de 20 s máximo a Whisper; los resultados se unen en orden sin cambiar el propio motor, los permisos o el modelo.
- El panel D permite comprobar la activación y el número de segmentos. Si la captación termina antes de tiempo, verificar los estados, segmentos y STT; las transcripciones no se guardan automáticamente fuera del registro solicitado por el propietario.

Limitaciones: VAD se basa en energía y no garantiza identidad de hablante. No puede recuperar palabras que Whisper nunca transcribió ni segundos con micrófono silenciado. Si el discurso supera 100 s, el modo vuelve a sus límites para evitar escucha indefinida. Los cambios no alteran avatar, Kokoro, GLB, Ollama ni main.

Rollback: cambiar set VITE_LUMIA_LONG_QUESTION_INPUT=0 en el lanzador ASUS y reiniciar. CI verifica contratos y compilación; el reconocimiento real necesita una prueba en Windows.
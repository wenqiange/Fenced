# Integración de Modelo de Lenguaje Local (Hugging Face)

## 1. Descarga del Modelo y Dependencias
1. Instalar los paquetes necesarios:
   ```bash
   pip install transformers torch
   ```
2. El modelo por defecto es `distilbert-base-uncased`, que se descarga y cachea automáticamente en `~/.cache/huggingface/hub/`.

## 2. Script de Inferencia y Parseig
El script [`scripts/use_model.py`](../scripts/use_model.py) implementa la inferencia mediante Hugging Face Transformers (`AutoTokenizer` y `AutoModelForSequenceClassification`) y procesa el texto de la tarea:
- Inferencia semántica y extracción de prioridad (`urgent`, `high`, `medium`, `low`, `none`).
- Detección de etiquetas (`#etiqueta`).
- Extracción de fechas relativas y horas en catalán, español e inglés.
- Extracción de duraciones estimadas (`30m`, `1h`, etc.).
- Reglas de recurrencia (`FREQ=DAILY`, `FREQ=WEEKLY`, `FREQ=MONTHLY`).

### Ejecución manual:
```bash
# Demo interactiva:
python3 scripts/use_model.py

# Parseo de una tarea concreta:
python3 scripts/use_model.py "Comprar llet demà a les 10h !urgent #compres 30m"

# Modo JSON (utilizado por el backend de Fenced):
python3 scripts/use_model.py --json '{"rawText": "Lliurar memòria divendres !high #uni", "referenceDate": "2026-11-05T12:00:00Z"}'
```

## 3. Integración en la API de Fenced
El backend (`apps/api`) invoca el modelo local de Hugging Face a través del runtime de IA:
1. En `.env` (o variables de entorno del servidor):
   ```env
   AI_ENABLED=true
   AI_PROVIDER=huggingface
   ```
2. Cuando `api.ai.parseTask` recibe una solicitud (por ejemplo, desde el botón de IA en la pantalla de tareas de la app móvil), `getAiRuntime()` selecciona el proveedor `huggingface` y ejecuta [`scripts/use_model.py`](../scripts/use_model.py) de forma transparente devolviendo el objeto validado con `AiParsedTaskSchema`.

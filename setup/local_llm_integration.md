# Integración de Modelo de Lenguaje Local

## Descarga del Modelo
1. Utilizar transformers de Hugging Face para descargar un modelo pequeño, como `distilbert` o similar.
2. Instala el paquete huggingface:
   ```bash
   pip install transformers
   ```

## Configuración
1. Cree un script para cargar el modelo:
   ```python
   from transformers import AutoModelForSequenceClassification, AutoTokenizer

   model_name = "distilbert-base-uncased"
   tokenizer = AutoTokenizer.from_pretrained(model_name)
   model = AutoModelForSequenceClassification.from_pretrained(model_name)
   ```

## Uso
1. Para predecir, tokenizar la entrada y pasarla al modelo:
   ```python
   inputs = tokenizer("El verano que viene", return_tensors="pt")
   outputs = model(**inputs)
   print(outputs)
   ```

2. Ajustar el script para manejar las predicciones y ajustes específicos a su caso de uso.

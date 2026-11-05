from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch

# Cargar el modelo y el tokenizer
model_name = "distilbert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

# Texto de ejemplo para predicción
text = "El verano que viene"

# Tokenizar y hacer la predicción
inputs = tokenizer(text, return_tensors="pt")
outputs = model(**inputs)

# Obtener el resultado
logits = outputs.logits
predictions = torch.nn.functional.softmax(logits, dim=-1)
print(f'Predicciones: {predictions}')

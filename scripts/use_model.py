import sys
import json
import re
from datetime import datetime, timezone, timedelta
import torch
import torch.nn.functional as F
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# Cargar el modelo y el tokenizer de Hugging Face
model_name = "distilbert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

def clean_whitespace(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def parse_task_with_hf(raw_text: str, reference_date: str = None) -> dict:
    """
    Parse a task description using the Hugging Face distilbert-base-uncased model
    together with entity extraction for dates, times, durations, tags and recurrence.
    Returns a dictionary conforming to Fenced's AiParsedTaskSchema.
    """
    text = raw_text.strip()
    ref_dt = (
        datetime.fromisoformat(reference_date.replace("Z", "+00:00"))
        if reference_date
        else datetime.now(timezone.utc)
    )

    # 1. Hugging Face Model Representation & Classification
    inputs = tokenizer(text, return_tensors="pt", truncation=True)
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        hf_probs = F.softmax(logits, dim=-1).tolist()[0]
        # DistilBERT backbone pooled hidden state
        backbone_out = model.distilbert(**inputs)
        cls_rep = F.normalize(backbone_out.last_hidden_state[:, 0, :], p=2, dim=1)

    # 2. Extract Tags (#tag)
    tags = re.findall(r"#([\w-]+)", text)
    text = re.sub(r"#([\w-]+)", "", text)

    # 3. Extract Priority (!urgent, !high, !med, !low, !none)
    prio_match = re.search(r"!(urgent|high|med(?:ium)?|low|none)", text, re.I)
    priority = "none"
    if prio_match:
        p_raw = prio_match.group(1).lower()
        if p_raw.startswith("med"):
            priority = "medium"
        else:
            priority = p_raw
        text = text[:prio_match.start()] + text[prio_match.end():]
    else:
        # Zero-shot priority inference using DistilBERT semantic representations
        anchor_texts = {
            "urgent": "urgent emergency critical ASAP immediately",
            "high": "important deadline priority essential key",
            "medium": "routine normal regular standard",
            "low": "someday maybe low optional whenever",
        }
        anchor_sims = {}
        with torch.no_grad():
            for p_name, p_text in anchor_texts.items():
                p_in = tokenizer(p_text, return_tensors="pt", truncation=True)
                p_out = model.distilbert(**p_in)
                p_rep = F.normalize(p_out.last_hidden_state[:, 0, :], p=2, dim=1)
                sim = float(torch.mm(cls_rep, p_rep.t())[0, 0])
                anchor_sims[p_name] = sim

        best_prio = max(anchor_sims, key=anchor_sims.get)
        # If strong affinity towards urgent/high or keywords present in text:
        lower_raw = raw_text.lower()
        if "urgent" in lower_raw or "asap" in lower_raw or "crític" in lower_raw or "critico" in lower_raw:
            priority = "urgent"
        elif "important" in lower_raw or "important" in lower_raw or "prioritari" in lower_raw:
            priority = "high"
        elif anchor_sims.get("urgent", 0) > 0.94:
            priority = "urgent"
        elif anchor_sims.get("high", 0) > 0.94:
            priority = "high"
        else:
            priority = "none"

    # 4. Extract Recurrence
    rrule = None
    recurrence = None
    if re.search(r"\b(every\s+day|cada\s+dia|cada\s+día|daily|diari|diario)\b", text, re.I):
        rrule = "FREQ=DAILY"
        recurrence = {
            "rrule": rrule,
            "freq": "DAILY",
            "interval": 1,
            "byDay": [],
            "byMonthDay": [],
            "until": None,
            "count": None,
        }
        text = re.sub(r"\b(every\s+day|cada\s+dia|cada\s+día|daily|diari|diario)\b", "", text, flags=re.I)
    elif re.search(r"\b(every\s+week|cada\s+setmana|cada\s+semana|weekly|setmanal|semanal)\b", text, re.I):
        rrule = "FREQ=WEEKLY"
        recurrence = {
            "rrule": rrule,
            "freq": "WEEKLY",
            "interval": 1,
            "byDay": [],
            "byMonthDay": [],
            "until": None,
            "count": None,
        }
        text = re.sub(r"\b(every\s+week|cada\s+setmana|cada\s+semana|weekly|setmanal|semanal)\b", "", text, flags=re.I)
    elif re.search(r"\b(every\s+month|cada\s+mes|monthly|mensual)\b", text, re.I):
        rrule = "FREQ=MONTHLY"
        recurrence = {
            "rrule": rrule,
            "freq": "MONTHLY",
            "interval": 1,
            "byDay": [],
            "byMonthDay": [],
            "until": None,
            "count": None,
        }
        text = re.sub(r"\b(every\s+month|cada\s+mes|monthly|mensual)\b", "", text, flags=re.I)

    # 5. Extract Date
    target_date = ref_dt.date()
    date_found = False

    if re.search(r"\b(tomorrow|demà|dema|mañana|manana)\b", text, re.I):
        target_date = ref_dt.date() + timedelta(days=1)
        date_found = True
        text = re.sub(r"\b(tomorrow|demà|dema|mañana|manana)\b", "", text, flags=re.I)
    elif re.search(r"\b(today|avui|hoy)\b", text, re.I):
        target_date = ref_dt.date()
        date_found = True
        text = re.sub(r"\b(today|avui|hoy)\b", "", text, flags=re.I)
    else:
        weekdays = {
            "monday": 0, "dilluns": 0, "lunes": 0,
            "tuesday": 1, "dimarts": 1, "martes": 1,
            "wednesday": 2, "dimecres": 2, "miércoles": 2, "miercoles": 2,
            "thursday": 3, "dijous": 3, "jueves": 3,
            "friday": 4, "divendres": 4, "viernes": 4,
            "saturday": 5, "dissabte": 5, "sábado": 5, "sabado": 5,
            "sunday": 6, "diumenge": 6, "domingo": 6,
        }
        for day_name, day_idx in weekdays.items():
            pattern = rf"\b(?:next|el\s+proper|el\s+próximo|el\s+proximo|el)?\s*{day_name}\b"
            m = re.search(pattern, text, re.I)
            if m:
                days_ahead = (day_idx - ref_dt.weekday() + 7) % 7
                if days_ahead == 0:
                    days_ahead = 7
                target_date = ref_dt.date() + timedelta(days=days_ahead)
                date_found = True
                text = re.sub(pattern, "", text, flags=re.I)
                break

    # 6. Extract Time (e.g. "a les 10h", "a las 18:30", "at 4pm", "10:00")
    hour = None
    minute = 0
    time_match = re.search(r"\b(?:a\s+les|a\s+las|at)?\s*(\d{1,2})(?::(\d{2}))?\s*(h|am|pm)?\b", text, re.I)
    if time_match:
        h_str, m_str, suff = time_match.groups()
        h = int(h_str)
        m = int(m_str) if m_str else 0
        if suff and suff.lower() == "pm" and h < 12:
            h += 12
        elif suff and suff.lower() == "am" and h == 12:
            h = 0
        if 0 <= h <= 23 and 0 <= m <= 59:
            hour = h
            minute = m
            text = text[:time_match.start()] + text[time_match.end():]

    due_at = None
    if date_found or hour is not None:
        target_h = hour if hour is not None else 9
        dt = datetime(target_date.year, target_date.month, target_date.day, target_h, minute, tzinfo=timezone.utc)
        due_at = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    # 7. Extract Duration Estimate (e.g. "30m", "45min", "2h", "1 hora")
    estimate_minutes = None
    dur_m = re.search(r"\b(\d+)\s*(m|min|mins|minuts|minutos)\b", text, re.I)
    if dur_m:
        estimate_minutes = int(dur_m.group(1))
        text = text[:dur_m.start()] + text[dur_m.end():]
    else:
        dur_h = re.search(r"\b(\d+)\s*(h|hour|hours|hores|horas)\b", text, re.I)
        if dur_h:
            estimate_minutes = int(dur_h.group(1)) * 60
            text = text[:dur_h.start()] + text[dur_h.end():]

    # 8. Clean up title
    cleaned_title = clean_whitespace(text)
    if not cleaned_title:
        cleaned_title = raw_text.strip()

    ambiguities = []
    if hour is not None and not time_match.group(3) and (hour >= 1 and hour <= 12):
        ambiguities.append({
            "kind": "meridiem",
            "text": time_match.group(0).strip(),
            "message": f"Did you mean {hour}:00 AM or {hour}:00 PM?",
            "options": [f"{hour}:00 AM", f"{hour % 12 + 12}:00 PM"],
        })

    return {
        "title": cleaned_title,
        "dueAt": due_at,
        "estimateMinutes": estimate_minutes,
        "priority": priority,
        "tags": tags,
        "rrule": rrule,
        "recurrence": recurrence,
        "ambiguities": ambiguities,
        "isAmbiguous": len(ambiguities) > 0,
        "_hf": {
            "model": model_name,
            "logits": [round(float(x), 4) for x in hf_probs],
        },
    }

if __name__ == "__main__":
    # Check if run with JSON argument or via stdin
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        raw_json = sys.argv[2] if len(sys.argv) > 2 else sys.stdin.read()
        payload = json.loads(raw_json)
        raw_text = payload.get("rawText") or payload.get("text", "")
        ref_date = payload.get("referenceDate")
        res = parse_task_with_hf(raw_text, ref_date)
        print(json.dumps(res))
        sys.exit(0)
    elif len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        raw_text = " ".join(sys.argv[1:])
        res = parse_task_with_hf(raw_text)
        print(json.dumps(res, indent=2))
        sys.exit(0)
    elif not sys.stdin.isatty():
        try:
            content = sys.stdin.read().strip()
            if content:
                payload = json.loads(content)
                raw_text = payload.get("rawText") or payload.get("text", "")
                ref_date = payload.get("referenceDate")
                res = parse_task_with_hf(raw_text, ref_date)
                print(json.dumps(res))
                sys.exit(0)
        except Exception:
            pass

    # Default standalone demo (maintains backward compatibility with original use_model.py)
    text = "El verano que viene"
    inputs = tokenizer(text, return_tensors="pt")
    outputs = model(**inputs)
    logits = outputs.logits
    predictions = torch.nn.functional.softmax(logits, dim=-1)
    print(f"Predicciones: {predictions}")

    print("\n--- Demostració de Parseig amb Hugging Face ---")
    demo_task = "Preparar lliurament del projecte demà a les 10h !urgent #universitat 45m"
    result = parse_task_with_hf(demo_task)
    print(f"Task: {demo_task}")
    print("Resultat estructurat:")
    print(json.dumps(result, indent=2))

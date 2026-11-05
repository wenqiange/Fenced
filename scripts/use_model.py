import sys
import json
import os
import re
from datetime import datetime, timezone, timedelta
import warnings

os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
warnings.filterwarnings("ignore")

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, logging as hf_logging
hf_logging.set_verbosity_error()

# Model selection: defaults to compact instruction LLM Qwen/Qwen2.5-0.5B-Instruct
MODEL_NAME = os.environ.get("AI_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")

# Lazy global model and tokenizer caching
_tokenizer = None
_model = None

def get_model_and_tokenizer(model_name: str = MODEL_NAME):
    global _tokenizer, _model
    if _tokenizer is None or _model is None:
        _tokenizer = AutoTokenizer.from_pretrained(model_name)
        _model = AutoModelForCausalLM.from_pretrained(model_name)
    return _tokenizer, _model

def build_calendar_context(ref_dt: datetime) -> str:
    """Provides upcoming day/date mappings so the LLM doesn't have to guess relative dates."""
    today_str = ref_dt.strftime("%Y-%m-%d (%A)")
    tomorrow_str = (ref_dt + timedelta(days=1)).strftime("%Y-%m-%d (%A)")
    in_two_days_str = (ref_dt + timedelta(days=2)).strftime("%Y-%m-%d (%A)")
    in_three_days_str = (ref_dt + timedelta(days=3)).strftime("%Y-%m-%d (%A)")
    weekdays = ", ".join(
        [(ref_dt + timedelta(days=i)).strftime("%A=%Y-%m-%d") for i in range(1, 8)]
    )
    return (
        f"Reference date (today): {today_str}\n"
        f"Tomorrow (+1 day): {tomorrow_str}\n"
        f"In two days / pasado mañana / d'aquí dos dies (+2 days): {in_two_days_str}\n"
        f"In three days (+3 days): {in_three_days_str}\n"
        f"Upcoming weekdays: {weekdays}"
    )

def extract_json_from_response(raw_resp: str) -> dict:
    """Extracts JSON object from model generation output, handling markdown or surrounding text."""
    trimmed = raw_resp.strip()
    match = re.search(r"\{.*\}", trimmed, re.DOTALL)
    if match:
        json_str = match.group(0)
    else:
        json_str = trimmed
    return json.loads(json_str)

def normalize_parsed_task(parsed: dict, raw_text: str, model_name: str, ref_dt: datetime = None) -> dict:
    """Ensures the extracted dictionary adheres strictly to Fenced's AiParsedTaskSchema."""
    # 1. Title
    title = str(parsed.get("title", "")).strip()
    if not title:
        title = raw_text.strip()

    # 2. Priority
    valid_priorities = {"urgent", "high", "medium", "low", "none"}
    p_raw = str(parsed.get("priority", "none")).lower().strip()
    if p_raw in valid_priorities:
        priority = p_raw
    elif p_raw.startswith("urg"):
        priority = "urgent"
    elif p_raw.startswith("hi"):
        priority = "high"
    elif p_raw.startswith("med"):
        priority = "medium"
    elif p_raw.startswith("low"):
        priority = "low"
    else:
        priority = "none"

    # 3. Tags
    raw_tags = parsed.get("tags") or []
    tags = []
    if isinstance(raw_tags, list):
        for t in raw_tags:
            tag_str = str(t).strip().lstrip("#")
            if tag_str and tag_str not in tags:
                tags.append(tag_str)

    # 4. DueAt
    due_at = parsed.get("dueAt")
    if due_at:
        try:
            # Validate ISO format
            datetime.fromisoformat(str(due_at).replace("Z", "+00:00"))
            due_at = str(due_at)
        except Exception:
            due_at = None
    else:
        due_at = None

    # Temporal phrase alignment with ref_dt to prevent LLM off-by-one errors or missed dates
    if ref_dt:
        m_in_days = re.search(
            r"\b(?:in|en|dentro\s+de|de\s+aquí|d['’]aquí(?:\s+a)?)\s+(\d+|one|un|uno|una|two|dos|three|tres|four|cuatro|quatre|five|cinco|cinc)\s+(?:days|días|dias|dies)\b",
            raw_text,
            re.I,
        )
        m_pasado = re.search(
            r"\b(pasado\s+mañana|pasado\s+manana|demà\s+passat|dema\s+passat)\b",
            raw_text,
            re.I,
        )
        m_tomorrow = re.search(
            r"\b(tomorrow|demà|dema|mañana|manana)\b",
            raw_text,
            re.I,
        )

        target_date = None
        matched_str = None

        if m_in_days:
            num_map = {
                "one": 1, "un": 1, "uno": 1, "una": 1,
                "two": 2, "dos": 2,
                "three": 3, "tres": 3,
                "four": 4, "cuatro": 4, "quatre": 4,
                "five": 5, "cinco": 5, "cinc": 5,
            }
            raw_n = m_in_days.group(1).lower()
            days_n = num_map.get(raw_n) or (int(raw_n) if raw_n.isdigit() else 2)
            target_date = ref_dt.date() + timedelta(days=days_n)
            matched_str = m_in_days.group(0)
        elif m_pasado:
            target_date = ref_dt.date() + timedelta(days=2)
            matched_str = m_pasado.group(0)
        elif m_tomorrow:
            target_date = ref_dt.date() + timedelta(days=1)
            matched_str = m_tomorrow.group(0)

        if target_date:
            target_h = 9
            target_m = 0
            if due_at:
                try:
                    parsed_iso = datetime.fromisoformat(due_at.replace("Z", "+00:00"))
                    target_h = parsed_iso.hour
                    target_m = parsed_iso.minute
                except Exception:
                    pass
            dt_aligned = datetime(
                target_date.year, target_date.month, target_date.day, target_h, target_m, tzinfo=timezone.utc
            )
            due_at = dt_aligned.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            if matched_str:
                title = re.sub(re.escape(matched_str), "", title, flags=re.I).strip()
                title = re.sub(r"\s+", " ", title).strip()
                if not title:
                    title = re.sub(re.escape(matched_str), "", raw_text, flags=re.I).strip()

    # 5. EstimateMinutes
    estimate_minutes = parsed.get("estimateMinutes")
    if estimate_minutes is not None:
        try:
            estimate_minutes = int(estimate_minutes)
            if estimate_minutes <= 0:
                estimate_minutes = None
        except (ValueError, TypeError):
            estimate_minutes = None

    # 6. Recurrence & rrule
    rrule = parsed.get("rrule") or None
    recurrence = parsed.get("recurrence")
    if isinstance(recurrence, dict) and recurrence.get("rrule"):
        if not rrule:
            rrule = recurrence.get("rrule")
    else:
        recurrence = None

    # 7. Ambiguities
    ambiguities = parsed.get("ambiguities")
    if not isinstance(ambiguities, list):
        ambiguities = []

    is_ambiguous = bool(parsed.get("isAmbiguous") or len(ambiguities) > 0)

    return {
        "title": title,
        "dueAt": due_at,
        "estimateMinutes": estimate_minutes,
        "priority": priority,
        "tags": tags,
        "rrule": rrule,
        "recurrence": recurrence,
        "ambiguities": ambiguities,
        "isAmbiguous": is_ambiguous,
        "_hf": {
            "model": model_name,
        },
    }

def parse_task_with_hf(raw_text: str, reference_date: str = None, model_name: str = MODEL_NAME) -> dict:
    """
    Parses a multilingual task description using a local Hugging Face instruction LLM.
    Replaces regex rules with in-context instruction generation returning Fenced's AiParsedTaskSchema.
    """
    text = raw_text.strip()
    if not text:
        return {
            "title": "",
            "dueAt": None,
            "estimateMinutes": None,
            "priority": "none",
            "tags": [],
            "rrule": None,
            "recurrence": None,
            "ambiguities": [],
            "isAmbiguous": False,
            "_hf": {"model": model_name},
        }

    ref_dt = (
        datetime.fromisoformat(reference_date.replace("Z", "+00:00"))
        if reference_date
        else datetime.now(timezone.utc)
    )

    tokenizer, model = get_model_and_tokenizer(model_name)
    calendar_context = build_calendar_context(ref_dt)

    system_prompt = (
        "You are an expert multilingual task parsing assistant for the Fenced productivity app.\n"
        "Your task is to parse user task input into a clean JSON object adhering to:\n"
        "- title: string (clean task title in the original language, without date, time, duration, tags, or priority)\n"
        "- dueAt: ISO 8601 string (e.g. YYYY-MM-DDTHH:MM:SS.000Z) or null. Use the provided calendar context to resolve 'demà', 'tomorrow', 'mañana', 'in two days' / 'in X days', 'dentro de dos días', 'pasado mañana', or weekday names to their exact date. Default to 09:00:00.000Z if no explicit hour is given.\n"
        "- estimateMinutes: integer or null (duration e.g. 30m -> 30, 1h -> 60)\n"
        "- priority: exactly one of ['urgent', 'high', 'medium', 'low', 'none']\n"
        "- tags: list of strings (remove #)\n"
        "- rrule: string or null (RFC 5545 format if recurring, e.g. FREQ=WEEKLY;BYDAY=MO)\n"
        "- recurrence: object or null { rrule: string, freq: string, interval: number, byDay: string[], byMonthDay: number[], until: string|null, count: number|null }\n"
        "- ambiguities: list of objects { kind: string, text: string, message: string, options?: string[] }\n"
        "- isAmbiguous: boolean\n\n"
        "Return ONLY the valid JSON object."
    )

    few_shots = [
        {
            "role": "user",
            "content": f"{calendar_context}\nTask text: \"exam in two days\"",
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "title": "exam",
                "dueAt": (ref_dt + timedelta(days=2)).strftime("%Y-%m-%dT09:00:00.000Z"),
                "estimateMinutes": None,
                "priority": "none",
                "tags": [],
                "rrule": None,
                "recurrence": None,
                "ambiguities": [],
                "isAmbiguous": False,
            }),
        },
        {
            "role": "user",
            "content": f"{calendar_context}\nTask text: \"Comprar bitllets de tren demà a les 18h !high #viatge\"",
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "title": "Comprar bitllets de tren",
                "dueAt": (ref_dt + timedelta(days=1)).strftime("%Y-%m-%dT18:00:00.000Z"),
                "estimateMinutes": None,
                "priority": "high",
                "tags": ["viatge"],
                "rrule": None,
                "recurrence": None,
                "ambiguities": [],
                "isAmbiguous": False,
            }),
        },
        {
            "role": "user",
            "content": f"{calendar_context}\nTask text: \"classe anglès cada dilluns a les 17h 1h #idiomes\"",
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "title": "classe anglès",
                "dueAt": (ref_dt + timedelta(days=(0 - ref_dt.weekday() + 7) % 7 or 7)).strftime("%Y-%m-%dT17:00:00.000Z"),
                "estimateMinutes": 60,
                "priority": "none",
                "tags": ["idiomes"],
                "rrule": "FREQ=WEEKLY;BYDAY=MO",
                "recurrence": {
                    "rrule": "FREQ=WEEKLY;BYDAY=MO",
                    "freq": "WEEKLY",
                    "interval": 1,
                    "byDay": ["MO"],
                    "byMonthDay": [],
                    "until": None,
                    "count": None,
                },
                "ambiguities": [],
                "isAmbiguous": False,
            }),
        },
    ]

    user_prompt = f"{calendar_context}\nTask text: \"{text}\""
    messages = [{"role": "system", "content": system_prompt}] + few_shots + [{"role": "user", "content": user_prompt}]

    prompt_text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([prompt_text], return_tensors="pt")

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=300,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated_tokens = outputs[0][len(inputs.input_ids[0]):]
    response_str = tokenizer.decode(generated_tokens, skip_special_tokens=True)

    try:
        raw_parsed = extract_json_from_response(response_str)
    except Exception as e:
        # Fallback if generation failed to produce valid JSON
        raw_parsed = {
            "title": text,
            "dueAt": None,
            "estimateMinutes": None,
            "priority": "none",
            "tags": [],
            "rrule": None,
            "recurrence": None,
            "ambiguities": [],
            "isAmbiguous": False,
        }

    return normalize_parsed_task(raw_parsed, text, model_name, ref_dt)

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

    # Default standalone demo
    print("\n--- Demostració de Parseig amb Hugging Face LLM ---")
    demo_task = "Preparar documentació del projecte demà a les 10h !urgent #feina 30m"
    result = parse_task_with_hf(demo_task)
    print(f"Task: {demo_task}")
    print("Resultat estructurat:")
    print(json.dumps(result, indent=2))

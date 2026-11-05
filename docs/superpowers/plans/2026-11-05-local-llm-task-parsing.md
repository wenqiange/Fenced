# Local Hugging Face LLM Task Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the task wording parsing in `scripts/use_model.py` to use a local Hugging Face instruction LLM (`Qwen/Qwen2.5-0.5B-Instruct`) instead of static regex rules.

**Architecture:** Use Hugging Face `transformers` (`AutoTokenizer` and `AutoModelForCausalLM`) with a structured chat template prompting the local model to parse multilingual task descriptions directly into Fenced's `AiParsedTaskSchema` JSON. Fallback to lightweight JSON cleanup if needed, eliminating hardcoded regex extraction for dates, times, durations, recurrence, and priorities.

**Tech Stack:** Python 3, PyTorch, Hugging Face Transformers (`Qwen/Qwen2.5-0.5B-Instruct`), Node.js / TypeScript, `@fenced/ai` Zod schemas, Node test runner (`tsx --test`).

**Spec:** User request to replace regex rules with local Hugging Face LLM for task wording parsing; `packages/ai/src/schemas/parsed-task.ts`.

## Global Constraints

- Must run completely offline using the locally downloaded Hugging Face weights in `~/.cache/huggingface/hub/`.
- Must return JSON strictly adhering to `AiParsedTaskSchema` (`title`, `dueAt`, `estimateMinutes`, `priority`, `tags`, `rrule`, `recurrence`, `ambiguities`, `isAmbiguous`).
- Must maintain compatibility with `apps/api/src/ai-huggingface.ts` (`python3 scripts/use_model.py --json '<payload>'`).
- Must pass `apps/api/src/__tests__/huggingface-parser.test.ts`.

## Review Focus

- Multilingual relative dates (Catalan "demà a les 10h", Spanish "mañana a las 18h", English "tomorrow at 4pm") must calculate correct ISO `dueAt` relative to `referenceDate`.
- Priority tags and words (!urgent, !high, or natural urgency) must correctly map to standard `Priority` enum (`urgent`, `high`, `medium`, `low`, `none`).
- Tags (#tag) must be extracted into `tags: string[]` and removed from `title`.
- Recurrence (daily, weekly, monthly) must map to RRULE and recurrence object without regexes.
- Malformed or noisy generation output must be reliably parsed as valid JSON or gracefully recovered.

---

### Task 1: Rewrite `scripts/use_model.py` to use Hugging Face LLM

**Files:**
- Modify: `scripts/use_model.py`
- Test: `scripts/use_model.py` (via CLI execution and unit testing)

- [ ] **Step 1: Write integration tests for LLM task parsing in Python**
  Create a test script or command verifying `parse_task_with_hf` extracts title, date, priority, tags, duration, and recurrence using `Qwen/Qwen2.5-0.5B-Instruct` without regex rules.
- [ ] **Step 2: Update `scripts/use_model.py` with LLM prompt and inference pipeline**
  Implement `AutoTokenizer` and `AutoModelForCausalLM` loading `Qwen/Qwen2.5-0.5B-Instruct`. Build system prompt and few-shot examples for strict JSON generation.
- [ ] **Step 3: Run standalone tests on `scripts/use_model.py`**
  Verify `python3 scripts/use_model.py --json '{"rawText": "Preparar documentació del projecte demà a les 10h !urgent #feina 30m", "referenceDate": "2026-11-05T12:00:00.000Z"}'` outputs clean JSON matching the schema.
- [ ] **Step 4: Commit changes to `scripts/use_model.py`**
  `git commit -m "feat(ai): rewrite task parsing to use local Hugging Face LLM"`

### Task 2: Validate Backend Integration & Test Suite

**Files:**
- Modify: `apps/api/src/__tests__/huggingface-parser.test.ts`
- Modify: `apps/api/src/ai-huggingface.ts`
- Test: `apps/api/src/__tests__/huggingface-parser.test.ts`

- [ ] **Step 1: Review and update `apps/api/src/__tests__/huggingface-parser.test.ts`**
  Add assertions verifying that metadata reflects the instruction LLM and test both single task parsing and runtime integration.
- [ ] **Step 2: Execute API test suite**
  Run `pnpm --filter @fenced/api test` and verify that all tests in `huggingface-parser.test.ts` pass cleanly.
- [ ] **Step 3: Commit test updates**
  `git commit -m "test(api): verify local Hugging Face LLM parser integration"`

### Task 3: Update Documentation & Configuration

**Files:**
- Modify: `setup/local_llm_integration.md`
- Modify: `.env.example`

- [ ] **Step 1: Update `setup/local_llm_integration.md`**
  Document the switch from regexes with DistilBERT to `Qwen/Qwen2.5-0.5B-Instruct` (or other HF causal LLMs), describing prompt engineering, JSON generation, and environment variables.
- [ ] **Step 2: Update `.env.example`**
  Set `AI_MODEL=Qwen/Qwen2.5-0.5B-Instruct` as the default Hugging Face local model.
- [ ] **Step 3: Commit documentation updates**
  `git commit -m "docs: update local Hugging Face LLM integration guide"`

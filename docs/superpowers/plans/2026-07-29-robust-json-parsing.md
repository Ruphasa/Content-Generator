# Robust JSON Parsing for AI Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance JSON response parsing in `src/lib/ai/director.ts` using Regex extraction to prevent `JSON.parse` failures when LLM responses contain conversational prefix/suffix text outside markdown codeblocks.

**Architecture:** Replace naive string replacements (`.replace(/```json/g, '')`) with a Regex pattern `text.match(/\{[\s\S]*\}/)` that extracts the outermost JSON object substring prior to `JSON.parse()`.

**Tech Stack:** TypeScript, Next.js, Node.js Regex.

## Global Constraints

- Never break existing signature or return type of `generateDirectorPlan(input)`.
- Fallback object must remain active on any failure.
- Strictly adhere to TypeScript strict mode.

---

### Task 1: Refactor JSON Extraction in `src/lib/ai/director.ts`

**Files:**
- Modify: `src/lib/ai/director.ts:40-52`

**Interfaces:**
- Consumes: `text` from `generateText` LLM call
- Produces: Robust `DirectorPlanResult` JSON object parsing

- [ ] **Step 1: Update JSON extraction logic in `src/lib/ai/director.ts`**

In `src/lib/ai/director.ts`:

```typescript
    const match = text.match(/\{[\s\S]*\}/);
    const jsonString = match ? match[0] : text;
    const parsed = JSON.parse(jsonString);
```

- [ ] **Step 2: Run build test to verify compilation**

Run: `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add src/lib/ai/director.ts
git commit -m "fix: use regex extraction for robust AI Director JSON parsing"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-29-robust-json-parsing.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch fresh subagent per task with review checkpoints.
2. **Inline Execution** - Execute tasks in this session using `executing-plans`.

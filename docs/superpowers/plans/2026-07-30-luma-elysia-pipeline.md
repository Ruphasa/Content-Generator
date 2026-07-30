# Luma & Elysia Video Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated API-driven video generation pipeline with separate FE (Next.js) and BE (ElysiaJS), replacing local scrapers.

**Architecture:** 
- FE: `Content-Generator-FE` (Next.js)
- BE: `Content-Generator-BE` (Bun, ElysiaJS, Drizzle, PostgreSQL in Docker, FFmpeg in Docker)
- Audio: Google Cloud TTS & Lyria (MusicFX) with BGM caching
- Video: Luma API Pro Tier

**Tech Stack:** Next.js, Bun, ElysiaJS, Drizzle ORM, PostgreSQL, Docker, FFmpeg.

## Global Constraints
- FE code MUST be inside the `Content-Generator-FE` directory.
- BE code MUST be inside the `Content-Generator-BE` directory.
- BE uses Bun + ElysiaJS.
- Database is PostgreSQL hosted in Docker.
- FFmpeg runs in a Docker container to limit resources.
- Music files (BGM) must be cached and tagged in DB to prevent duplicate generation.

---

### Task 1: Scaffold Backend Project

**Files:**
- Create: `Content-Generator-BE/package.json`
- Create: `Content-Generator-BE/src/index.ts`
- Create: `Content-Generator-BE/tests/index.test.ts`

**Interfaces:**
- Consumes: Nothing.
- Produces: `app` (Elysia instance running on port 3000).

- [ ] **Step 1: Write the failing test**
```typescript
// Content-Generator-BE/tests/index.test.ts
import { describe, expect, it } from "bun:test";
import { app } from "../src/index";

describe("Elysia App", () => {
  it("returns hello message", async () => {
    const response = await app.handle(new Request("http://localhost:3000/")).then(res => res.text());
    expect(response).toBe("Elysia Video BE");
  });
});
```

- [ ] **Step 2: Initialize project and verify test fails**
```bash
mkdir Content-Generator-BE
cd Content-Generator-BE
bun init -y
bun add elysia
bun add -d bun-types
bun test tests/index.test.ts
```
Expected: FAIL (app is not defined)

- [ ] **Step 3: Write minimal implementation**
```typescript
// Content-Generator-BE/src/index.ts
import { Elysia } from "elysia";

export const app = new Elysia()
  .get("/", () => "Elysia Video BE")
  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
```

- [ ] **Step 4: Verify test passes**
```bash
cd Content-Generator-BE
bun test tests/index.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add Content-Generator-BE/
git commit -m "feat(be): scaffold Elysia backend"
```

---

### Task 2: Scaffold Docker & Database

**Files:**
- Create: `Content-Generator-BE/docker-compose.yml`
- Create: `Content-Generator-BE/drizzle.config.ts`
- Create: `Content-Generator-BE/src/db/schema.ts`
- Create: `Content-Generator-BE/src/db/index.ts`

**Interfaces:**
- Consumes: Environment variables (`DATABASE_URL`).
- Produces: `db` (Drizzle client instance), `videos` and `bgmCache` schemas.

- [ ] **Step 1: Write docker-compose.yml**
```yaml
# Content-Generator-BE/docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: content_gen
    ports:
      - "5432:5432"
  ffmpeg:
    image: jrottenberg/ffmpeg:4.4-alpine
    entrypoint: ["tail", "-f", "/dev/null"]
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

- [ ] **Step 2: Scaffold Schema and DB Connection**
```typescript
// Content-Generator-BE/src/db/schema.ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  status: text('status').notNull().default('pending'),
  videoUrl: text('video_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bgmCache = pgTable('bgm_cache', {
  id: serial('id').primaryKey(),
  tags: text('tags').notNull(),
  filePath: text('file_path').notNull(),
});
```

```typescript
// Content-Generator-BE/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/content_gen');
export const db = drizzle(client, { schema });
```

```typescript
// Content-Generator-BE/drizzle.config.ts
import type { Config } from "drizzle-kit";
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/content_gen',
  }
} satisfies Config;
```

- [ ] **Step 3: Install dependencies and generate schema**
```bash
cd Content-Generator-BE
bun add drizzle-orm postgres
bun add -d drizzle-kit
bunx drizzle-kit generate
```

- [ ] **Step 4: Start DB and run migrations**
```bash
cd Content-Generator-BE
docker-compose up -d postgres
bunx drizzle-kit push
```

- [ ] **Step 5: Commit**
```bash
git add Content-Generator-BE/
git commit -m "feat(be): add docker-compose and drizzle schema"
```

---

### Task 3: Audio & BGM Service (Caching)

**Files:**
- Create: `Content-Generator-BE/src/services/audio.ts`
- Create: `Content-Generator-BE/tests/audio.test.ts`

**Interfaces:**
- Consumes: `db`, `bgmCache`
- Produces: `getBGM(tags: string): Promise<string>`

- [ ] **Step 1: Write the failing test**
```typescript
// Content-Generator-BE/tests/audio.test.ts
import { describe, expect, it } from "bun:test";
import { getBGM } from "../src/services/audio";
import { db } from "../src/db";
import { bgmCache } from "../src/db/schema";

describe("Audio Service", () => {
  it("should return cached BGM if tag exists", async () => {
    await db.insert(bgmCache).values({ tags: "happy,pop", filePath: "/tmp/cached.mp3" });
    const path = await getBGM("happy,pop");
    expect(path).toBe("/tmp/cached.mp3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
```bash
cd Content-Generator-BE
bun test tests/audio.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
```typescript
// Content-Generator-BE/src/services/audio.ts
import { db } from "../db";
import { bgmCache } from "../db/schema";
import { eq } from "drizzle-orm";

export async function getBGM(tags: string): Promise<string> {
  const cached = await db.select().from(bgmCache).where(eq(bgmCache.tags, tags)).limit(1);
  if (cached.length > 0) {
    return cached[0].filePath;
  }
  
  const newPath = `/tmp/lyria_${Date.now()}.mp3`;
  await db.insert(bgmCache).values({ tags, filePath: newPath });
  return newPath;
}
```

- [ ] **Step 4: Run test to verify it passes**
```bash
cd Content-Generator-BE
bun test tests/audio.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add Content-Generator-BE/
git commit -m "feat(be): implement BGM caching service"
```

---

### Task 4: Scaffold Frontend Project

**Files:**
- Create: `Content-Generator-FE/package.json`
- Modify: `Content-Generator-FE/src/app/page.tsx`

**Interfaces:**
- Consumes: `http://localhost:3000/` (Backend API).
- Produces: Next.js FE app on port 3001.

- [ ] **Step 1: Scaffolding Next.js App**
```bash
npx create-next-app@latest Content-Generator-FE --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun
```

- [ ] **Step 2: Modify Home Page**
```tsx
// Content-Generator-FE/src/app/page.tsx
export default function Home() {
  return (
    <main className="p-24">
      <h1>Video Pipeline UI</h1>
    </main>
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add Content-Generator-FE/
git commit -m "feat(fe): scaffold Next.js frontend"
```

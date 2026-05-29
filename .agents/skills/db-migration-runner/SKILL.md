# Skill: DB Migration Runner (Prisma Migrate)

## What This Skill Covers

This skill defines how to create, run, and manage database migrations and schema synchronization for FoodSabi using **Prisma ORM**. It covers the Prisma schema configuration, defining the sessions, messages, and caching tables, running migrations in development and production, and database rollback safety. Read this before modifying any database model or running migrations.

---

## FoodSabi Data Layer Overview

FoodSabi utilizes a PostgreSQL database managed via Prisma. We have three main models defined:

1. **Session (`Session` model)** — Holds conversation history per anonymous UUID session ID. Scoped to the session, contains zero PII, and supports TTL-based expiration.
2. **Message (`Message` model)** — Stores user inputs (text, paste, or image OCR text) and assistant structured JSON responses. Scoped to a Session via foreign keys.
3. **Ingredient Cache (`IngredientCache` model)** — Stores serialized ingredient responses keyed by a normalized ingredient term to minimize slow and expensive DeepSeek API calls.

To maintain professional database conventions, all tables and columns are stored in PostgreSQL using **snake_case** but are exposed to the TypeScript codebase as **camelCase** using Prisma `@map` and `@@map` annotations.

---

## The Source of Truth: `prisma/schema.prisma`

All models must be strictly defined in `prisma/schema.prisma`. Any changes to the database structure must start by modifying this file.

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Session {
  id           String    @id @default(cuid())
  sessionId    String    @unique @map("session_id")
  createdAt    DateTime  @default(now()) @map("created_at")
  lastActiveAt DateTime  @updatedAt @map("last_active_at")
  // Optional TTL expiry. A scheduled cleanup job (e.g., Vercel Cron) should
  // delete sessions WHERE expiresAt < now() to reclaim storage. The field is
  // nullable — if null the session never expires.
  expiresAt    DateTime? @map("expires_at")
  status       String    @default("active") @map("status") // "active" | "ended"
  messages     Message[]

  @@map("sessions")
  @@index([status], name: "idx_sessions_status")
  @@index([lastActiveAt], name: "idx_sessions_last_active")
  @@index([expiresAt], name: "idx_sessions_expires")
}

model Message {
  id        String   @id @default(cuid())
  sessionId String   @map("session_id")
  role      String   @map("role") // "user" | "assistant"
  inputType String   @map("input_type") // "text" | "paste" | "image"
  content   String   @map("content")
  imageUrl  String?  @map("image_url")
  createdAt DateTime @default(now()) @map("created_at")
  // References the business-key sessionId (UUID) rather than the internal id (cuid).
  // All app routes pass the UUID sessionId — using it as the FK avoids an extra
  // lookup query. Session.sessionId is @unique, so referential integrity holds.
  session   Session  @relation(fields: [sessionId], references: [sessionId], onDelete: Cascade)

  @@map("messages")
  @@index([sessionId], name: "idx_messages_session")
  @@index([createdAt], name: "idx_messages_created")
}

model IngredientCache {
  id           String   @id @default(cuid())
  cacheKey     String   @unique @map("cache_key") // Lowercase normalized ingredient name
  responseText String   @map("response_text") // Serialized JSON response (IngredientResponse)
  hitCount     Int      @default(0) @map("hit_count")
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("ingredient_caches")
  @@index([cacheKey], name: "idx_cache_key")
}
```

---

## Prisma Client Singleton (`lib/db.ts`)

The Prisma client must be instantiated once and reused across the app. Create `lib/db.ts` with the standard hot-reload-safe pattern:

```typescript
// lib/db.ts

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
```

All modules import the singleton via `import { prisma } from "@/lib/db"`. Never instantiate `new PrismaClient()` elsewhere.

---

## Required CLI Migration Commands

Developers must use the Prisma CLI rather than raw SQL files or custom scripts.

### 1. Generating the Prisma Client (First Setup)

When you clone the repo for the first time, generate the typed client:

```bash
# Installs Prisma Client in node_modules/.prisma/client
npx prisma generate
```

Run this after every `npm install` or schema change that modifies models.

### 2. Generating Migrations in Development

When you modify `schema.prisma`, run this command to generate and apply a SQL migration locally:

```bash
# Formats schema.prisma, generates sql files, and applies migrations locally
npx prisma migrate dev --name <migration_name>
```

Prisma will:
- Compare your current database schema with your `schema.prisma` file.
- Generate a transaction-safe SQL file under `prisma/migrations/<timestamp>_<migration_name>/migration.sql`.
- Run the SQL on your local database.
- Auto-generate the typed Prisma Client inside `node_modules/.prisma`.

### 3. Checking Migration State

To see which migrations have been applied and which are pending:

```bash
# Lists applied and pending migrations
npx prisma migrate status
```

### 4. Deploying Migrations in Production (CI/CD)

Never use `migrate dev` in production or staging. Instead, deploy pre-generated migrations using:

```bash
# Applies all pending migrations in a transaction-safe manner
npx prisma migrate deploy
```

This reads applied migrations from the `_prisma_migrations` tracking table and runs only pending migrations.

### 5. Rolling Back a Migration

Prisma Migrate does not support automatic rollbacks. If a deployed migration causes issues:

1. **Fix forward**: Modify `schema.prisma` to correct the problem and create a new migration.
2. **If the broken migration hasn't been deployed to production yet**, you can reset your local DB:
   ```bash
   npx prisma migrate reset     # Drops DB, re-applies all migrations
   ```
3. **If the migration has been deployed to production**, use `resolve` to mark it as rolled back, then manually revert the SQL:
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

### 6. Schema Prototyping (Local / Temporary Test)

If you are prototyping and want to sync the database without generating migration files, use:

```bash
# Syncs schema to DB immediately, losing all data in modified tables if column changes occur
npx prisma db push
```

### 7. Viewing the Database GUI

To browse tables, records, and run quick test queries locally:

```bash
# Launches a local visual database viewer at http://localhost:5555
npx prisma studio
```

### 8. Database Seeding (Optional)

If test data is needed, create `prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Add sample sessions or cache entries for development
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Then add to `package.json`: `"prisma": { "seed": "tsx prisma/seed.ts" }` and run:

```bash
npx prisma db seed
```

---

## Required Environment Variables

Add to `.env.local` (local) and your hosting provider (production):

```
DATABASE_URL=postgresql://user:password@host:5432/foodsabi
```

Provide a `.env.example` at the project root with this placeholder for onboarding.

---

## Migration & Data Safety Rules

- **Zero Custom SQL Runners:** Never write manual `.sql` runners or inject migrations using raw database clients. Let Prisma handle transactions and status tracking.
- **Never Modify Applied Migration SQL:** Once a migration has been committed to VCS and deployed, *never* edit its generated `migration.sql` file. If a change is needed, modify `schema.prisma` and run `prisma migrate dev` again to generate a new migration.
- **Zero PII Storage:** No user profiles, names, phone numbers, or emails can be added to any schema. Keep the session completely anonymous.
- **Idempotence & Safety:** Ensure new columns default to nullable or have safe defaults when adding fields to tables containing data. Use Prisma's native database client migrations to test compatibility.
- **Prisma Client Singleton:** Always import `prisma` from `@/lib/db`. Never instantiate `new PrismaClient()` elsewhere.

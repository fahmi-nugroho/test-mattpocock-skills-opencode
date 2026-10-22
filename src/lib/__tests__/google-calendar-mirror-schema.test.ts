import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "supabase", "migrations");

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

/** Strip line/block comments so negative assertions check SQL, not prose. */
function codeOnly(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function table(code: string, name: string): string {
  return code.match(new RegExp(`create table\\s+${name}\\b[\\s\\S]*?;`))?.[0] ?? "";
}

function fn(code: string, name: string): string {
  return (
    code.match(
      new RegExp(
        `create or replace function\\s+${name}[\\s\\S]*?\\$\\$;`,
      ),
    )?.[0] ?? ""
  );
}

// Seam 3 (declarative SQL verify): asserts the mirror persistence contract
// without a live database. Catches a cascading delete that would destroy the
// only pointer to a Google event, a missing one-event invariant, or an anon
// policy. Misses live Postgres/RLS semantics.
describe("0021 Google Calendar mirror contract (local SQL verify, no live DB)", () => {
  const sql = readMigration("0021_google_calendar_mirror.sql");
  const code = codeOnly(sql).toLowerCase();
  const events = table(code, "google_calendar_events");
  const queue = table(code, "google_calendar_work");
  const enqueue = fn(code, "enqueue_google_calendar_work");
  const claim = fn(code, "claim_google_calendar_work");

  it("tracks one Google event per Booking with its id and sync time", () => {
    expect(events).not.toBe("");
    expect(events).toMatch(/booking_id\s+uuid\s+primary key/);
    expect(events).toMatch(/google_event_id\s+text\s+not null/);
    expect(events).toMatch(
      /last_synced_at\s+timestamptz\s+not null\s+default\s+now\(\)/,
    );
    expect(events).toMatch(/updated_at\s+timestamptz\s+not null\s+default\s+now\(\)/);
  });

  it("stores one coalesced work intent per Booking with retry bookkeeping", () => {
    expect(queue).not.toBe("");
    expect(queue).toMatch(/booking_id\s+uuid\s+primary key/);
    expect(queue).toMatch(
      /operation\s+text\s+not null\s+check\s*\(\s*operation\s+in\s*\(\s*'upsert'\s*,\s*'delete'\s*\)\s*\)/,
    );
    expect(queue).toMatch(/attempt_count\s+integer\s+not null\s+default\s+0/);
    expect(queue).toMatch(/next_attempt_at\s+timestamptz\s+not null\s+default\s+now\(\)/);
    expect(queue).toMatch(/last_error\s+text\s+not null\s+default\s+''/);
    expect(queue).toMatch(/processed_at\s+timestamptz\b/);
    expect(queue).toMatch(/locked_at\s+timestamptz\b/);
  });

  it("keeps the one-event-per-Booking invariant in the table itself", () => {
    // booking_id is the primary key, so a second row is impossible even if a
    // raced drain tries to insert one.
    expect(events).toMatch(/booking_id\s+uuid\s+primary key/);
    expect(events).not.toMatch(/unique\s*\(\s*booking_id\s*,\s*google_event_id\s*\)/);
  });

  it("deliberately does not cascade with a hard-deleted Booking", () => {
    // A foreign key with ON DELETE CASCADE would delete the only pointer to
    // the Google event before it could be removed. A plain FK would block the
    // delete instead. Neither belongs here; the row must survive.
    for (const body of [events, queue]) {
      expect(body).not.toMatch(/references\s+bookings/);
      expect(body).not.toMatch(/on delete\s+cascade/);
      expect(body).not.toMatch(/on delete\s+set null/);
    }
  });

  it("is readable and writable by the authenticated admin only", () => {
    for (const name of ["google_calendar_events", "google_calendar_work"]) {
      expect(code).toMatch(
        new RegExp(`alter table\\s+${name}\\s+enable row level security`),
      );
      expect(code).toMatch(
        new RegExp(
          `create policy\\s+${name}_admin_all\\s+on\\s+${name}\\s+for all\\s+to authenticated\\s+using\\s*\\(\\s*true\\s*\\)\\s+with check\\s*\\(\\s*true\\s*\\)`,
        ),
      );
      expect(code).not.toMatch(
        new RegExp(`create policy[^;]*${name}[^;]*to anon`),
      );
    }
    expect(code).not.toMatch(/grant[^;]*to anon/);
  });

  it("coalesces repeated saves into the same pending intent", () => {
    expect(enqueue).not.toBe("");
    expect(enqueue).toMatch(/insert into\s+google_calendar_work/);
    expect(enqueue).toMatch(
      /on conflict\s*\(\s*booking_id\s*\)\s+do update/,
    );
    expect(enqueue).toMatch(/operation\s*=\s*excluded\.operation/);
    expect(enqueue).toMatch(/attempt_count\s*=\s*0/);
    expect(enqueue).toMatch(/last_error\s*=\s*''/);
    expect(enqueue).toMatch(/processed_at\s*=\s*null/);
    // A repeated save must not release a claim a drain is still holding, or a
    // second drain could create a duplicate event; a stale claim is released.
    expect(enqueue).toMatch(/locked_at\s*=\s*case/);
    expect(enqueue).toMatch(/google_calendar_work\.locked_at\s+is\s+not\s+null/);
    expect(enqueue).toMatch(/then\s+google_calendar_work\.locked_at/);
    expect(enqueue).toMatch(/else\s+null/);
  });

  it("claims one Booking at a time and lets a stale lock recover", () => {
    expect(claim).not.toBe("");
    expect(claim).toMatch(/update\s+google_calendar_work/);
    expect(claim).toMatch(/set\s+locked_at\s*=\s*now\(\)/);
    expect(claim).toMatch(/where\s+booking_id\s*=\s*p_booking_id/);
    expect(claim).toMatch(/processed_at\s+is\s+null/);
    expect(claim).toMatch(/locked_at\s+is\s+null\s+or\s+locked_at\s*</);
    expect(claim).toMatch(/returning\s+\*/);
  });

  it("exposes the two mirror functions to the admin only", () => {
    for (const signature of [
      "enqueue_google_calendar_work\\s*\\(\\s*uuid\\s*,\\s*text\\s*\\)",
      "claim_google_calendar_work\\s*\\(\\s*uuid\\s*\\)",
    ]) {
      expect(code).toMatch(
        new RegExp(`revoke all on function\\s+${signature}\\s+from public`),
      );
      expect(code).toMatch(
        new RegExp(`grant execute on function\\s+${signature}\\s+to authenticated`),
      );
    }
  });

  it("touches updated_at on both tables", () => {
    expect(code).toMatch(
      /create trigger\s+google_calendar_events_touch\s+before update on\s+google_calendar_events/,
    );
    expect(code).toMatch(
      /create trigger\s+google_calendar_work_touch\s+before update on\s+google_calendar_work/,
    );
  });
});

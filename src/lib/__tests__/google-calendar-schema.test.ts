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

// Seam 3 (declarative SQL verify): asserts the connection data contract without
// a live database. Catches a missing single-row shape, a lost default, or an
// accidental anon policy. Misses live Postgres/RLS semantics.
describe("0020 Google Calendar connection contract (local SQL verify, no live DB)", () => {
  const sql = readMigration("0020_google_calendar_connection.sql");
  const code = codeOnly(sql).toLowerCase();
  const table =
    code.match(/create table\s+google_calendar_connection\b[\s\S]*?;/)?.[0] ?? "";

  it("creates the single-row connection record with its health fields", () => {
    expect(table).not.toBe("");
    expect(table).toMatch(/id\s+integer\s+primary key\s+default\s+1/);
    expect(table).toMatch(/enabled\s+boolean\s+not null\s+default\s+false/);
    expect(table).toMatch(/calendar_id\s+text\s+not null\s+default\s+''/);
    expect(table).toMatch(/last_verified_at\s+timestamptz\b/);
    expect(table).toMatch(/last_error\s+text\s+not null\s+default\s+''/);
    expect(table).toMatch(/updated_at\s+timestamptz\s+not null\s+default\s+now\(\)/);
  });

  it("enforces the one-row shape in the table itself", () => {
    expect(table).toMatch(/check\s*\(\s*id\s*=\s*1\s*\)/);
  });

  it("seeds the row so the admin always reads a connection", () => {
    expect(code).toMatch(
      /insert into\s+google_calendar_connection\s*\(\s*id\s*\)\s*values\s*\(\s*1\s*\)/,
    );
  });

  it("is readable and writable by the authenticated admin only", () => {
    expect(code).toMatch(
      /alter table\s+google_calendar_connection\s+enable row level security/,
    );
    expect(code).toMatch(
      /create policy\s+google_calendar_connection_admin_all\s+on\s+google_calendar_connection\s+for all\s+to authenticated\s+using\s*\(\s*true\s*\)\s+with check\s*\(\s*true\s*\)/,
    );
    // No anonymous policy and no public grant: credentials stay server-side.
    expect(code).not.toMatch(/create policy[^;]*google_calendar_connection[^;]*to anon/);
    expect(code).not.toMatch(/grant[^;]*to anon/);
  });

  it("touches updated_at on every update", () => {
    expect(code).toMatch(
      /create trigger\s+google_calendar_connection_touch\s+before update on\s+google_calendar_connection\s+for each row\s+execute function\s+touch_google_calendar_connection\s*\(\s*\)/,
    );
  });
});

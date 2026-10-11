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

// Seam 3 (declarative SQL verify): asserts migration files contain the
// spec'd tables/columns/RLS/storage/RPC/seed. Catches missing backend
// pieces without a live DB. Misses live Postgres semantics.
describe("supabase migrations (local SQL verify, no live DB)", () => {
  it("0001 creates all five tables with spec columns", () => {
    const sql = readMigration("0001_schema.sql");
    for (const table of [
      "services",
      "portfolio_items",
      "bookings",
      "blocks",
      "settings",
    ]) {
      expect(sql).toMatch(new RegExp(`create table\\s+${table}\\b`, "i"));
    }
    // services spec columns
    for (const col of [
      "price_idr",
      "duration_min",
      "active",
      "cover_image_url",
    ]) {
      expect(sql).toContain(col);
    }
    // portfolio_items spec columns
    for (const col of ["category", "image_url", "visible"]) {
      expect(sql).toContain(col);
    }
    // bookings spec columns (date + HH:MM text, status lifecycle)
    for (const col of [
      "start_time",
      "end_time",
      "service_id",
      "client_name",
      "client_phone",
      "status",
    ]) {
      expect(sql).toContain(col);
    }
    expect(sql).toMatch(/pending[\s\S]*confirmed[\s\S]*cancelled/i);
    // blocks spec columns
    for (const col of ["all_day", "reason"]) {
      expect(sql).toContain(col);
    }
    // settings spec columns
    for (const col of ["wa_number", "open_hour", "close_hour", "full_dates"]) {
      expect(sql).toContain(col);
    }
  });

  it("0001 uses date + HH:MM text (not timestamptz) to stay compatible with computeDayStatus", () => {
    const sql = codeOnly(readMigration("0001_schema.sql")).toLowerCase();
    expect(sql).not.toContain("timestamptz");
    expect(sql).toMatch(/start_time\s+text/);
    expect(sql).toMatch(/end_time\s+text/);
  });

  it("0002 enables RLS with anon-safe reads and no client PII exposure", () => {
    const sql = readMigration("0002_rls.sql").toLowerCase();
    for (const table of [
      "services",
      "portfolio_items",
      "bookings",
      "blocks",
      "settings",
    ]) {
      expect(sql).toMatch(
        new RegExp(`alter table\\s+${table}\\s+enable row level security`, "i"),
      );
    }
    // anon may read active services / visible portfolio only
    expect(sql).toMatch(/active\s*=\s*true/);
    expect(sql).toMatch(/visible\s*=\s*true/);
    // bookings/blocks/settings must NOT grant anon select
    const anonSelects = sql.match(/create policy[^;]*for select[^;]*to anon[^;]*;/g) ?? [];
    for (const policy of anonSelects) {
      expect(policy).not.toContain("bookings");
      expect(policy).not.toContain("blocks");
      expect(policy).not.toContain("settings");
    }
    // authenticated role gets full CRUD (or at least all-operations policy)
    expect(sql).toContain("to authenticated");
  });

  it("0003 creates portfolio/prices buckets as public-read, authenticated-write", () => {
    const sql = readMigration("0003_storage.sql").toLowerCase();
    expect(sql).toContain("portfolio");
    expect(sql).toContain("prices");
    expect(sql).toMatch(/insert into storage\.buckets/);
    expect(sql).toMatch(/public.*true|public\s+is\s+true/);
    expect(sql).toContain("storage.objects");
    expect(sql).toContain("to anon");
    expect(sql).toContain("to authenticated");
  });

  it("0004 seeds settings row and defines day-status-only RPC", () => {
    const sql = readMigration("0004_seed_rpc.sql");
    const lower = sql.toLowerCase();
    expect(lower).toContain("wa_number");
    expect(lower).toContain("09:00");
    expect(lower).toContain("19:00");
    expect(lower).toMatch(/create or replace function get_month_availability/);
    // RPC returns date+status only — must not select client PII
    const code = codeOnly(sql).toLowerCase();
    expect(code).not.toContain("client_name");
    expect(code).not.toContain("client_phone");
    expect(code).not.toContain("notes");
    // RPC callable by anon (public calendar) with fixed search_path
    expect(lower).toContain("to anon");
    expect(lower).toMatch(/set\s+search_path/);
  });
});

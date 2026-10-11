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

  it("0005 exposes wa_number alone (no hours, dates, or PII)", () => {
    const sql = readMigration("0005_public_wa.sql");
    const lower = sql.toLowerCase();
    expect(lower).toMatch(/create or replace function get_public_wa_number/);
    expect(lower).toContain("wa_number");
    expect(lower).toContain("to anon");
    expect(lower).toMatch(/set\s+search_path/);
    const code = codeOnly(sql).toLowerCase();
    expect(code).not.toContain("open_hour");
    expect(code).not.toContain("close_hour");
    expect(code).not.toContain("full_dates");
    expect(code).not.toContain("client_name");
    expect(code).not.toContain("client_phone");
    expect(code).not.toContain("notes");
  });

  it("0001 enforces single-row settings (id = 1)", () => {
    const code = codeOnly(readMigration("0001_schema.sql")).toLowerCase();
    expect(code).toMatch(/check\s*\(\s*id\s*=\s*1\s*\)/);
  });

  it("0001 rejects invalid 24-29 hours in all HH:MM checks", () => {
    const code = codeOnly(readMigration("0001_schema.sql"));
    // No loose [0-2][0-9] hour class may remain in any CHECK.
    expect(code).not.toMatch(/\[0-2\]\[0-9\]/);
    // Every HH:MM check uses the strict 00-23 hour class.
    const checks = code.match(/~\s*'[^']*'/g) ?? [];
    expect(checks.length).toBeGreaterThan(0);
    for (const check of checks) {
      expect(check).toContain("([01][0-9]|2[0-3])");
    }
  });

  it("0001 requires NULL times when all_day, valid range otherwise", () => {
    const code = codeOnly(readMigration("0001_schema.sql")).toLowerCase();
    const blocks = code.match(/create table\s+blocks[\s\S]*?;/);
    expect(blocks).not.toBeNull();
    const body = blocks![0];
    // all_day=true must force start/end NULL (no valid-time bypass).
    expect(body).toMatch(/all_day[\s\S]*start_time\s+is\s+null/);
    expect(body).toMatch(/all_day[\s\S]*end_time\s+is\s+null/);
    // all_day=false still requires a valid non-null range.
    expect(body).toMatch(/not\s+all_day[\s\S]*start_time\s+is\s+not\s+null/);
  });

  it("0003 lets the admin role read buckets (not anon-only)", () => {
    const code = codeOnly(readMigration("0003_storage.sql")).toLowerCase();
    const select = code.match(/for select[^;]*;/g) ?? [];
    expect(select.length).toBeGreaterThan(0);
    for (const policy of select) {
      expect(policy).toContain("authenticated");
    }
  });

  it("0004 keeps hhmm_to_min internal (no anon grant)", () => {
    const code = codeOnly(readMigration("0004_seed_rpc.sql")).toLowerCase();
    const grants = code.match(/grant execute on function hhmm_to_min[^;]*;/g) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) {
      expect(grant).not.toContain("anon");
    }
    // The public RPC itself stays anon-callable.
    expect(code).toMatch(
      /grant execute on function get_month_availability[^;]*to anon/,
    );
  });

  it("0004 header documents past-greying, confirmed-only, full-toggle scope", () => {
    const sql = readMigration("0004_seed_rpc.sql").toLowerCase();
    // Past-date greying is a UI concern (ticket 04), RPC shape unchanged.
    expect(sql).toMatch(/past[^.\n]*ui|ui[^.\n]*past|grey/);
    // confirmed-only occupancy is intentional (pending/cancelled don't occupy).
    expect(sql).toMatch(/pending\/cancelled|pending.*cancelled/);
    // full_dates maps to blocked (manual full-toggle coverage).
    expect(sql).toMatch(/full_dates[\s\S]{0,120}blocked/);
  });

  it("0007 defines day-schedule RPC returning status + closure only (no PII/hours)", () => {
    const sql = readMigration("0007_day_schedule.sql");
    const lower = sql.toLowerCase();
    expect(lower).toMatch(/create or replace function get_day_schedule/);
    // Output shape carries date + status + closure flag with
    // forward-compat occupied/free arrays (empty in v1).
    for (const key of [
      "all_day_blocked",
      "occupied",
      "free",
      "status",
    ]) {
      expect(lower).toContain(key);
    }
    // No client PII may be selected anywhere in the function body.
    const code = codeOnly(sql).toLowerCase();
    expect(code).not.toContain("client_name");
    expect(code).not.toContain("client_phone");
    expect(code).not.toContain("notes");
    expect(code).not.toContain("reason");
    // Hours stay internal (read into vars for status derivation) and
    // never appear in the returned object.
    expect(code).toMatch(/open_hour/);
    const returns = code.match(/json_build_object\([\s\S]*?\)/) ?? [];
    expect(returns.length).toBeGreaterThan(0);
    for (const ret of returns) {
      expect(ret).not.toContain("open_hour");
      expect(ret).not.toContain("close_hour");
    }
    // Public calendar callable by anon with fixed search_path.
    expect(lower).toContain("to anon");
    expect(lower).toMatch(/set\s+search_path/);
  });

  it("0008 fills occupied with booked/blocked times only (no PII/hours)", () => {
    const sql = readMigration("0008_day_schedule_occupied.sql");
    const lower = sql.toLowerCase();
    expect(lower).toMatch(/create or replace function get_day_schedule/);
    // Occupied kinds: confirmed bookings as booked, timed blocks as blocked.
    expect(lower).toContain("'booked'");
    expect(lower).toContain("'blocked'");
    expect(lower).toMatch(/status\s*=\s*'confirmed'/);
    // Timed blocks only (all-day closures collapse to the flag).
    expect(lower).toMatch(/not\s+\w*\.?all_day/);
    // No client PII may be selected anywhere in the function body.
    const code = codeOnly(sql).toLowerCase();
    expect(code).not.toContain("client_name");
    expect(code).not.toContain("client_phone");
    expect(code).not.toContain("notes");
    expect(code).not.toContain("reason");
    // Hours stay internal (clamping only), never in the returned object.
    const returns = code.match(/return json_build_object[\s\S]*?\);/) ?? [];
    expect(returns.length).toBeGreaterThan(0);
    for (const ret of returns) {
      expect(ret).not.toContain("open_hour");
      expect(ret).not.toContain("close_hour");
    }
    // Public calendar callable by anon with fixed search_path.
    expect(lower).toContain("to anon");
    expect(lower).toMatch(/set\s+search_path/);
  });

  it("0009 derives free gaps server-side with no hours in output", () => {
    const sql = readMigration("0009_day_schedule_free.sql");
    const lower = sql.toLowerCase();
    expect(lower).toMatch(/create or replace function get_day_schedule/);
    // Free gaps walk the clamped occupied timeline (cursor over sorted
    // intervals); all-day closures return empty gaps.
    expect(lower).toContain("v_free");
    expect(lower).toContain("v_cursor");
    // Occupied aggregation and gap walk share one chronological order.
    expect(lower.match(/order by c\.s, c\.kind/g)?.length).toBe(2);
    // Empty occupied days return empty gaps so the full window never
    // ships as endpoints (empty days render as Seharian tersedia).
    expect(lower).toMatch(/jsonb_array_length\(v_occupied\)\s*=\s*0/);
    // No client PII may be selected anywhere in the function body.
    const code = codeOnly(sql).toLowerCase();
    expect(code).not.toContain("client_name");
    expect(code).not.toContain("client_phone");
    expect(code).not.toContain("notes");
    expect(code).not.toContain("reason");
    // The returned object carries free gaps but no operating-hours values.
    const returns = code.match(/return json_build_object[\s\S]*?\);/) ?? [];
    expect(returns.length).toBeGreaterThan(0);
    for (const ret of returns) {
      expect(ret).toContain("'free'");
      expect(ret).not.toContain("open_hour");
      expect(ret).not.toContain("close_hour");
    }
    // Public calendar callable by anon with fixed search_path.
    expect(lower).toContain("to anon");
    expect(lower).toMatch(/set\s+search_path/);
  });

  it("0006 caps portfolio categories at six via trigger (client cap bypass-proof)", () => {
    const sql = readMigration("0006_portfolio_category_cap.sql");
    const lower = sql.toLowerCase();
    // Trigger fires on portfolio category writes.
    expect(lower).toMatch(/create trigger[^;]*on portfolio_items/);
    expect(lower).toMatch(/insert or update/);
    expect(lower).toContain("category");
    // Raises once distinct categories exceed six.
    expect(lower).toMatch(/distinct[^;]*category/);
    expect(lower).toMatch(/>\s*6/);
    expect(lower).toMatch(/raise exception/);
    // Same hardening as other backend functions: fixed search_path.
    expect(lower).toMatch(/set\s+search_path/);
  });
});

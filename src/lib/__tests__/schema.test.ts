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

  it("0010 returns raw unclamped occupied ranges, window-free, no PII/hours", () => {
    const sql = readMigration("0010_day_schedule_window_free.sql");
    const lower = sql.toLowerCase();
    expect(lower).toMatch(/create or replace function get_day_schedule/);
    // Occupied kinds: confirmed bookings as booked, timed blocks as blocked.
    expect(lower).toContain("'booked'");
    expect(lower).toContain("'blocked'");
    expect(lower).toMatch(/status\s*=\s*'confirmed'/);
    // Timed blocks only (all-day closures collapse to the flag).
    expect(lower).toMatch(/not\s+\w*\.?all_day/);
    // One chronological order shared by the occupied aggregation.
    expect(lower).toMatch(/order by c\.s, c\.kind/);
    // All-day closure outranks times and resolves to blocked.
    expect(lower).toMatch(/full_dates/);
    expect(lower).toMatch(/v_status\s*:=\s*'blocked'/);
    // Status is available otherwise: coverage derivation is removed, so
    // fully_booked is unreachable here.
    expect(lower).toMatch(/v_status\s*:=\s*'available'/);
    // The returned object carries occupied + free keys; free is always [].
    const returns = codeOnly(sql).match(/return json_build_object[\s\S]*?\);/) ?? [];
    expect(returns.length).toBeGreaterThan(0);
    for (const ret of returns) {
      expect(ret.toLowerCase()).toContain("'occupied'");
      expect(ret.toLowerCase()).toContain("'free'");
    }
    // Window-free: no hours reads, no clamp helpers, no coverage walk.
    const code = codeOnly(sql).toLowerCase();
    expect(code).not.toContain("open_hour");
    expect(code).not.toContain("close_hour");
    expect(code).not.toContain("hhmm_to_min");
    expect(code).not.toContain("generate_series");
    expect(code).not.toContain("greatest");
    expect(code).not.toContain("least");
    // No client PII may be selected anywhere in the function body.
    expect(code).not.toContain("client_name");
    expect(code).not.toContain("client_phone");
    expect(code).not.toContain("notes");
    expect(code).not.toContain("reason");
    // Public calendar callable by anon with fixed search_path.
    expect(lower).toContain("to anon");
    expect(lower).toMatch(/set\s+search_path/);
  });

  it("0011 redefines month RPC window-free: closed or available only, no PII/hours", () => {
    const sql = readMigration("0011_month_window_free.sql");
    const lower = sql.toLowerCase();
    expect(lower).toMatch(/create or replace function get_month_availability/);
    // Return shape unchanged: one (date, status) row per calendar date.
    expect(lower).toMatch(/returns table\s*\(\s*date date,\s*status text\s*\)/);
    // Reads ONLY full_dates from settings (like the 0010 day pattern).
    expect(lower).toMatch(/full_dates/);
    // Blocked for full-toggle or all-day blocks, available otherwise.
    expect(lower).toMatch(/v_status\s*:=\s*'blocked'/);
    expect(lower).toMatch(/v_status\s*:=\s*'available'/);
    // Window-free: no hours reads, no clamp helpers, no coverage walk.
    const code = codeOnly(sql).toLowerCase();
    expect(code).not.toContain("open_hour");
    expect(code).not.toContain("close_hour");
    expect(code).not.toContain("hhmm_to_min");
    expect(code).not.toContain("generate_series");
    expect(code).not.toContain("greatest");
    expect(code).not.toContain("least");
    // No client PII may be selected anywhere in the function body.
    expect(code).not.toContain("client_name");
    expect(code).not.toContain("client_phone");
    expect(code).not.toContain("notes");
    expect(code).not.toContain("reason");
    // Public calendar callable by anon with fixed search_path.
    expect(lower).toContain("to anon");
    expect(lower).toMatch(/set\s+search_path/);
  });

  it("0012 drops settings hours with a restore note and no other data loss", () => {
    const sql = readMigration("0012_settings_drop_hours.sql");
    const code = codeOnly(sql).toLowerCase();
    expect(code).toMatch(/alter table\s+settings\s+drop column\s+open_hour/);
    expect(code).toMatch(/alter table\s+settings\s+drop column\s+close_hour/);
    // wa_number and full_dates are untouched: no destructive op names them.
    expect(code).not.toMatch(/drop column\s+wa_number/);
    expect(code).not.toMatch(/drop column\s+full_dates/);
    expect(code).not.toContain("drop table");
    // Restore note: header documents how to re-add the columns.
    const header = sql.toLowerCase();
    expect(header).toMatch(/restore/);
    expect(header).toContain("add column open_hour");
    expect(header).toContain("add column close_hour");
    expect(header).toMatch(/open_hour\s*<\s*close_hour/);
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

  it("0015 creates booking_requests with a uuid primary key", () => {
    const code = codeOnly(
      readMigration("0015_booking_requests_schema.sql"),
    ).toLowerCase();
    expect(code).toMatch(/create table\s+booking_requests\b/);
    expect(code).toMatch(/id\s+uuid\s+primary key\s+default\s+gen_random_uuid\(\)/);
  });

  it("0015 adds the six booking scalar columns with defaults and checks", () => {
    const code = codeOnly(
      readMigration("0015_booking_requests_schema.sql"),
    ).toLowerCase();
    // event_type / venue / hairdo: non-null text defaulting to ''.
    for (const col of ["event_type", "venue", "hairdo"]) {
      expect(code).toMatch(
        new RegExp(
          `alter table\\s+bookings\\s+add column\\s+${col}\\s+text\\s+not null\\s+default\\s+''`,
        ),
      );
    }
    // headcount: non-null integer default 1, check >= 1.
    expect(code).toMatch(
      /alter table\s+bookings\s+add column\s+headcount\s+integer\s+not null\s+default\s+1/,
    );
    expect(code).toMatch(/check\s*\(\s*headcount\s*>=\s*1\s*\)/);
    // total_price: nullable integer, check null-or->= 0.
    expect(code).toMatch(
      /alter table\s+bookings\s+add column\s+total_price\s+integer/,
    );
    expect(code).not.toMatch(/add column\s+total_price\s+integer\s+not null/);
    expect(code).toMatch(
      /check\s*\(\s*total_price\s+is null\s+or\s+total_price\s*>=\s*0\s*\)/,
    );
    // dp_amount: non-null integer default 0, check >= 0.
    expect(code).toMatch(
      /alter table\s+bookings\s+add column\s+dp_amount\s+integer\s+not null\s+default\s+0/,
    );
    expect(code).toMatch(/check\s*\(\s*dp_amount\s*>=\s*0\s*\)/);
  });

  it("0015 gives booking_requests a 128-bit random token distinct from the row id", () => {
    const code = codeOnly(
      readMigration("0015_booking_requests_schema.sql"),
    ).toLowerCase();
    expect(code).toMatch(/token\s+text\s+not null\s+unique/);
    // Database-generated 128-bit value: pgcrypto gen_random_bytes(16).
    expect(code).toMatch(
      /default\s+encode\s*\(\s*gen_random_bytes\s*\(\s*16\s*\)\s*,\s*'hex'\s*\)/,
    );
    // pgcrypto supplies gen_random_bytes; its creation is explicit + documented.
    expect(code).toMatch(/create extension if not exists pgcrypto/);
    // The token default never reuses the enumerable row id generator.
    const tokenCol = code.match(/token\s+text[^;]*?encode\(gen_random_bytes\(16\)/);
    expect(tokenCol).not.toBeNull();
    expect(tokenCol![0]).not.toContain("gen_random_uuid");
  });

  it("0015 tracks the three bookkeeping timestamps and leaves submitted_at nullable", () => {
    const code = codeOnly(
      readMigration("0015_booking_requests_schema.sql"),
    ).toLowerCase();
    expect(code).toMatch(/created_at\s+timestamptz\s+not null\s+default\s+now\(\)/);
    expect(code).toMatch(/expires_at\s+timestamptz\s+not null/);
    expect(code).toMatch(/expires_at[\s\S]{0,80}?interval\s*'7 days'/);
    // submitted_at is set only when the client submits, so it stays nullable.
    expect(code).toMatch(/submitted_at\s+timestamptz\b/);
    expect(code).not.toMatch(/submitted_at\s+timestamptz\s+not null/);
  });

  it("0015 links accepted_booking_id to bookings, unique and null on delete", () => {
    const code = codeOnly(
      readMigration("0015_booking_requests_schema.sql"),
    ).toLowerCase();
    expect(code).toMatch(
      /accepted_booking_id\s+uuid\s+unique\s+references\s+bookings\s*\(\s*id\s*\)/,
    );
    expect(code).toMatch(/on delete set null/);
  });

  it("0015 stores the client-owned fields with safe non-null defaults", () => {
    const code = codeOnly(
      readMigration("0015_booking_requests_schema.sql"),
    ).toLowerCase();
    for (const col of ["client_name", "client_phone", "venue", "hairdo", "notes"]) {
      expect(code).toMatch(new RegExp(`${col}\\s+text\\s+not null\\s+default\\s+''`));
    }
    expect(code).toMatch(/event_type\s+text\s+not null\s+default\s+''/);
    expect(code).toMatch(/headcount\s+integer\s+not null\s+default\s+1/);
    expect(code).toMatch(/check\s*\(\s*headcount\s*>=\s*1\s*\)/);
  });

  it("0015 keeps the requested slot nullable with HH:MM checks and a start<end guard", () => {
    const code = codeOnly(readMigration("0015_booking_requests_schema.sql"));
    const lower = code.toLowerCase();
    // The requested slot stays date + "HH:MM" text, all nullable (admin may
    // generate the link before date/times are agreed).
    expect(lower).toMatch(/\bdate\s+date\b/);
    expect(lower).toMatch(/start_time\s+text\b/);
    expect(lower).not.toMatch(/start_time\s+text\s+not null/);
    expect(lower).toMatch(/end_time\s+text\b/);
    expect(lower).not.toMatch(/end_time\s+text\s+not null/);
    // Strict 00-23 HH:MM regex on both text columns.
    const regexChecks = code.match(/~\s*'[^']*'/g) ?? [];
    expect(regexChecks.length).toBeGreaterThanOrEqual(2);
    for (const check of regexChecks) {
      expect(check).toContain("([01][0-9]|2[0-3])");
    }
    // start < end only applies when both times are present.
    expect(lower).toMatch(
      /check\s*\(\s*start_time\s+is null\s+or\s+end_time\s+is null\s+or\s+start_time\s*<\s*end_time\s*\)/,
    );
    // Never a timestamptz slot window.
    expect(lower).not.toMatch(/start_time\s+timestamptz/);
    expect(lower).not.toMatch(/end_time\s+timestamptz/);
  });

  it("0015 enables RLS on booking_requests: authenticated full CRUD, never anon", () => {
    const code = codeOnly(
      readMigration("0015_booking_requests_schema.sql"),
    ).toLowerCase();
    expect(code).toMatch(
      /alter table\s+booking_requests\s+enable row level security/,
    );
    expect(code).toMatch(
      /create policy\s+booking_requests_admin_all\s+on\s+booking_requests\s+for all\s+to authenticated\s+using\s*\(\s*true\s*\)\s*with check\s*\(\s*true\s*\)/,
    );
    // The public never touches the table directly: no anon policy/select may
    // name booking_requests (public access is via future security-definer RPCs).
    const anonSelects =
      code.match(/create policy[^;]*for select[^;]*to anon[^;]*;/g) ?? [];
    for (const policy of anonSelects) {
      expect(policy).not.toContain("booking_requests");
    }
    expect(code).not.toMatch(/create policy[^;]*booking_requests[^;]*to anon/);
    expect(code).not.toMatch(/grant[^;]*booking_requests[^;]*to anon/);
  });

  it("0015 leaves the calendar seam untouched (no day/month RPC redefinition)", () => {
    const code = codeOnly(
      readMigration("0015_booking_requests_schema.sql"),
    ).toLowerCase();
    expect(code).not.toContain("get_day_schedule");
    expect(code).not.toContain("get_month_availability");
    expect(code).not.toContain("create or replace function");
  });

  it("0016 defines both request RPCs as security definer with fixed search_path", () => {
    const code = codeOnly(
      readMigration("0016_booking_request_rpcs.sql"),
    ).toLowerCase();
    expect(code).toMatch(
      /create or replace function\s+get_booking_request\s*\(\s*p_token text\s*\)/,
    );
    expect(code).toMatch(
      /create or replace function\s+submit_booking_request\s*\(\s*p_token text\s*,\s*p_payload jsonb\s*\)/,
    );
    for (const name of ["get_booking_request", "submit_booking_request"]) {
      const fn = code.match(
        new RegExp(`create or replace function\\s+${name}[\\s\\S]*?\\$\\$;`),
      );
      expect(fn).not.toBeNull();
      expect(fn![0]).toMatch(/security definer/);
      expect(fn![0]).toMatch(/set search_path\s*=\s*public/);
    }
    // The read function is a stable lookup; the submit function writes, so it
    // stays volatile (default, no explicit marker).
    const read =
      code.match(/create or replace function\s+get_booking_request[\s\S]*?\$\$;/)?.[0] ??
      "";
    expect(read).toMatch(/\bstable\b/);
    expect(read).not.toMatch(/\bvolatile\b/);
    // Execute granted to anon for both.
    expect(code).toMatch(
      /grant execute on function get_booking_request\(text\) to anon,\s*authenticated/,
    );
    expect(code).toMatch(
      /grant execute on function submit_booking_request\(text,\s*jsonb\) to anon,\s*authenticated/,
    );
  });

  it("0016 read returns only state + admin-typed context, never PII or price", () => {
    const code = codeOnly(readMigration("0016_booking_request_rpcs.sql"));
    const read =
      code.match(/create or replace function\s+get_booking_request[\s\S]*?\$\$;/)?.[0] ??
      "";
    expect(read).not.toBe("");
    // All four derived states, submitted outranks expired.
    for (const state of ["'open'", "'submitted'", "'expired'", "'missing'"]) {
      expect(read).toContain(state);
    }
    expect(read).toMatch(/submitted_at\s+is not null/);
    expect(read).toMatch(/expires_at\s*<=\s*now\(\)/);
    // The output date is a YYYY-MM-DD string.
    expect(read).toMatch(/to_char\([^)]*,\s*'YYYY-MM-DD'\)/);
    // Context keys only.
    for (const key of [
      "'state'",
      "'client_name'",
      "'date'",
      "'start_time'",
      "'end_time'",
    ]) {
      expect(read).toContain(key);
    }
    // Negative sweep: the read body never selects or returns the client's
    // phone/notes, an admin price, status, or the accepted link.
    for (const forbidden of [
      "client_phone",
      "notes",
      "total_price",
      "dp_amount",
      "status",
      "accepted_booking_id",
    ]) {
      expect(read.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("0016 submit writes only client-owned columns plus submitted_at, guarded and race-safe", () => {
    const code = codeOnly(readMigration("0016_booking_request_rpcs.sql"));
    const submit =
      code.match(
        /create or replace function\s+submit_booking_request[\s\S]*?\$\$;/,
      )?.[0] ?? "";
    expect(submit).not.toBe("");
    // Reports all four refusals.
    for (const reason of [
      "not_found",
      "expired",
      "already_submitted",
      "invalid_payload",
    ]) {
      expect(submit).toContain(reason);
    }
    expect(submit).toMatch(/update\s+booking_requests/);
    expect(submit).toMatch(/submitted_at\s*=\s*now\(\)/);
    // The SET clause carries the ten client-owned columns and submitted_at
    // only — never the token, price, status, accepted link, or other stamps.
    const setClause =
      submit.match(
        /update\s+booking_requests\s+set([\s\S]*?)where\s+token\s*=\s*p_token/,
      )?.[1] ?? "";
    expect(setClause).not.toBe("");
    for (const col of [
      "client_name",
      "client_phone",
      "event_type",
      "headcount",
      "venue",
      "hairdo",
      "notes",
      "date",
      "start_time",
      "end_time",
      "submitted_at",
    ]) {
      expect(setClause).toContain(col);
    }
    for (const forbidden of [
      "token",
      "total_price",
      "dp_amount",
      "status",
      "accepted_booking_id",
      "created_at",
      "expires_at",
    ]) {
      expect(setClause.toLowerCase()).not.toContain(forbidden);
    }
    // Race-safe guard: only an unsubmitted, unexpired token updates.
    expect(submit).toMatch(
      /where\s+token\s*=\s*p_token[\s\S]*submitted_at\s+is null[\s\S]*expires_at\s*>\s*now\(\)/,
    );
  });

  it("0016 validates the payload fail-closed with the exact caps", () => {
    const code = codeOnly(readMigration("0016_booking_request_rpcs.sql"));
    const submit =
      code.match(
        /create or replace function\s+submit_booking_request[\s\S]*?\$\$;/,
      )?.[0] ?? "";
    expect(submit).toMatch(
      /jsonb_typeof\s*\(\s*p_payload\s*\)\s*<>\s*'object'/,
    );
    // Strict slot validation: YYYY-MM-DD, HH:MM 00-23, start < end.
    expect(submit).toContain("\\d{4}-\\d{2}-\\d{2}");
    expect(submit).toContain("^([01][0-9]|2[0-3]):[0-5][0-9]$");
    expect(submit).toMatch(/v_start_text\s*<\s*v_end_text/);
    // Length/digit caps mirrored from the client validator.
    for (const cap of ["120", "32", "200", "1000", "100"]) {
      expect(submit).toContain(cap);
    }
    expect(submit).toMatch(/>=\s*9|<\s*9/);
    expect(submit).toMatch(/v_headcount\s*<\s*1/);
    expect(submit).toMatch(/v_headcount\s*>\s*100/);
  });

  it("0016 never grants the anon role table access to booking_requests", () => {
    const code = codeOnly(
      readMigration("0016_booking_request_rpcs.sql"),
    ).toLowerCase();
    // No grant or policy may name booking_requests at all for anon.
    expect(code).not.toMatch(/grant[^;]*booking_requests/);
    expect(code).not.toMatch(/create policy[^;]*booking_requests/);
    expect(code).not.toMatch(/on\s+booking_requests\s+to\s+anon/);
  });
});

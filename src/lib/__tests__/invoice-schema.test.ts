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

function invoicesTable(code: string): string {
  return code.match(/create table\s+invoices\b[\s\S]*?;/)?.[0] ?? "";
}

function createInvoiceFunction(code: string): string {
  return (
    code.match(/create or replace function\s+create_invoice[\s\S]*?\$\$;/)?.[0] ??
    ""
  );
}

// Seam 3 (declarative SQL verify): asserts the invoice data contract without a
// live database. Catches missing columns/constraints/RLS/RPC pieces. Misses
// live Postgres semantics (advisory-lock races, actual inserts).
describe("0018 invoice data contract (local SQL verify, no live DB)", () => {
  const sql = readMigration("0018_invoices_schema.sql");
  const code = codeOnly(sql).toLowerCase();
  const body = invoicesTable(code);
  const createInvoice = createInvoiceFunction(code);

  it("creates the admin-only invoices table with identity and a required booking link", () => {
    expect(body).not.toBe("");
    expect(body).toMatch(/id\s+uuid\s+primary key\s+default\s+gen_random_uuid\(\)/);
    expect(body).toMatch(/created_at\s+timestamptz\s+not null\s+default\s+now\(\)/);
    expect(body).toMatch(
      /booking_id\s+uuid\s+not null\s+references\s+bookings\s*\(\s*id\s*\)\s+on delete cascade/,
    );
  });

  it("stores every frozen snapshot column plus the two dates and nullable sent_at", () => {
    for (const col of [
      "client_name",
      "client_phone",
      "service_name",
      "event_type",
      "headcount",
      "venue",
      "hairdo",
      "booking_date",
      "start_time",
      "end_time",
      "subtotal",
      "dp_amount",
    ]) {
      // A real column declaration, not merely a name mentioned in a CHECK.
      expect(body).toMatch(
        new RegExp(`\\b${col}\\s+(text|date|integer|timestamptz|uuid)`),
      );
    }
    expect(body).toMatch(/issued_on\s+date\s+not null/);
    expect(body).toMatch(/due_on\s+date\s+not null/);
    expect(body).toMatch(/sent_at\s+timestamptz\b/);
    expect(body).not.toMatch(/sent_at\s+timestamptz\s+not null/);
  });

  it("keeps invoice numbers unique and pinned to the issue date's year", () => {
    expect(body).toMatch(/number\s+text\s+not null\s+unique/);
    expect(body).toMatch(/unique\s*\(\s*year\s*,\s*seq\s*\)/);
    // The year can never drift from the issue date...
    expect(body).toMatch(
      /check\s*\(\s*year\s*=\s*extract\s*\(\s*year\s+from\s+issued_on\s*\)\s*::\s*integer\s*\)/,
    );
    // ...and the number is exactly invc-NN/YYYY for its own year + sequence.
    expect(body).toMatch(
      /number\s*=\s*'invc-'\s*\|\|\s*lpad\s*\(\s*seq::text\s*,\s*2\s*,\s*'0'\s*\)\s*\|\|\s*'\/'\s*\|\|\s*year::text/,
    );
    expect(body).toMatch(/seq\s+integer\s+not null\s+check\s*\(\s*seq\s*>\s*0\s*\)/);
  });

  it("enforces the date, amount and HH:MM invariants in the table", () => {
    expect(body).toMatch(/check\s*\(\s*due_on\s*>=\s*issued_on\s*\)/);
    expect(body).toMatch(/check\s*\(\s*subtotal\s*>=\s*0\s*\)/);
    expect(body).toMatch(/check\s*\(\s*dp_amount\s*>\s*0\s*\)/);
    expect(body).toMatch(/check\s*\(\s*dp_amount\s*<=\s*subtotal\s*\)/);

    const timeChecks = body.match(/~\s*'[^']*'/g) ?? [];
    expect(timeChecks.length).toBeGreaterThanOrEqual(2);
    for (const check of timeChecks) {
      expect(check).toContain("([01][0-9]|2[0-3])");
    }
    expect(body).toMatch(/start_time\s+text\s+not null/);
    expect(body).toMatch(/end_time\s+text\s+not null/);
  });

  it("adds the per-booking newest-first lookup index", () => {
    expect(code).toMatch(
      /create index\s+invoices_booking_newest_idx\s+on\s+invoices\s*\(\s*booking_id\s*,\s*year\s+desc\s*,\s*seq\s+desc\s*\)/,
    );
  });

  it("creates an invoice from a booking id and both dates in one function", () => {
    expect(createInvoice).not.toBe("");
    expect(createInvoice).toMatch(
      /create or replace function\s+create_invoice\s*\(\s*p_booking_id uuid\s*,\s*p_issued_on date\s*,\s*p_due_on date\s*\)/,
    );
    expect(createInvoice).toMatch(/returns invoices/);
    expect(createInvoice).toMatch(/language plpgsql/);
    expect(createInvoice).toMatch(/set search_path\s*=\s*public/);
    // Invoker rights: RLS still applies when the admin calls it.
    expect(createInvoice).not.toMatch(/security definer/);
    expect(createInvoice).toMatch(/insert into invoices/);
    expect(createInvoice).toMatch(/return\s+v_invoice/);
  });

  it("locks the year and allocates highest sequence + 1 safely", () => {
    expect(createInvoice).toMatch(/pg_advisory_xact_lock\s*\([^;]*v_year/);
    expect(createInvoice).toMatch(/coalesce\s*\(\s*max\s*\(\s*seq\s*\)\s*,\s*0\s*\)\s*\+\s*1/);
    expect(createInvoice).toMatch(/where\s+year\s*=\s*v_year/);
    // The year comes from the issue date, never from the booking or a caller
    // supplied number.
    expect(createInvoice).toMatch(
      /v_year\s*:=\s*extract\s*\(\s*year\s+from\s+p_issued_on\s*\)/,
    );
    expect(createInvoice).not.toMatch(/p_number/);
  });

  it("builds the snapshot from the booking row and falls back to an empty service name", () => {
    expect(createInvoice).toMatch(/from\s+bookings\s+b/);
    expect(createInvoice).toMatch(/left join\s+services\s+s\s+on\s+s\.id\s*=\s*b\.service_id/);
    expect(createInvoice).toMatch(/coalesce\s*\(\s*s\.name\s*,\s*''\s*\)/);
    for (const source of [
      "b.client_name",
      "b.client_phone",
      "b.event_type",
      "b.headcount",
      "b.venue",
      "b.hairdo",
      "b.date",
      "b.start_time",
      "b.end_time",
      "b.total_price",
      "b.dp_amount",
    ]) {
      expect(createInvoice).toContain(source);
    }
  });

  it("raises an Indonesian refusal for every guarded precondition", () => {
    expect(createInvoice).toMatch(/raise exception/i);
    expect(createInvoice).toMatch(/dibatalkan/i);
    expect(createInvoice).toMatch(/total yang disepakati/i);
    expect(createInvoice).toMatch(/belum memiliki dp|dp yang tercatat/i);
    expect(createInvoice).toMatch(/dp tidak boleh melebihi total/i);
    expect(createInvoice).toMatch(/jatuh tempo tidak boleh sebelum tanggal terbit/i);
  });

  it("follows the booking-request privacy pattern: authenticated full access, no anon policy", () => {
    expect(code).toMatch(/alter table\s+invoices\s+enable row level security/);
    expect(code).toMatch(
      /create policy\s+invoices_admin_all\s+on\s+invoices\s+for all\s+to authenticated\s+using\s*\(\s*true\s*\)\s+with check\s*\(\s*true\s*\)/,
    );
    expect(code).not.toMatch(/create policy[^;]*invoices[^;]*to anon/);
  });

  it("grants the allocation function to the admin only", () => {
    expect(code).toMatch(
      /revoke all on function\s+create_invoice\s*\(\s*uuid\s*,\s*date\s*,\s*date\s*\)\s*from public/,
    );
    expect(code).toMatch(
      /grant execute on function\s+create_invoice\s*\(\s*uuid\s*,\s*date\s*,\s*date\s*\)\s*to authenticated/,
    );
    expect(code).not.toMatch(/grant[^;]*to anon/);
  });

  it("adds the four payment settings columns empty, non-null and with no public exposure", () => {
    for (const col of [
      "bank_name",
      "account_name",
      "account_number",
      "instagram_handle",
    ]) {
      expect(code).toMatch(
        new RegExp(
          `alter table\\s+settings\\s+add column\\s+${col}\\s+text\\s+not null\\s+default\\s+''`,
        ),
      );
    }
    // Empty means empty: no prefilled values and no new anon policy/grant.
    expect(code).not.toMatch(/(insert into|update)\s+settings/);
    expect(code).not.toMatch(/create policy[^;]*to anon/);
    expect(code).not.toMatch(/get_public_[a-z_]*\(/);
  });
});

// Seam 3 (declarative SQL verify): the lifecycle invariants a sent Invoice
// must never break. Catches a freeze rule that would let a sent row be edited
// or deleted (and so let its number be reused). Misses live trigger behaviour.
describe("0019 invoice lifecycle contract (local SQL verify, no live DB)", () => {
  const sql = readMigration("0019_invoice_lifecycle.sql");
  const code = codeOnly(sql).toLowerCase();
  const guard =
    code.match(
      /create or replace function\s+guard_invoice_lifecycle[\s\S]*?\$\$;/,
    )?.[0] ?? "";

  it("guards every update and delete on the invoices table", () => {
    expect(guard).not.toBe("");
    expect(guard).toMatch(/language plpgsql/);
    expect(guard).toMatch(/set search_path\s*=\s*public/);
    expect(code).toMatch(
      /create trigger\s+invoices_guard_lifecycle\s+before update or delete on invoices\s+for each row\s+execute function\s+guard_invoice_lifecycle\s*\(\s*\)/,
    );
  });

  it("refuses a direct delete of a sent Invoice but lets its Booking cascade remove it", () => {
    expect(guard).toMatch(/if old\.sent_at is not null then/);
    expect(guard).toMatch(/tg_op\s*=\s*'delete'/);
    // A direct delete is depth 1; the Booking's FK cascade arrives at depth 2.
    expect(guard).toMatch(/pg_trigger_depth\(\)\s*<=\s*1/);
    expect(guard).toMatch(
      /raise exception 'invoice yang sudah dikirim tidak dapat dihapus\.'/,
    );
  });

  it("freezes every field except sent_at while the mark is present", () => {
    expect(guard).toMatch(
      /\(\s*to_jsonb\s*\(\s*new\s*\)\s*-\s*'sent_at'\s*\)\s*is distinct from\s*\(\s*to_jsonb\s*\(\s*old\s*\)\s*-\s*'sent_at'\s*\)/,
    );
    expect(guard).toMatch(
      /raise exception 'invoice yang sudah dikirim tidak dapat diubah\.'/,
    );
  });
});

describe("multiple Services SQL contract", () => {
  it("carries forward linked Booking Services and each Invoice's own saved name", () => {
    const code = codeOnly(readMigration("0024_booking_services.sql")).toLowerCase();
    expect(code).toMatch(/update bookings b[\s\S]*?from services s\s+where s.id = b.service_id/);
    expect(code).toMatch(/update invoices\s+set service_names = array\[service_name\]\s+where service_name <> ''/);
    expect(code).toMatch(/enable trigger invoices_guard_lifecycle/);
  });

  it("issues the full list of saved names from the locked Booking", () => {
    const code = codeOnly(readMigration("0024_booking_services.sql")).toLowerCase();
    const createInvoice = createInvoiceFunction(code);
    expect(createInvoice).toMatch(/from bookings\s+where id = p_booking_id\s+for update/);
    expect(createInvoice).toMatch(/jsonb_array_elements\(v_booking.selected_services\) with ordinality/);
    expect(createInvoice).toMatch(/insert into invoices\s*\([^;]*?\bservice_names\b/);
    expect(createInvoice).not.toMatch(/(join|from) services\b/);
    expect(createInvoice).not.toContain("bagian_mua");
    expect(code).toMatch(/revoke execute on function create_invoice\(uuid, date, date\) from public, anon/);
  });
});

describe("Pelunasan SQL contract", () => {
  it("atomically saves Pelunasan and the reviewed private amount under the Booking lock", () => {
    const code = codeOnly(readMigration("0025_booking_bagian_mua.sql")).toLowerCase();
    expect(code).toMatch(/add column bagian_mua integer\s*,/);
    expect(code).toMatch(/bagian_mua is null\s+or \(total_price is not null and bagian_mua between 0 and total_price\)/);
    expect(code).toContain("drop function record_pelunasan(uuid, integer, integer, text, text)");
    expect(code).toMatch(/select \* into v_booking[\s\S]*?where id = p_booking_id\s+for update/);
    expect(code).toMatch(/v_booking\.bagian_mua is distinct from p_expected_bagian_mua[\s\S]*?raise exception/);
    expect(code).toMatch(/set pelunasan_amount = v_remaining,\s+bagian_mua = p_bagian_mua\s+where id = p_booking_id/);
    expect(code).not.toMatch(/alter table invoices|create_invoice/);
  });

  it("locks the saved Booking and records the balance only after checking the reviewed amounts", () => {
    const code = codeOnly(readMigration("0023_paid_invoices.sql")).toLowerCase();
    expect(code).toMatch(/select \* into v_booking[\s\S]*?where id = p_booking_id\s+for update/);
    expect(code).toMatch(/v_booking\.pelunasan_amount is not null[\s\S]*?raise exception/);
    expect(code).toMatch(/v_booking\.total_price is distinct from p_expected_total\s+or v_booking\.dp_amount is distinct from p_expected_dp/);
    expect(code).toMatch(/v_booking\.client_name is distinct from p_expected_client_name\s+or v_booking\.client_phone is distinct from p_expected_client_phone/);
    expect(code).toMatch(/v_remaining := v_booking\.total_price - v_booking\.dp_amount/);
    expect(code).toMatch(/v_remaining is null or v_remaining <= 0[\s\S]*?raise exception/);
    expect(code).toMatch(/set pelunasan_amount = v_remaining\s+where id = p_booking_id/);
    expect(code).toMatch(/revoke all on function record_pelunasan\(uuid, integer, integer, text, text\) from public, anon/);
    expect(code).toMatch(/grant execute on function record_pelunasan\(uuid, integer, integer, text, text\) to authenticated/);
  });

  it("refuses changes to the total or DP while Pelunasan is recorded", () => {
    const code = codeOnly(readMigration("0023_paid_invoices.sql")).toLowerCase();
    expect(code).toMatch(/old\.pelunasan_amount is not null\s+and \(new\.total_price is distinct from old\.total_price\s+or new\.dp_amount is distinct from old\.dp_amount\)/);
    expect(code).toMatch(/before update of total_price, dp_amount on bookings/);
  });

  it("issues from the locked Booking, preserving both payments and requiring a due date only with a balance", () => {
    const code = codeOnly(readMigration("0023_paid_invoices.sql")).toLowerCase();
    const createInvoice = createInvoiceFunction(code);
    expect(code).toMatch(/alter table invoices[\s\S]*?alter column due_on drop not null/);
    expect(code).toMatch(/dp_amount > 0 or pelunasan_amount is not null/);
    expect(createInvoice).toMatch(/from bookings b[\s\S]*?for update of b/);
    expect(createInvoice).toMatch(/v_booking\.dp_amount = 0 and v_booking\.pelunasan_amount is null[\s\S]*?raise exception/);
    expect(createInvoice).toMatch(/v_remaining > 0[\s\S]*?p_due_on is null[\s\S]*?p_due_on < p_issued_on/);
    expect(createInvoice).toMatch(/case when v_remaining = 0 then null else p_due_on end/);
    expect(createInvoice).toMatch(/v_booking\.total_price, v_booking\.dp_amount, v_booking\.pelunasan_amount/);
    expect(createInvoice).toMatch(/pg_advisory_xact_lock[\s\S]*?coalesce\(max\(seq\), 0\) \+ 1/);
    expect(code).toMatch(/\(new\.due_on is null\) <> \(old\.due_on is null\)[\s\S]*?raise exception/);
    expect(code).not.toMatch(/update\s+invoices\s+set/);
  });

  it("pads Invoice Numbers to at least two digits without truncating sequence 100", () => {
    const code = codeOnly(readMigration("0023_paid_invoices.sql")).toLowerCase();
    expect(code).toContain("lpad(seq::text, greatest(2, length(seq::text)), '0')");
    expect(createInvoiceFunction(code)).toContain(
      "lpad(v_seq::text, greatest(2, length(v_seq::text)), '0')",
    );
  });
});

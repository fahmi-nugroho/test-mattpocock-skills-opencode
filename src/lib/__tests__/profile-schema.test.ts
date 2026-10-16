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

// Seam (declarative SQL verify): asserts 0013 adds profil/testimoni schema
// without a live DB. Catches missing tables/columns/RLS/storage. Misses
// live Postgres semantics.
describe("0013 profile/testimoni schema (local SQL verify, no live DB)", () => {
  it("extends settings with headline, subcopy, portrait_url plus length checks", () => {
    const sql = readMigration("0013_profile_testimoni_schema.sql");
    const code = codeOnly(sql).toLowerCase();
    for (const col of ["headline", "subcopy", "portrait_url"]) {
      expect(code).toContain(col);
    }
    expect(code).toMatch(/alter table\s+settings\s+add column\s+headline/);
    expect(code).toMatch(/alter table\s+settings\s+add column\s+subcopy/);
    expect(code).toMatch(/alter table\s+settings\s+add column\s+portrait_url/);
    // Sensible defaults for headline/subcopy; portrait stays nullable.
    expect(sql).toContain("Tampil memukau di hari spesialmu");
    expect(sql).toContain("Lihat portfolio, pilih layanan");
    expect(code).toMatch(/char_length\s*\(\s*headline\s*\)\s*<=\s*120/);
    expect(code).toMatch(/char_length\s*\(\s*subcopy\s*\)\s*<=\s*300/);
    expect(code).toMatch(/char_length\s*\(\s*portrait_url\s*\)\s*<=\s*2048/);
    // Spec #44: portrait must be an HTTPS image URL or upload result.
    expect(code).toMatch(/portrait_url\s+like\s+'https:\/\/\%'/);
    // id=1 single-row constraint intact: 0013 must not drop it.
    expect(code).not.toMatch(/drop.*id/);
  });

  it("creates testimonials and profile_stats with sort + visible flags", () => {
    const sql = readMigration("0013_profile_testimoni_schema.sql");
    const code = codeOnly(sql).toLowerCase();
    expect(code).toMatch(/create table\s+testimonials\b/);
    expect(code).toMatch(/create table\s+profile_stats\b/);
    for (const col of ["quote", "client_name", "sort", "visible"]) {
      expect(code).toContain(col);
    }
    for (const col of ["value", "label", "sort", "visible"]) {
      expect(code).toContain(col);
    }
    expect(code).toMatch(/char_length\s*\(\s*quote\s*\)/);
    expect(code).toMatch(/char_length\s*\(\s*value\s*\)/);
    expect(code).toMatch(/char_length\s*\(\s*label\s*\)/);
  });

  it("adds visible+sort lookup indexes for both collections", () => {
    const code = codeOnly(
      readMigration("0013_profile_testimoni_schema.sql"),
    ).toLowerCase();
    expect(code).toMatch(/testimonials_visible_sort_idx/);
    expect(code).toMatch(/profile_stats_visible_sort_idx/);
    expect(code).toMatch(/on testimonials\s*\(\s*visible\s*,\s*sort\s*\)/);
    expect(code).toMatch(/on profile_stats\s*\(\s*visible\s*,\s*sort\s*\)/);
  });

  it("enables RLS: anon reads visible rows only, authenticated has full CRUD, settings stays anon-denied", () => {
    const sql = readMigration("0013_profile_testimoni_schema.sql");
    const code = codeOnly(sql).toLowerCase();
    expect(code).toMatch(/alter table\s+testimonials\s+enable row level security/);
    expect(code).toMatch(/alter table\s+profile_stats\s+enable row level security/);
    expect(code).toMatch(/visible\s*=\s*true/);
    // anon SELECT policies exist only for the two new tables.
    const anonSelects =
      code.match(/create policy[^;]*for select[^;]*to anon[^;]*;/g) ?? [];
    expect(anonSelects.length).toBeGreaterThan(0);
    for (const policy of anonSelects) {
      expect(policy).not.toContain("settings");
    }
    expect(code).toContain("to authenticated");
    // No anon policy may touch settings (raw profil row stays admin-only).
    expect(code).not.toMatch(/for select[^;]*to anon[^;]*settings|settings[^;]*to anon/);
  });

  it("adds a public profile bucket and extends storage policies consistently", () => {
    const sql = readMigration("0013_profile_testimoni_schema.sql");
    const code = codeOnly(sql).toLowerCase();
    expect(code).toMatch(/insert into storage\.buckets/);
    expect(code).toContain("profile");
    // Old policies are dropped and re-created with the 3-bucket list so
    // the expression stays consistent with the portfolio/prices pattern.
    expect(code).toMatch(/drop policy.*storage_public_read/);
    expect(code).toMatch(/drop policy.*storage_admin_insert/);
    expect(code).toMatch(/drop policy.*storage_admin_update/);
    expect(code).toMatch(/drop policy.*storage_admin_delete/);
    // Policy names stay identical so schema.test-style assertions still pass.
    for (const name of [
      "storage_public_read",
      "storage_admin_insert",
      "storage_admin_update",
      "storage_admin_delete",
    ]) {
      expect(code).toContain(name);
    }
    expect(code).toMatch(
      /bucket_id in\s*\(\s*'portfolio'\s*,\s*'prices'\s*,\s*'profile'\s*\)/,
    );
  });

  it("header documents ticket, defaults, and landing fallback behavior", () => {
    const sql = readMigration("0013_profile_testimoni_schema.sql").toLowerCase();
    expect(sql).toMatch(/ticket 01/);
    expect(sql).toMatch(/hero_stats|testimonials/);
    expect(sql).toMatch(/getheroportraiturl|fallback/);
  });
});

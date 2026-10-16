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

// Seam (declarative SQL verify): asserts 0014 exposes the public profil
// RPC without opening the raw settings table. Catches missing function
// or grants. Misses live Postgres semantics.
describe("0014 public profile RPC (local SQL verify, no live DB)", () => {
  it("creates get_public_profile returning headline/subcopy/portrait_url", () => {
    const sql = readMigration("0014_public_profile_rpc.sql");
    const code = codeOnly(sql).toLowerCase();
    expect(code).toMatch(/create or replace function\s+get_public_profile/);
    expect(code).toContain("headline");
    expect(code).toContain("subcopy");
    expect(code).toContain("portrait_url");
    expect(code).toMatch(/security definer/);
    expect(code).toMatch(
      /grant execute on function get_public_profile\(\) to anon,\s*authenticated/,
    );
  });

  it("does not open the raw settings table to anon", () => {
    const code = codeOnly(
      readMigration("0014_public_profile_rpc.sql"),
    ).toLowerCase();
    expect(code).not.toMatch(/create policy[^;]*settings/);
  });
});

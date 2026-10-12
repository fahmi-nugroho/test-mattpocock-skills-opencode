import { describe, expect, it } from "vitest";
import {
  FEATURED_BADGE_LABEL,
  getFeaturedService,
} from "../featured-service";
import type { Service } from "../supabase/database";

function service(
  overrides: Partial<Service> & { id: string },
): Service {
  return {
    name: "Rias",
    description: "",
    price_idr: 150000,
    duration_min: 60,
    active: true,
    cover_image_url: null,
    sort: 0,
    ...overrides,
  };
}

describe("getFeaturedService", () => {
  it("returns the first active service by ascending sort", () => {
    const items = [
      service({ id: "b", sort: 2 }),
      service({ id: "a", sort: 1 }),
      service({ id: "c", sort: 3, active: false }),
    ];
    expect(getFeaturedService(items)?.id).toBe("a");
  });

  it("skips inactive services even when they sort first", () => {
    const items = [
      service({ id: "hidden", sort: 0, active: false }),
      service({ id: "shown", sort: 5 }),
    ];
    expect(getFeaturedService(items)?.id).toBe("shown");
  });

  it("returns null when no active service exists", () => {
    expect(getFeaturedService([])).toBeNull();
    expect(
      getFeaturedService([service({ id: "x", active: false })]),
    ).toBeNull();
  });

  it("uses the Paling Dipilih badge copy", () => {
    expect(FEATURED_BADGE_LABEL).toBe("Paling Dipilih");
  });
});

import { describe, expect, it } from "vitest";

import { resolvePrismaProvider } from "@/lib/prisma-provider-resolve-core";

describe("resolvePrismaProvider", () => {
  it("prefers explicit PRISMA_PROVIDER", () => {
    expect(
      resolvePrismaProvider({
        PRISMA_PROVIDER: "postgresql",
        DATABASE_URL: "file:./prisma/dev.db",
      }),
    ).toBe("postgresql");
  });

  it("infers postgresql from DATABASE_URL", () => {
    expect(
      resolvePrismaProvider({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      }),
    ).toBe("postgresql");
  });

  it("defaults file URLs to sqlite", () => {
    expect(resolvePrismaProvider({ DATABASE_URL: "file:./prisma/dev.db" })).toBe(
      "sqlite",
    );
  });
});

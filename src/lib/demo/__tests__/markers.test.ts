import { describe, expect, it } from "vitest";

import {
  DEMO_CONFIRMED_DESCRIPTION,
  DEMO_CONFIRMED_TITLE,
} from "../markers";

describe("demo confirmed copy markers", () => {
  it("DEMO_CONFIRMED_TITLE is the expected string", () => {
    expect(DEMO_CONFIRMED_TITLE).toBe("Demo deposit simulated");
  });

  it("DEMO_CONFIRMED_DESCRIPTION is the expected string", () => {
    expect(DEMO_CONFIRMED_DESCRIPTION).toBe(
      "No real subscription was created. This sandbox flow is for visual QA only.",
    );
  });
});

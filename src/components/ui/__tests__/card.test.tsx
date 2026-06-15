import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Card } from "@/components/ui/card";

describe("Card", () => {
  it("applies contentClassName on the inner ct-z-base shell", () => {
    const html = renderToStaticMarkup(
      <Card contentClassName="flex flex-col gap-6">
        <span>child</span>
      </Card>,
    );

    expect(html).toMatch(/class="[^"]*ct-z-base[^"]*flex[^"]*flex-col[^"]*gap-6/);
  });
});

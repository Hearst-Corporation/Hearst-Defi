import { describe, expect, it } from "vitest";

import { makeThinkStripper } from "../createCockpitChatHandler";

describe("makeThinkStripper", () => {
  it("filters a complete <think> block in one chunk", () => {
    const feed = makeThinkStripper();
    expect(
      feed("<think>private reasoning</think>visible reply"),
    ).toBe("visible reply");
  });

  it("filters <think> split across two chunks", () => {
    const feed = makeThinkStripper();
    expect(feed("<think>rea")).toBe("");
    expect(feed("soning</think>reply")).toBe("reply");
  });

  it("passes through text without think tags", () => {
    const feed = makeThinkStripper();
    expect(feed("plain text")).toBe("plain text");
  });

  it("emits text before an unclosed <think>", () => {
    const feed = makeThinkStripper();
    expect(feed("before<think>incomplete")).toBe("before");
  });

  it("filters multiple think blocks in one chunk", () => {
    const feed = makeThinkStripper();
    expect(
      feed(
        "start<think>a</think>mid<think>b</think>end",
      ),
    ).toBe("startmidend");
  });

  it("returns empty on final flush after visible text", () => {
    const feed = makeThinkStripper();
    feed("hello");
    expect(feed("")).toBe("");
  });
});

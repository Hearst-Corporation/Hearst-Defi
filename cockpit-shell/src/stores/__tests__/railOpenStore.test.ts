import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  forceOpen,
  getModeSnapshot,
  getSnapshot,
  toggle,
  toggleWidth,
} from "../railOpenStore";

describe("railOpenStore", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    };
    vi.stubGlobal("window", { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to default mode when storage is empty", () => {
    expect(getModeSnapshot()).toBe("default");
    expect(getSnapshot()).toBe(true);
  });

  it("migrates legacy collapsed flag", () => {
    storage.set("cockpit:rail-right-open", "0");
    expect(getModeSnapshot()).toBe("collapsed");
  });

  it("toggles collapsed and restores last open width", () => {
    toggleWidth();
    expect(getModeSnapshot()).toBe("expanded");
    toggle();
    expect(getModeSnapshot()).toBe("collapsed");
    toggle();
    expect(getModeSnapshot()).toBe("expanded");
  });

  it("cycles default and expanded when open", () => {
    expect(getModeSnapshot()).toBe("default");
    toggleWidth();
    expect(getModeSnapshot()).toBe("expanded");
    toggleWidth();
    expect(getModeSnapshot()).toBe("default");
  });

  it("ignores width toggle when collapsed", () => {
    storage.set("cockpit:rail-right-mode", "collapsed");
    toggleWidth();
    expect(getModeSnapshot()).toBe("collapsed");
  });

  it("forceOpen uncollapses to last open mode", () => {
    storage.set("cockpit:rail-right-mode", "collapsed");
    storage.set("cockpit:rail-right-last-open", "expanded");
    forceOpen();
    expect(getModeSnapshot()).toBe("expanded");
  });
});

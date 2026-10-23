import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../src/engine/events";

type TestEvents = { ping: number; pong: string };

describe("EventBus", () => {
  it("delivers payloads to listeners of that event only", () => {
    const bus = new EventBus<TestEvents>();
    const ping = vi.fn();
    const pong = vi.fn();
    bus.on("ping", ping);
    bus.on("pong", pong);

    bus.emit("ping", 42);

    expect(ping).toHaveBeenCalledWith(42);
    expect(pong).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", () => {
    const bus = new EventBus<TestEvents>();
    const listener = vi.fn();
    const off = bus.on("ping", listener);

    off();
    bus.emit("ping", 1);

    expect(listener).not.toHaveBeenCalled();
  });

  it("lets a listener unsubscribe itself during emit without skipping others", () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const off = bus.on("ping", () => off());
    bus.on("ping", second);

    bus.emit("ping", 1);

    expect(second).toHaveBeenCalledOnce();
  });
});

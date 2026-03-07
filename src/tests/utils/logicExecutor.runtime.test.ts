// @vitest-environment node
/**
 * Runtime path tests for logicExecutor.
 *
 * These run in Node (not jsdom) so that data: URI dynamic imports work.
 * The TypeScript CDN is not hit — we pass pre-compiled JavaScript directly
 * to importCompiledModule and executeInit / executeTrigger.
 */
import { describe, it, expect } from "vitest";
import {
  importCompiledModule,
  formatLogicError,
  type LogicExecutionError,
} from "../../utils/logicExecutor";

// Minimal pre-compiled ES module — the equivalent of what compileLogic produces
// for a class that has both init() and trigger().
const SIMPLE_MODULE_JS = `
export class SimpleLogic {
  async init(data) {
    return { state: { id: data.$identifier, count: 0 } };
  }
  async trigger(data, request, state) {
    return {
      result: { echoed: request.value },
      state: { ...state, count: state.count + 1 },
      events: [],
    };
  }
}
export default SimpleLogic;
`;

// ---------------------------------------------------------------------------
// importCompiledModule
// ---------------------------------------------------------------------------
describe("importCompiledModule", () => {
  it("loads a data: URI module and returns its exports", async () => {
    const mod = await importCompiledModule(SIMPLE_MODULE_JS) as { default: new () => unknown };
    expect(typeof mod.default).toBe("function");
  });

  it("the loaded class can be instantiated and has init + trigger methods", async () => {
    const mod = await importCompiledModule(SIMPLE_MODULE_JS) as { default: new () => Record<string, unknown> };
    const instance = new mod.default();
    expect(typeof instance.init).toBe("function");
    expect(typeof instance.trigger).toBe("function");
  });

  it("init returns a state object", async () => {
    const mod = await importCompiledModule(SIMPLE_MODULE_JS) as { default: new () => { init: (d: object) => Promise<{ state: { id: string } }> } };
    const instance = new mod.default();
    const result = await instance.init({ $identifier: "test-001" });
    expect(result.state.id).toBe("test-001");
  });

  it("trigger returns result, state, and events", async () => {
    const mod = await importCompiledModule(SIMPLE_MODULE_JS) as {
      default: new () => {
        trigger: (d: object, req: object, s: object) => Promise<{ result: { echoed: number }; state: { count: number }; events: unknown[] }>
      }
    };
    const instance = new mod.default();
    const result = await instance.trigger(
      {},
      { value: 42 },
      { count: 0 }
    );
    expect(result.result.echoed).toBe(42);
    expect(result.state.count).toBe(1);
    expect(Array.isArray(result.events)).toBe(true);
  });

  it("handles non-ASCII characters in the source correctly", async () => {
    const unicodeModule = `export default class { greet() { return "héllo wörld"; } }`;
    const mod = await importCompiledModule(unicodeModule) as { default: new () => { greet: () => string } };
    const instance = new mod.default();
    expect(instance.greet()).toBe("héllo wörld");
  });

  it("throws when the module source is invalid JavaScript", async () => {
    await expect(importCompiledModule("this is not valid js }{")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// formatLogicError — included here for completeness (also in the jsdom suite)
// ---------------------------------------------------------------------------
describe("formatLogicError", () => {
  it("formats a LogicExecutionError with correct phase prefix", () => {
    const err: LogicExecutionError = { message: "boom", phase: "compile" };
    expect(formatLogicError(err)).toBe("[compile] boom");
  });

  it("wraps a native Error", () => {
    expect(formatLogicError(new Error("native"))).toBe("native");
  });
});

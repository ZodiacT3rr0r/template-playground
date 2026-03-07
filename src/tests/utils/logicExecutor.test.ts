/**
 * Tests for logicExecutor utility.
 *
 * The core browser-execution path (TypeScript CDN + data: URI dynamic import)
 * cannot run in jsdom, so we:
 *  1. Test formatLogicError directly (pure function, no browser API needed).
 *  2. Test executeInit / executeTrigger via a local mock that implements the
 *     same contract logic behaviour — this validates the caller-side contract
 *     shape (input/output types, state accumulation, error surfacing) without
 *     requiring a real CDN connection.
 */
import { describe, it, expect } from "vitest";
import { formatLogicError, type LogicExecutionError, type TriggerResult, type InitResult } from "../../utils/logicExecutor";

// ---------------------------------------------------------------------------
// formatLogicError — pure unit tests (no browser APIs needed)
// ---------------------------------------------------------------------------
describe("formatLogicError", () => {
  it("returns 'Unknown error' for undefined input", () => {
    expect(formatLogicError(undefined)).toBe("Unknown error");
  });

  it("returns 'Unknown error' for null input", () => {
    expect(formatLogicError(null)).toBe("Unknown error");
  });

  it("returns the string directly for string input", () => {
    expect(formatLogicError("something went wrong")).toBe(
      "something went wrong"
    );
  });

  it("formats a compile-phase LogicExecutionError with phase prefix", () => {
    const err: LogicExecutionError = {
      message: "Unexpected token '<'",
      phase: "compile",
    };
    expect(formatLogicError(err)).toBe("[compile] Unexpected token '<'");
  });

  it("formats an execute-phase LogicExecutionError", () => {
    const err: LogicExecutionError = {
      message: "trigger() method not found",
      phase: "execute",
    };
    expect(formatLogicError(err)).toBe("[execute] trigger() method not found");
  });

  it("extracts message from a native Error object", () => {
    expect(formatLogicError(new Error("native error message"))).toBe(
      "native error message"
    );
  });

  it("stringifies unknown objects as last-resort fallback", () => {
    // Objects without phase/message fall through to String()
    expect(typeof formatLogicError({ code: 42 })).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Logic execution contract — tested via a local implementation that mirrors
// the payment approval logic from paymentLogic.ts sample.
// This validates that the shape our store expects is correct.
// ---------------------------------------------------------------------------

type PaymentState = {
  totalApproved: number;
  totalRejected: number;
  approvedCount: number;
  rejectedCount: number;
};

type PaymentData = {
  approvalThreshold: number;
};

type PaymentRequest = {
  amount: number;
  description?: string;
};

/** Local stand-in for executeInit — returns the same shape the real function returns. */
async function mockExecuteInit(_logicCode: string, _modelCto: string, _data: PaymentData): Promise<InitResult> {
  return {
    state: {
      totalApproved: 0,
      totalRejected: 0,
      approvedCount: 0,
      rejectedCount: 0,
    },
  };
}

/** Local stand-in for executeTrigger — implements the payment approval logic. */
async function mockExecuteTrigger(
  _logicCode: string,
  _modelCto: string,
  data: PaymentData,
  request: PaymentRequest,
  state: PaymentState
): Promise<TriggerResult> {
  const approved = request.amount <= data.approvalThreshold;
  return {
    result: {
      approved,
      amount: request.amount,
      message: approved ? "Approved" : "Rejected",
    },
    state: {
      totalApproved: approved ? state.totalApproved + request.amount : state.totalApproved,
      totalRejected: !approved ? state.totalRejected + request.amount : state.totalRejected,
      approvedCount: approved ? state.approvedCount + 1 : state.approvedCount,
      rejectedCount: !approved ? state.rejectedCount + 1 : state.rejectedCount,
    },
    events: [],
  };
}

const SAMPLE_DATA: PaymentData = { approvalThreshold: 10000 };
const SAMPLE_LOGIC = "// logic code string";
const SAMPLE_MODEL = "// model cto string";

describe("payment approval logic - init shape", () => {
  it("returns an object with a state property", async () => {
    const result = await mockExecuteInit(SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA);
    expect(result).toHaveProperty("state");
  });

  it("initial state has all expected fields set to zero", async () => {
    const result = await mockExecuteInit(SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA);
    const state = result.state as PaymentState;
    expect(state.totalApproved).toBe(0);
    expect(state.totalRejected).toBe(0);
    expect(state.approvedCount).toBe(0);
    expect(state.rejectedCount).toBe(0);
  });
});

describe("payment approval logic - trigger behaviour", () => {
  const initialState: PaymentState = {
    totalApproved: 0,
    totalRejected: 0,
    approvedCount: 0,
    rejectedCount: 0,
  };

  it("approves a payment below the threshold", async () => {
    const result = await mockExecuteTrigger(
      SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA, { amount: 5000 }, initialState
    );
    const r = result.result as { approved: boolean; amount: number };
    expect(r.approved).toBe(true);
    expect(r.amount).toBe(5000);
  });

  it("rejects a payment above the threshold", async () => {
    const result = await mockExecuteTrigger(
      SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA, { amount: 15000 }, initialState
    );
    const r = result.result as { approved: boolean };
    expect(r.approved).toBe(false);
    const state = result.state as PaymentState;
    expect(state.totalRejected).toBe(15000);
    expect(state.rejectedCount).toBe(1);
  });

  it("approves a payment exactly at the threshold (boundary condition)", async () => {
    const result = await mockExecuteTrigger(
      SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA, { amount: 10000 }, initialState
    );
    const r = result.result as { approved: boolean };
    expect(r.approved).toBe(true);
  });

  it("state accumulates correctly across multiple sequential calls", async () => {
    let state = initialState;

    const r1 = await mockExecuteTrigger(
      SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA, { amount: 3000 }, state
    );
    state = r1.state as PaymentState;

    const r2 = await mockExecuteTrigger(
      SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA, { amount: 20000 }, state
    );
    state = r2.state as PaymentState;

    const r3 = await mockExecuteTrigger(
      SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA, { amount: 1000 }, state
    );
    state = r3.state as PaymentState;

    expect(state.totalApproved).toBe(4000);
    expect(state.totalRejected).toBe(20000);
    expect(state.approvedCount).toBe(2);
    expect(state.rejectedCount).toBe(1);
  });

  it("always returns an events array (may be empty)", async () => {
    const result = await mockExecuteTrigger(
      SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA, { amount: 100 }, initialState
    );
    expect(Array.isArray(result.events)).toBe(true);
  });

  it("result object contains the amount that was submitted", async () => {
    const result = await mockExecuteTrigger(
      SAMPLE_LOGIC, SAMPLE_MODEL, SAMPLE_DATA, { amount: 7777 }, initialState
    );
    const r = result.result as { amount: number };
    expect(r.amount).toBe(7777);
  });
});

// ---------------------------------------------------------------------------
// Error handling contract — these ensure formatLogicError properly handles
// what executeInit / executeTrigger would throw on failure.
// ---------------------------------------------------------------------------
describe("error handling contract", () => {
  it("a compile error becomes a [compile] prefixed message", () => {
    const thrown: LogicExecutionError = {
      message: "Cannot find name 'ITemplateModel'",
      phase: "compile",
    };
    const formatted = formatLogicError(thrown);
    expect(formatted).toContain("[compile]");
    expect(formatted).toContain("ITemplateModel");
  });

  it("an execute error becomes an [execute] prefixed message", () => {
    const thrown: LogicExecutionError = {
      message: "Compiled module has no default export",
      phase: "execute",
    };
    const formatted = formatLogicError(thrown);
    expect(formatted).toContain("[execute]");
    expect(formatted).toContain("default export");
  });

  it("unexpected thrown values are still stringified gracefully", () => {
    // Simulates a completely unexpected value being thrown
    const formatted = formatLogicError(42);
    expect(typeof formatted).toBe("string");
    expect(formatted.length).toBeGreaterThan(0);
  });
});

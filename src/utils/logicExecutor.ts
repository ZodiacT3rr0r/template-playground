/**
 * Browser-safe contract logic executor. Replicates TemplateArchiveProcessor
 * in three steps:
 * 1. compile user TypeScript → JS string (via @typescript/vfs + @typescript/twoslash)
 * 2. load that JS as an ES module (via data: URI import)
 * 3. call trigger() / init() on the exported class instance.
 *
 * All heavy imports are dynamic (inside functions) so this module loads
 * cleanly in jsdom test environments without triggering CDN fetches.
 * Do not add module-level side effects — this module is statically imported
 * by the store and must remain safe in jsdom environments.
 *
 * Note: noErrorValidation is set to true in twoslash options, meaning TypeScript
 * type errors in user code are not surfaced — the JS is emitted regardless.
 * This is intentional for the prototype; a future iteration should expose
 * compile diagnostics via the TwoSlashReturn.errors array.
 */

export type TriggerResult = {
  result: object;
  state?: object;
  events?: object[];
};

export type InitResult = {
  state?: object;
};

export type LogicExecutionError = {
  message: string;
  phase: "compile" | "execute";
};

// Mirrors SMART_LEGAL_CONTRACT_BASE64 in template-engine/src/runtime/declarations.ts.
// Prepended to user code so the compiler recognises TemplateLogic, IRequest, IState, etc.
const TEMPLATE_LOGIC_TYPES = `
interface IConcept { $class: string; }
interface ITransaction extends IConcept { $timestamp: Date; }
interface IEvent extends IConcept { $timestamp: Date; }
interface IState { $identifier: string; }
interface EngineResponse<S extends IState> { state?: S; events?: Array<IEvent> }
interface IRequest extends ITransaction {}
interface IResponse extends ITransaction {}
interface IAsset extends IConcept { $identifier: string; }
interface IContract extends IAsset { contractId: string; }
interface IClause extends IAsset { clauseId: string; }
interface TriggerResponse<S extends IState = IState> extends EngineResponse<S> { result: IResponse; }
interface InitResponse<S extends IState> extends EngineResponse<S> {}
type TemplateData = IContract | IClause;
export abstract class TemplateLogic<T extends TemplateData, S extends IState = IState> {
    abstract trigger(data: T, request: IRequest, state: S): Promise<TriggerResponse<S>>;
    abstract init(data: T): Promise<InitResponse<S>>;
}
`;

const TYPESCRIPT_CDN_URL = "https://cdn.jsdelivr.net/npm/typescript@4.9.4/+esm";
const SCRIPT_TARGET = 8; // ES2021
const MODULE_KIND = 6;   // ES2020

function isLogicExecutionError(err: unknown): err is LogicExecutionError {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as LogicExecutionError).phase === "string" &&
    typeof (err as LogicExecutionError).message === "string"
  );
}

async function generateTypescriptFromModel(modelCto: string): Promise<string> {
  const { ModelManager } = await import("@accordproject/concerto-core");
  const { CodeGen } = await import("@accordproject/concerto-codegen");
  const { InMemoryWriter } = await import("@accordproject/concerto-util");
  const modelManager = new ModelManager({ strict: true });
  modelManager.addCTOModel(modelCto, undefined, true);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const visitor = new CodeGen.TypescriptVisitor();
  const writer = new InMemoryWriter();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  modelManager.accept(visitor, { fileWriter: writer });
  const parts: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  writer.getFilesInMemory().forEach((value: string) => parts.push(value));
  return parts.join("\n");
}

export async function compileLogic(
  logicCode: string,
  modelCto: string
): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ts = (await import(/* @vite-ignore */ TYPESCRIPT_CDN_URL)).default;
    if (!ts) {
      throw { message: "Failed to load TypeScript compiler from CDN", phase: "compile" } satisfies LogicExecutionError;
    }

    const { createDefaultMapFromCDN } = await import("@typescript/vfs");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const fsMap: Map<string, string> = await createDefaultMapFromCDN(
      { target: SCRIPT_TARGET },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ts.version as string,
      false,
      ts
    );

    let modelTypes = "";
    try {
      modelTypes = await generateTypescriptFromModel(modelCto);
    } catch (modelErr: unknown) {
      const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
      throw { message: `Model parse failed: ${msg}`, phase: "compile" } satisfies LogicExecutionError;
    }

    // TODO: cache compiled output keyed on (logicCode + modelCto) to avoid
    // a CDN round-trip on every button press. See issue #XXX.
    const combinedSource = [TEMPLATE_LOGIC_TYPES, modelTypes, logicCode].join("\n\n");

    const { twoslasher } = await import("@typescript/twoslash");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, unknown> = {
      fsMap,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      tsModule: ts,
      defaultCompilerOptions: { target: SCRIPT_TARGET, module: MODULE_KIND },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lzstringModule: (await import("lz-string")) as any,
      defaultOptions: { showEmit: true, noErrorValidation: true, showEmittedFile: "code.js" },
    };

    const result = twoslasher(combinedSource, "ts", options);
    if (!result.code) {
      throw { message: "Compilation produced no output", phase: "compile" } satisfies LogicExecutionError;
    }
    return result.code;
  } catch (err: unknown) {
    if (isLogicExecutionError(err)) throw err;
    const message = err instanceof Error ? err.message : "TypeScript compilation failed";
    throw { message, phase: "compile" } satisfies LogicExecutionError;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importCompiledModule(jsCode: string): Promise<any> {
  const bytes = new TextEncoder().encode(jsCode);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const dataUri = "data:text/javascript;base64," + btoa(binary);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return import(/* @vite-ignore */ dataUri);
}

export async function executeInit(
  logicCode: string,
  modelCto: string,
  data: object
): Promise<InitResult> {
  const jsCode = await compileLogic(logicCode, modelCto);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod = await importCompiledModule(jsCode);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const LogicClass = mod.default;
  if (!LogicClass) {
    throw { message: 'Compiled module has no default export. Ensure your class uses "export default".', phase: "execute" } satisfies LogicExecutionError;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const instance = new LogicClass();
  if (typeof instance.init !== "function") return { state: {} };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return ((await instance.init(data)) ?? { state: {} }) as InitResult;
}

export async function executeTrigger(
  logicCode: string,
  modelCto: string,
  data: object,
  request: object,
  state: object
): Promise<TriggerResult> {
  const jsCode = await compileLogic(logicCode, modelCto);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod = await importCompiledModule(jsCode);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const LogicClass = mod.default;
  if (!LogicClass) {
    throw { message: 'Compiled module has no default export. Ensure your class uses "export default".', phase: "execute" } satisfies LogicExecutionError;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const instance = new LogicClass();
  if (typeof instance.trigger !== "function") {
    throw { message: "Compiled class has no trigger() method.", phase: "execute" } satisfies LogicExecutionError;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  return (await instance.trigger(data, request, state)) as TriggerResult;
}

export function formatLogicError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (isLogicExecutionError(err)) return `[${err.phase}] ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

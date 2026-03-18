import type { Serializer } from "@accordproject/concerto-core";
import { Buffer } from "buffer";
import JSZip from "jszip";
import zlibModule from "zlib";

/*
 * Executes template logic in-browser through TemplateArchiveProcessor, matching the APAP server flow:
 * normalize JSON with Serializer.fromJSON()/toJSON(), then call init()/trigger().
 * Deferred for later iterations: compilation caching and web-worker isolation for heavy logic runs.
 * Obligations are passed through and displayed, but their semantic meaning is template-specific.
 */

type JsonObject = Record<string, unknown>;

export type InitResult = { state: JsonObject; obligations: JsonObject[] };
export type TriggerResult = {
  result: JsonObject;
  state: JsonObject;
  events: JsonObject[];
  obligations: JsonObject[];
};

type RuntimeTemplate = {
  getModelManager: () => { updateExternalModels: () => Promise<void> };
  getSerializer: () => Serializer;
  getTemplateModel: () => { getFullyQualifiedName: () => string };
  getResponseTypes: () => unknown[];
  getStateTypes: () => unknown[];
};

type RuntimeModules = {
  Template: {
    fromArchive: (archive: Buffer) => Promise<unknown>;
  };
  TemplateArchiveProcessor: new (template: unknown) => {
    init: (data: object) => Promise<{ state?: object }>;
    trigger: (data: object, request: object, state: object) => Promise<{ result: object; state?: object; events?: object[] }>;
  };
};

const SERIALIZER_OPTIONS = {
  acceptResourcesForRelationships: false,
  validate: false,
  strictQualifiedDateTimes: true,
};

let runtimeModulesPromise: Promise<RuntimeModules> | undefined;

function patchUtilTextEncoding() {
  // util is aliased to src/polyfills/util.cjs in Vite config.
  // Keep global constructors present for any runtime paths that read directly from globalThis.
  if (typeof globalThis.TextEncoder !== "function" || typeof globalThis.TextDecoder !== "function") {
    return;
  }
}

function patchZlibConstants() {
  const zlibObject = ((zlibModule as unknown as { default?: Record<string, unknown> }).default ?? zlibModule) as Record<string, unknown>;

  if (zlibObject.constants && typeof zlibObject.constants === "object") {
    return;
  }

  // browserify-zlib exposes Z_* values at top-level, while axios expects zlib.constants.
  const constants: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(zlibObject)) {
    if (key.startsWith("Z_") || key.startsWith("BROTLI_")) {
      constants[key] = value;
    }
  }

  zlibObject.constants = constants;
}

async function getRuntimeModules(): Promise<RuntimeModules> {
  if (!runtimeModulesPromise) {
    runtimeModulesPromise = (async () => {
      patchUtilTextEncoding();
      patchZlibConstants();
      const [ciceroCore, templateEngine] = await Promise.all([
        import("@accordproject/cicero-core"),
        import("@accordproject/template-engine"),
      ]);

      const templateCtor =
        (ciceroCore as unknown as { Template?: RuntimeModules["Template"]; default?: { Template?: RuntimeModules["Template"] } }).Template ??
        (ciceroCore as unknown as { default?: { Template?: RuntimeModules["Template"] } }).default?.Template;
      const archiveProcessorCtor =
        (templateEngine as unknown as { TemplateArchiveProcessor?: RuntimeModules["TemplateArchiveProcessor"]; default?: { TemplateArchiveProcessor?: RuntimeModules["TemplateArchiveProcessor"] } }).TemplateArchiveProcessor ??
        (templateEngine as unknown as { default?: { TemplateArchiveProcessor?: RuntimeModules["TemplateArchiveProcessor"] } }).default?.TemplateArchiveProcessor;

      if (!templateCtor || !archiveProcessorCtor) {
        throw new Error("Failed to load Accord runtime modules");
      }

      return {
        Template: templateCtor,
        TemplateArchiveProcessor: archiveProcessorCtor,
      };
    })();
  }
  return runtimeModulesPromise;
}

async function createRuntime(logicCode: string, modelCto: string) {
  const { Template, TemplateArchiveProcessor } = await getRuntimeModules();
  const zip = new JSZip();
  zip.file("package.json", JSON.stringify({
    name: "playground-logic-template",
    version: "0.0.1",
    accordproject: { runtime: "typescript", template: "clause", cicero: "^0.25.0" },
  }));
  zip.file("text/grammar.tem.md", "Logic runtime placeholder.");
  zip.file("model/model.cto", modelCto);
  zip.file("logic/logic.ts", logicCode);

  const archive = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
  const template = await Template.fromArchive(archive);
  const runtimeTemplate = template as unknown as RuntimeTemplate;
  await runtimeTemplate.getModelManager().updateExternalModels();

  return {
    processor: new TemplateArchiveProcessor(template),
    serializer: runtimeTemplate.getSerializer(),
    templateType: runtimeTemplate.getTemplateModel().getFullyQualifiedName(),
    responseType: (runtimeTemplate.getResponseTypes()[0] as string | undefined) ?? undefined,
    stateType: (runtimeTemplate.getStateTypes()[0] as string | undefined) ?? undefined,
  };
}

function normalizeObject(serializer: Serializer, value: unknown, fallbackClass?: string): JsonObject {
  if (!value || typeof value !== "object") {
    throw new Error("Expected a JSON object");
  }
  const data = { ...(value as JsonObject) };
  if (typeof data.$class !== "string" && fallbackClass) {
    data.$class = fallbackClass;
  }
  if (typeof data.$class !== "string") {
    return data;
  }
  const instance = serializer.fromJSON(data, SERIALIZER_OPTIONS);
  return serializer.toJSON(instance) as JsonObject;
}

function normalizeArray(serializer: Serializer, value: unknown): JsonObject[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => normalizeObject(serializer, entry));
}

export async function executeInit(logicCode: string, modelCto: string, data: object): Promise<InitResult> {
  const runtime = await createRuntime(logicCode, modelCto);
  const contractData = normalizeObject(runtime.serializer, data, runtime.templateType);
  let initResult;
  try {
    initResult = await runtime.processor.init(contractData);
  } catch (error) {
    if (formatLogicError(error).includes("is not a function")) {
      return { state: {}, obligations: [] };
    }
    throw error;
  }

  return {
    state: initResult?.state ? normalizeObject(runtime.serializer, initResult.state, runtime.stateType) : {},
    obligations: [],
  };
}

export async function executeTrigger(
  logicCode: string,
  modelCto: string,
  data: object,
  request: object,
  state: object,
): Promise<TriggerResult> {
  const runtime = await createRuntime(logicCode, modelCto);
  const contractData = normalizeObject(runtime.serializer, data, runtime.templateType);
  const requestData = normalizeObject(runtime.serializer, request);
  const requiresInit = /\binit\s*\(/.test(logicCode);
  if (requiresInit && runtime.stateType && Object.keys(state).length === 0) {
    throw new Error("Call init() before trigger() for stateful templates");
  }
  const stateData = normalizeObject(runtime.serializer, state, runtime.stateType);
  const triggerResult = await runtime.processor.trigger(contractData, requestData, stateData);
  const resultWithObligations = triggerResult as TriggerResult & { obligations?: unknown };

  return {
    result: normalizeObject(runtime.serializer, triggerResult.result, runtime.responseType),
    state: triggerResult.state
      ? normalizeObject(runtime.serializer, triggerResult.state, runtime.stateType)
      : (state as JsonObject),
    events: normalizeArray(runtime.serializer, triggerResult.events),
    obligations: normalizeArray(runtime.serializer, resultWithObligations.obligations),
  };
}

export function formatLogicError(err: unknown): string {
  if (typeof err === "string") {
    return err;
  }
  if (err instanceof Error) {
    return err.message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

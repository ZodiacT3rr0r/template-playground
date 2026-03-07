import { lazy, Suspense, useMemo, useCallback } from "react";
import type { editor } from "monaco-editor";
import useAppStore from "../../store/store";
import { useMonacoThemes } from "../useMonacoThemes";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.Editor }))
);

/**
 * Monaco editor for TypeScript contract logic.
 * Wired to editorLogicCode in the store. Provides "Init Contract" and
 * "Trigger" buttons that dispatch executeInit / executeTrigger.
 */
function LogicEditor() {
  const editorLogicCode = useAppStore((state) => state.editorLogicCode);
  const setEditorLogicCode = useAppStore((state) => state.setEditorLogicCode);
  const setLogicCode = useAppStore((state) => state.setLogicCode);
  const executeInit = useAppStore((state) => state.executeInit);
  const executeTrigger = useAppStore((state) => state.executeTrigger);
  const isExecutingLogic = useAppStore((state) => state.isExecutingLogic);
  const executingAction = useAppStore((state) => state.executingAction);

  const backgroundColor = useAppStore((state) => state.backgroundColor);
  const textColor = useAppStore((state) => state.textColor);
  const showLineNumbers = useAppStore((state) => state.showLineNumbers);

  const { themeName, isDark } = useMonacoThemes(backgroundColor, textColor);

  const options: editor.IStandaloneEditorConstructionOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      wordWrap: "on" as const,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      lineNumbers: showLineNumbers ? "on" : "off",
    }),
    [showLineNumbers]
  );

  const handleEditorDidMount = useCallback(
    (_editorInstance: editor.IStandaloneCodeEditor) => {
      setLogicCode(editorLogicCode);
    },
    [setLogicCode, editorLogicCode]
  );

  const handleChange = useCallback(
    (val: string | undefined) => {
      const v = val ?? "";
      setEditorLogicCode(v);
      setLogicCode(v);
    },
    [setEditorLogicCode, setLogicCode]
  );

  const buttonBase =
    "px-3 py-1 text-xs font-medium rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const initBtn = isDark
    ? `${buttonBase} bg-blue-700 hover:bg-blue-600 text-white border-blue-600`
    : `${buttonBase} bg-blue-600 hover:bg-blue-700 text-white border-blue-700`;
  const triggerBtn = isDark
    ? `${buttonBase} bg-green-700 hover:bg-green-600 text-white border-green-600 ml-2`
    : `${buttonBase} bg-green-600 hover:bg-green-700 text-white border-green-700 ml-2`;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Action toolbar */}
      <div
        className="flex items-center px-2 py-1 gap-1 border-b"
        style={{
          backgroundColor: isDark ? "#1e1e2e" : "#f8f8f8",
          borderColor: isDark ? "#333" : "#ddd",
        }}
      >
        <button
          className={initBtn}
          disabled={isExecutingLogic}
          onClick={() => void executeInit()}
          title="Initialize contract state by calling init(data)"
        >
          {executingAction === "init" ? "Running…" : "Init Contract"}
        </button>
        <button
          className={triggerBtn}
          disabled={isExecutingLogic}
          onClick={() => void executeTrigger()}
          title="Execute trigger(data, request, state)"
        >
          {executingAction === "trigger" ? "Running…" : "Trigger"}
        </button>
      </div>
      {/* Monaco editor */}
      <div className="editorwrapper flex-1 w-full">
        <Suspense fallback={<div>Loading Editor…</div>}>
          <MonacoEditor
            language="typescript"
            height="100%"
            value={editorLogicCode}
            options={options}
            onMount={handleEditorDidMount}
            onChange={handleChange}
            theme={themeName}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default LogicEditor;

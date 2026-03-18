import { lazy, Suspense, useMemo } from "react";
import useAppStore from "../../store/store";
import * as monaco from "monaco-editor";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.Editor }))
);

function LogicEditor() {
  const editorLogicCode = useAppStore((state) => state.editorLogicCode);
  const setEditorLogicCode = useAppStore((state) => state.setEditorLogicCode);
  const setLogicCode = useAppStore((state) => state.setLogicCode);
  const executeInit = useAppStore((state) => state.executeInit);
  const executeTrigger = useAppStore((state) => state.executeTrigger);
  const isExecutingLogic = useAppStore((state) => state.isExecutingLogic);
  const executingAction = useAppStore((state) => state.executingAction);
  const backgroundColor = useAppStore((state) => state.backgroundColor);
  const showLineNumbers = useAppStore((state) => state.showLineNumbers);

  const themeName = backgroundColor === "#121212" ? "darkTheme" : "lightTheme";

  const options: monaco.editor.IStandaloneEditorConstructionOptions = useMemo(() => ({
    minimap: { enabled: false },
    wordWrap: "on",
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: showLineNumbers ? "on" : "off",
  }), [showLineNumbers]);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditorLogicCode(value);
      setLogicCode(value);
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700">
        <button
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={() => void executeInit()}
          disabled={isExecutingLogic}
        >
          {executingAction === "init" ? "Running..." : "Init Contract"}
        </button>
        <button
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          onClick={() => void executeTrigger()}
          disabled={isExecutingLogic}
        >
          {executingAction === "trigger" ? "Running..." : "Trigger"}
        </button>
      </div>
      <div className="flex-1">
        <Suspense fallback={<div>Loading Editor...</div>}>
          <MonacoEditor
            options={options}
            language="typescript"
            height="100%"
            value={editorLogicCode}
            onChange={handleChange}
            theme={themeName}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default LogicEditor;

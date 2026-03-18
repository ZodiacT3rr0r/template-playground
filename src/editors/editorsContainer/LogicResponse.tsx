import { lazy, Suspense, useMemo } from "react";
import useAppStore from "../../store/store";
import * as monaco from "monaco-editor";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.Editor }))
);

function ReadOnlyPanel({ title, value, themeName }: { title: string; value: string; themeName: string }) {
  const options: monaco.editor.IStandaloneEditorConstructionOptions = useMemo(() => ({
    minimap: { enabled: false },
    wordWrap: "on",
    automaticLayout: true,
    readOnly: true,
    domReadOnly: true,
    contextmenu: false,
    lineNumbers: "off",
    scrollBeyondLastLine: false,
  }), []);

  return (
    <div className="flex flex-col min-h-0 border border-gray-200 dark:border-gray-700 rounded">
      <div className="px-2 py-1 text-xs font-semibold border-b border-gray-200 dark:border-gray-700">{title}</div>
      <div className="flex-1 min-h-[120px]">
        <Suspense fallback={<div>Loading Editor...</div>}>
          <MonacoEditor
            options={options}
            language="json"
            height="100%"
            value={value || ""}
            theme={themeName}
          />
        </Suspense>
      </div>
    </div>
  );
}

function LogicResponse() {
  const responseJson = useAppStore((state) => state.responseJson);
  const contractState = useAppStore((state) => state.contractState);
  const emittedEvents = useAppStore((state) => state.emittedEvents);
  const obligationsJson = useAppStore((state) => state.obligationsJson);
  const logicError = useAppStore((state) => state.logicError);
  const isExecutingLogic = useAppStore((state) => state.isExecutingLogic);
  const backgroundColor = useAppStore((state) => state.backgroundColor);

  const themeName = backgroundColor === "#121212" ? "darkTheme" : "lightTheme";

  return (
    <div className="h-full flex flex-col gap-2 p-2">
      {logicError && (
        <div className="text-sm border border-red-400 bg-red-50 text-red-700 rounded p-2">{logicError}</div>
      )}
      {isExecutingLogic && (
        <div className="text-sm border border-green-400 bg-green-50 text-green-700 rounded p-2">Executing logic...</div>
      )}
      <div className="grid grid-cols-1 gap-2 flex-1 min-h-0">
        <ReadOnlyPanel title="Response" value={responseJson} themeName={themeName} />
        <ReadOnlyPanel title="Contract State" value={contractState} themeName={themeName} />
        <ReadOnlyPanel title="Emitted Events" value={emittedEvents} themeName={themeName} />
        {obligationsJson ? (
          <ReadOnlyPanel title="Obligations" value={obligationsJson} themeName={themeName} />
        ) : null}
      </div>
    </div>
  );
}

export default LogicResponse;

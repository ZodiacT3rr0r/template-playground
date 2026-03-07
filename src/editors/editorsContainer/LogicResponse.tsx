import { lazy, Suspense, useMemo } from "react";
import type { editor } from "monaco-editor";
import useAppStore from "../../store/store";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.Editor }))
);

/**
 * A read-only JSON viewer panel.
 */
function ReadOnlyJsonPanel({
  value,
  backgroundColor,
}: {
  value: string;
  backgroundColor: string;
}) {
  const isDark = backgroundColor !== "#ffffff";
  const themeName = isDark ? "darkTheme" : "lightTheme";

  const options: editor.IStandaloneEditorConstructionOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      wordWrap: "on" as const,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      readOnly: true,
      lineNumbers: "off" as const,
      domReadOnly: true,
      contextmenu: false,
      scrollbar: { vertical: "auto", horizontal: "hidden" },
    }),
    []
  );

  return (
    <div className="editorwrapper h-full w-full">
      <Suspense fallback={<div>Loading…</div>}>
        <MonacoEditor
          language="json"
          height="100%"
          value={value || "// No output yet"}
          options={options}
          theme={themeName}
        />
      </Suspense>
    </div>
  );
}

/**
 * Three read-only panels showing the result of logic execution:
 * - Response (result object from trigger)
 * - Contract State (state object)
 * - Emitted Events (events array)
 *
 * Shows an error banner when logicError is set.
 */
function LogicResponse() {
  const responseJson = useAppStore((state) => state.responseJson);
  const contractState = useAppStore((state) => state.contractState);
  const emittedEvents = useAppStore((state) => state.emittedEvents);
  const logicError = useAppStore((state) => state.logicError);
  const isExecutingLogic = useAppStore((state) => state.isExecutingLogic);
  const backgroundColor = useAppStore((state) => state.backgroundColor);
  const textColor = useAppStore((state) => state.textColor);

  const isDark = backgroundColor !== "#ffffff";

  const sectionHeaderStyle = {
    backgroundColor: isDark ? "#1e1e2e" : "#f0f0f0",
    color: textColor,
    borderColor: isDark ? "#333" : "#ddd",
  };

  const errorBannerStyle = {
    backgroundColor: isDark ? "#3b1f1f" : "#fff0f0",
    borderColor: isDark ? "#7a2929" : "#f5c6c6",
    color: isDark ? "#f87171" : "#b91c1c",
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Error banner */}
      {logicError && (
        <div
          className="px-3 py-2 text-xs font-mono border-b rounded-sm mx-2 mt-1 mb-1"
          style={errorBannerStyle}
        >
          <span className="font-bold">Logic Error: </span>
          {logicError}
        </div>
      )}

      {/* Executing indicator */}
      {isExecutingLogic && (
        <div
          className="px-3 py-1 text-xs border-b"
          style={{
            backgroundColor: isDark ? "#1e2a1e" : "#f0fff0",
            color: isDark ? "#86efac" : "#166534",
            borderColor: isDark ? "#333" : "#ddd",
          }}
        >
          Executing logic…
        </div>
      )}

      {/* Response panel */}
      <div className="flex flex-col" style={{ flex: "1 1 33%" }}>
        <div
          className="px-2 py-0.5 text-xs font-semibold border-b"
          style={sectionHeaderStyle}
        >
          Response
        </div>
        <div className="flex-1">
          <ReadOnlyJsonPanel
            value={responseJson}
            backgroundColor={backgroundColor}
          />
        </div>
      </div>

      <div className="border-t" style={{ borderColor: isDark ? "#333" : "#ddd" }} />

      {/* State panel */}
      <div className="flex flex-col" style={{ flex: "1 1 33%" }}>
        <div
          className="px-2 py-0.5 text-xs font-semibold border-b"
          style={sectionHeaderStyle}
        >
          Contract State
        </div>
        <div className="flex-1">
          <ReadOnlyJsonPanel
            value={contractState}
            backgroundColor={backgroundColor}
          />
        </div>
      </div>

      <div className="border-t" style={{ borderColor: isDark ? "#333" : "#ddd" }} />

      {/* Events panel */}
      <div className="flex flex-col" style={{ flex: "1 1 33%" }}>
        <div
          className="px-2 py-0.5 text-xs font-semibold border-b"
          style={sectionHeaderStyle}
        >
          Emitted Events
        </div>
        <div className="flex-1">
          <ReadOnlyJsonPanel
            value={emittedEvents}
            backgroundColor={backgroundColor}
          />
        </div>
      </div>
    </div>
  );
}

export default LogicResponse;

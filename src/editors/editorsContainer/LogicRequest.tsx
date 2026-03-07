import { useCallback } from "react";
import JSONEditor from "../JSONEditor";
import useAppStore from "../../store/store";

/**
 * JSON editor for the logic trigger request payload.
 * Wired to editorRequestJson / requestJson in the store.
 */
function LogicRequest() {
  const editorRequestJson = useAppStore((state) => state.editorRequestJson);
  const setEditorRequestJson = useAppStore(
    (state) => state.setEditorRequestJson
  );
  const setRequestJson = useAppStore((state) => state.setRequestJson);

  const handleChange = useCallback(
    (val: string | undefined) => {
      const v = val ?? "{}";
      setEditorRequestJson(v);
      setRequestJson(v);
    },
    [setEditorRequestJson, setRequestJson]
  );

  return <JSONEditor value={editorRequestJson} onChange={handleChange} />;
}

export default LogicRequest;

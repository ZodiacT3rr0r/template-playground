import JSONEditor from "../JSONEditor";
import useAppStore from "../../store/store";

function LogicRequest() {
  const editorRequestJson = useAppStore((state) => state.editorRequestJson);
  const setEditorRequestJson = useAppStore((state) => state.setEditorRequestJson);
  const setRequestJson = useAppStore((state) => state.setRequestJson);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditorRequestJson(value);
      setRequestJson(value);
    }
  };

  return <JSONEditor value={editorRequestJson} onChange={handleChange} />;
}

export default LogicRequest;

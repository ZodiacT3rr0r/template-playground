import { useEffect } from "react";
import { useMonaco } from "@monaco-editor/react";

/**
 * Registers the shared "lightTheme" and "darkTheme" Monaco themes and keeps
 * them in sync whenever the playground colour scheme changes.
 *
 * Call this in every component that renders a Monaco editor with a custom
 * theme so that the theme is guaranteed to be registered before first paint,
 * regardless of component mount order.
 */
export function useMonacoThemes(backgroundColor: string, textColor: string) {
  const monaco = useMonaco();

  const isDark = backgroundColor !== "#ffffff";
  const themeName = isDark ? "darkTheme" : "lightTheme";

  useEffect(() => {
    if (!monaco) return;
    const define = (name: string, base: "vs" | "vs-dark") => {
      monaco.editor.defineTheme(name, {
        base,
        inherit: true,
        rules: [],
        colors: {
          "editor.background": backgroundColor,
          "editor.foreground": textColor,
          "editor.lineHighlightBorder": "#EDE8DC",
          "editorGhostText.foreground": "#9c9a9a",
        },
      });
    };
    define("lightTheme", "vs");
    define("darkTheme", "vs-dark");
    monaco.editor.setTheme(themeName);
  }, [monaco, backgroundColor, textColor, themeName]);

  return { themeName, isDark };
}

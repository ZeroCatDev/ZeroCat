"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastEditorLike = {
  getMarkdown: () => string;
  setMarkdown: (markdown: string, cursorToEnd?: boolean) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  destroy: () => void;
};

export function ToastEditorPane({
  initialValue,
  onChange,
  className,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<ToastEditorLike | null>(null);
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    let canceled = false;
    let localEditor: ToastEditorLike | null = null;
    const rootElement = rootRef.current;

    async function mount() {
      if (!rootElement) return;
      const { default: ToastEditorCtor } = await import("@toast-ui/editor");
      if (canceled || !rootElement) return;

      const editor = new ToastEditorCtor({
        el: rootElement,
        initialValue: initialValue || "",
        initialEditType: "markdown",
        previewStyle: "vertical",
        height: "640px",
        usageStatistics: false,
      }) as ToastEditorLike;

      editor.on("change", () => {
        onChangeRef.current(editor.getMarkdown());
      });

      editorRef.current = editor;
      localEditor = editor;
    }

    void mount();

    return () => {
      canceled = true;
      const editor = editorRef.current ?? localEditor;
      editorRef.current = null;
      if (editor) {
        editor.destroy();
      }
      if (rootElement) {
        rootElement.innerHTML = "";
      }
    };
  }, []); // Only run once on mount

  return (
    <div className={cn("overflow-hidden rounded-xl ring-border", className)}>
      <div ref={rootRef} className="min-h-[640px]" />
    </div>
  );
}

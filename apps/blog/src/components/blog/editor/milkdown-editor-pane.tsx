"use client";

import * as React from "react";
import { Crepe } from "@milkdown/crepe";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/upload";

export function MilkdownEditorPane({
  initialValue,
  onChange,
  className,
  token,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  className?: string;
  token?: string | null;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<Crepe | null>(null);
  const onChangeRef = React.useRef(onChange);
  const tokenRef = React.useRef(token);
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  React.useEffect(() => {
    let canceled = false;
    let localEditor: Crepe | null = null;
    const rootElement = rootRef.current;

    async function mount() {
      if (!rootElement) return;

      const editor = new Crepe({
        root: rootElement,
        defaultValue: initialValue || "",
        features: {
          [Crepe.Feature.ImageBlock]: true,
        },
        featureConfigs: {
          [Crepe.Feature.ImageBlock]: {
            onUpload: async (file: File) => (await uploadImage(file, tokenRef.current)).url,
            blockOnUpload: async (file: File) =>
              (await uploadImage(file, tokenRef.current)).url,
            inlineOnUpload: async (file: File) =>
              (await uploadImage(file, tokenRef.current)).url,
          },
        },
      });

      editor.on((listener) => {
        listener.markdownUpdated((_ctx, markdown) => {
          onChangeRef.current(markdown);
        });
      });

      await editor.create();

      if (canceled) {
        await editor.destroy();
        return;
      }

      editorRef.current = editor;
      localEditor = editor;
    }

    void mount();

    return () => {
      canceled = true;
      const editor = editorRef.current ?? localEditor;
      editorRef.current = null;
      if (editor) {
        void editor.destroy();
      }
      if (rootElement) {
        rootElement.innerHTML = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={cn(
        "milkdown-editor-root relative h-full w-full overflow-auto",
        isDark && "dark",
        className
      )}
    >
      <div ref={rootRef} className="milkdown h-full w-full" />
    </div>
  );
}

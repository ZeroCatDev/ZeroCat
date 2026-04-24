"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/upload";

export function CoverUpload({
  value,
  onChange,
  token,
  className,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  token?: string | null;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const handleFile = React.useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("请选择图片文件");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("图片大小不能超过 10MB");
        return;
      }

      setUploading(true);
      setProgress(15);
      const tick = window.setInterval(
        () => setProgress((p) => (p < 85 ? p + 6 : p)),
        180
      );

      try {
        const asset = await uploadImage(file, token);
        setProgress(100);
        onChange(asset.url);
        toast.success("封面已上传");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "上传失败");
      } finally {
        window.clearInterval(tick);
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
        }, 300);
      }
    },
    [onChange, token]
  );

  const onPick = React.useCallback(() => inputRef.current?.click(), []);

  const onDrop = React.useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />

      {value ? (
        <div className="group relative aspect-[16/9] overflow-hidden rounded-xl bg-muted ring-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="封面" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Button size="sm" variant="secondary" onClick={onPick} disabled={uploading}>
              <ImagePlus className="h-4 w-4" />
              更换
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onChange(null)}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
              移除
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          disabled={uploading}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-all hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-70 dark:hover:bg-accent/40"
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">上传中...</p>
            </>
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <p className="text-sm font-medium">上传文章封面</p>
              <p className="text-xs">点击选择，或拖放图片到这里</p>
            </>
          )}
        </button>
      )}

      {uploading && progress > 0 && (
        <Progress value={progress} className="h-1" />
      )}
    </div>
  );
}

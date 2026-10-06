"use client";

import { ArrowUp, ImageIcon, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { ACCEPT_ATTR, ImagePrepError, isAcceptedImage, prepareImage, type PreparedImage } from "@/lib/image-prep";
import { LIMITS } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function Composer({
  onSend,
  imagesEnabled = false,
  disabled,
  placeholder = "Write a message…",
}: {
  onSend: (body: string, image?: PreparedImage) => Promise<void>;
  imagesEnabled?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const max = LIMITS.message.max;
  const trimmed = value.trim();
  const over = value.length > max;
  const canSend = (Boolean(trimmed) || Boolean(image)) && !over && !disabled && !preparing;

  // Auto-grow up to ~8 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  async function attach(file: File | undefined | null) {
    if (!file || !imagesEnabled || disabled) return;
    if (!isAcceptedImage(file)) {
      toast.error("Only images can be shared: PNG, JPEG, WebP, GIF or HEIC.");
      return;
    }
    setPreparing(true);
    try {
      const prepared = await prepareImage(file);
      setImage((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return prepared;
      });
      ref.current?.focus();
    } catch (err) {
      toast.error(err instanceof ImagePrepError ? err.message : "Couldn't read that image.");
    } finally {
      setPreparing(false);
    }
  }

  function clearImage() {
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
  }

  function submit() {
    if (!canSend) return;
    const body = value;
    const attached = image ?? undefined;
    setValue("");
    setImage(null); // ownership of the preview URL passes to the pending message
    ref.current?.focus();
    onSend(body, attached).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 429) toast.error("You're sending too quickly. Give it a moment.");
      else if (err instanceof ApiError && [400, 413, 503].includes(err.status)) toast.error(err.message);
    });
  }

  return (
    <div
      className={cn("relative border-t border-border/70 bg-background/80 backdrop-blur-xl pb-safe", dragging && "bg-brand-soft")}
      onDragOver={(e) => {
        if (!imagesEnabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!imagesEnabled) return;
        e.preventDefault();
        setDragging(false);
        void attach(e.dataTransfer.files[0]);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand/50 text-sm font-medium text-brand">
          <ImagePlus className="size-4" aria-hidden="true" /> Drop image to attach
        </div>
      )}

      {(image || preparing) && (
        <div className="mx-auto flex w-full max-w-3xl px-3 pt-3 sm:px-6">
          <div className="relative flex items-center gap-3 rounded-xl border border-border bg-card p-2 pr-3 animate-message-in">
            {preparing ? (
              <div className="grid size-14 place-items-center rounded-lg bg-muted">
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Preparing image" />
              </div>
            ) : image?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob: preview
              <img src={image.previewUrl} alt="Attachment preview" className="size-14 rounded-lg object-cover" />
            ) : (
              <div className="grid size-14 place-items-center rounded-lg bg-muted">
                <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            <div className="text-xs leading-relaxed text-muted-foreground">
              {preparing ? (
                "Preparing…"
              ) : (
                <>
                  <span className="font-medium text-foreground">Image attached</span>
                  <br />
                  Location and camera data are removed before sending
                </>
              )}
            </div>
            {image && (
              <Button
                type="button"
                size="icon-xs"
                variant="secondary"
                className="absolute -top-2 -right-2 rounded-full border border-border"
                onClick={clearImage}
                aria-label="Remove attachment"
              >
                <X />
              </Button>
            )}
          </div>
        </div>
      )}

      <form
        className="mx-auto flex w-full max-w-3xl items-end gap-2 px-3 pt-3 sm:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {imagesEnabled && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void attach(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-11 shrink-0 rounded-2xl text-muted-foreground hover:text-foreground"
              onClick={() => fileInput.current?.click()}
              disabled={disabled || preparing}
              aria-label="Attach image"
            >
              <ImagePlus className="size-5" />
            </Button>
          </>
        )}
        <div
          className={cn(
            "flex min-h-11 flex-1 items-end rounded-2xl border border-input bg-card px-3.5 py-2.5 transition-colors focus-within:border-brand/40 focus-within:ring-3 focus-within:ring-ring/25",
            over && "border-destructive/50",
          )}
        >
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <textarea
            id="composer"
            ref={ref}
            rows={1}
            value={value}
            disabled={disabled}
            placeholder={disabled ? "This chat is no longer live" : image ? "Add a caption…" : placeholder}
            onChange={(e) => setValue(e.target.value)}
            onPaste={(e) => {
              const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
              if (file && imagesEnabled) {
                e.preventDefault();
                void attach(file);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[200px] flex-1 resize-none bg-transparent text-base leading-6 sm:text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            autoComplete="off"
            enterKeyHint="send"
          />
          {value.length > max * 0.8 && (
            <span className={cn("ml-2 shrink-0 self-end font-mono text-[0.65rem] tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
              {max - value.length}
            </span>
          )}
        </div>
        <Button type="submit" size="icon-lg" className="size-11 shrink-0 rounded-2xl" disabled={!canSend} aria-label="Send message">
          <ArrowUp className="size-5" />
        </Button>
      </form>
      <p className="mx-auto hidden w-full max-w-3xl px-6 pt-1.5 text-[0.7rem] text-muted-foreground sm:block">
        <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for a new line
        {imagesEnabled && " · paste or drop an image"} · nothing here is kept after the chat ends
      </p>
    </div>
  );
}

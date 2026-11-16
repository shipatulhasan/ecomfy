"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CircleXIcon, ImageIcon, RefreshCwIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { AddImageTile, UploadTaskTile } from "@/components/admin/media/upload-tile";
import { useUploader } from "@/components/admin/media/use-uploader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MediaItem } from "@/lib/admin/media";
import { UPLOAD_ACCEPT } from "@/lib/media/upload-rules";
import { cn } from "@/lib/utils";

export type FormImage = { mediaId: string; alt: string; variantKey: string | null };

const NO_VARIANT = "__all";

/**
 * Add Products.png → "Upload Product Image": the selected image large (Browse
 * from the library, Replace with a new upload), thumbnails with ✕, and the dashed
 * "Add Image" tile (click or drop). Thumbnails drag to reorder (pointer, touch,
 * keyboard); the first is the main image on the store. The selected image's alt
 * text and variant are edited under the preview.
 */
export function ProductImages({
  images,
  media,
  variants,
  maxMb,
  disabled,
  onChange,
  onMedia,
}: {
  images: FormImage[];
  media: Record<string, MediaItem>;
  variants: { key: string; name: string }[];
  maxMb: number;
  disabled?: boolean;
  onChange: (images: FormImage[]) => void;
  onMedia: (items: MediaItem[]) => void;
}) {
  const dndId = useId(); // stable DndContext ids: no SSR/hydration mismatch
  const [selected, setSelected] = useState(0);
  const replaceAt = useRef<number | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  // Latest list for async upload callbacks.
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  });

  const uploader = useUploader({
    scope: "tmp",
    maxMb,
    onUploaded: (m) => {
      onMedia([m]);
      const list = latest.current;
      const at = replaceAt.current;
      if (at !== null && list[at]) {
        replaceAt.current = null;
        onChange(list.map((img, i) => (i === at ? { mediaId: m.id, alt: m.alt || img.alt, variantKey: img.variantKey } : img)));
      } else {
        onChange([...list, { mediaId: m.id, alt: m.alt, variantKey: null }]);
      }
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const current = Math.min(selected, Math.max(0, images.length - 1));
  const main = images[current];
  const mainMedia = main ? media[main.mediaId] : undefined;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = images.findIndex((i) => i.mediaId === active.id);
    const to = images.findIndex((i) => i.mediaId === over.id);
    const next = arrayMove(images, from, to);
    onChange(next);
    setSelected(next.findIndex((i) => i.mediaId === images[current]?.mediaId));
  };

  const remove = (i: number) => {
    onChange(images.filter((_, n) => n !== i));
    setSelected((s) => (s > i ? s - 1 : Math.min(s, images.length - 2)));
  };
  const patch = (i: number, p: Partial<FormImage>) => onChange(images.map((img, n) => (n === i ? { ...img, ...p } : img)));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span id="product-images-label" className="text-lead font-medium text-foreground">
          Product Image
        </span>
        <div className="relative grid h-66.5 place-items-center overflow-hidden rounded-xl border border-border bg-card">
          {mainMedia ? (
            <Image
              src={mainMedia.url}
              alt={main?.alt || mainMedia.originalName}
              fill
              sizes="(width >= 64rem) 440px, 100vw"
              placeholder={mainMedia.blurDataURL ? "blur" : "empty"}
              blurDataURL={mainMedia.blurDataURL ?? undefined}
              className="object-contain p-4 pb-14"
            />
          ) : (
            <p className="px-6 text-center text-copy text-muted-foreground">No images yet. Add one below, or browse the library.</p>
          )}
          {current === 0 && mainMedia && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-caption font-bold text-primary-foreground">
              <StarIcon aria-hidden className="size-3 fill-current" /> Main image
            </span>
          )}
          <MediaPicker
            attached={new Set(images.map((i) => i.mediaId))}
            onPick={(items) => {
              onMedia(items);
              onChange([...images, ...items.map((m) => ({ mediaId: m.id, alt: m.alt, variantKey: null }))]);
            }}
            trigger={
              <button
                type="button"
                disabled={disabled}
                className="absolute bottom-3 left-3 inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-copy text-text-body shadow-sm hover:bg-muted disabled:opacity-50"
              >
                <ImageIcon aria-hidden className="size-5 fill-text-body stroke-card" /> Browse
              </button>
            }
          />
          {mainMedia && (
            <button
              type="button"
              disabled={disabled || uploader.busy}
              onClick={() => {
                replaceAt.current = current;
                replaceInput.current?.click();
              }}
              className="absolute right-3 bottom-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2 text-copy text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
            >
              <RefreshCwIcon aria-hidden className="size-4" /> Replace
            </button>
          )}
          <input
            ref={replaceInput}
            type="file"
            accept={UPLOAD_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploader.addFiles([f]);
              else replaceAt.current = null;
              e.target.value = "";
            }}
          />
        </div>

        {main && mainMedia && (
          <div className="grid gap-3 rounded-lg bg-muted p-3 tablet:grid-cols-2">
            <label className="flex flex-col gap-1 text-caption text-text-body">
              Alt text (for screen readers and SEO)
              <input
                value={main.alt}
                maxLength={200}
                disabled={disabled}
                onChange={(e) => patch(current, { alt: e.target.value })}
                placeholder={mainMedia.originalName}
                className="h-10 rounded-md border border-border bg-card px-3 text-copy text-foreground outline-none focus-visible:border-primary"
              />
            </label>
            <div className="flex flex-col gap-1 text-caption text-text-body">
              <span id="image-variant-label">Shown for variant</span>
              <Select
                value={main.variantKey ?? NO_VARIANT}
                disabled={disabled || variants.length < 2}
                onValueChange={(v) => patch(current, { variantKey: v === NO_VARIANT ? null : v })}
              >
                <SelectTrigger aria-labelledby="image-variant-label" className="h-10 w-full bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={NO_VARIANT}>All variants</SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v.key} value={v.key}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {current > 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(arrayMove(images, current, 0));
                  setSelected(0);
                }}
                className="tap-target inline-flex items-center gap-1.5 justify-self-start text-copy font-medium text-primary hover:underline"
              >
                <StarIcon aria-hidden className="size-4" /> Make main image
              </button>
            )}
          </div>
        )}
      </div>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={images.map((i) => i.mediaId)} strategy={rectSortingStrategy}>
          <ul aria-labelledby="product-images-label" aria-describedby="product-images-help" className="flex flex-wrap gap-5">
            {images.map((img, i) => (
              <Thumb
                key={img.mediaId}
                img={img}
                media={media[img.mediaId]}
                index={i}
                selected={i === current}
                disabled={disabled}
                onSelect={() => setSelected(i)}
                onRemove={() => remove(i)}
              />
            ))}
            {uploader.tasks.map((t) => (
              <li key={t.id}>
                <UploadTaskTile
                  task={t}
                  className="h-24.75 w-24.5"
                  onCancel={() => uploader.cancel(t.id)}
                  onRetry={() => uploader.retry(t.id)}
                  onDismiss={() => uploader.dismiss(t.id)}
                />
              </li>
            ))}
            <li className="min-w-36 flex-1">
              <AddImageTile onFiles={(f) => uploader.addFiles(f)} disabled={disabled} className="h-24.75 w-full" />
            </li>
          </ul>
        </SortableContext>
      </DndContext>
      <p id="product-images-help" className="-mt-2 text-caption text-muted-foreground">
        Drag to reorder; the first image is the main one on the store. JPG, PNG, WebP or AVIF, up to {maxMb} MB each.
      </p>
    </div>
  );
}

function Thumb({
  img,
  media,
  index,
  selected,
  disabled,
  onSelect,
  onRemove,
}: {
  img: FormImage;
  media: MediaItem | undefined;
  index: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.mediaId, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative h-24.75 w-24.5 touch-manipulation", isDragging && "z-10 opacity-80")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Image ${index + 1}${index === 0 ? " (main)" : ""}: ${img.alt || media?.originalName || "image"}. Drag or use arrow keys to reorder.`}
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          "relative block size-full cursor-grab overflow-hidden rounded-xl border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:cursor-grabbing",
          selected ? "border-primary ring-2 ring-primary/30" : "border-border",
        )}
      >
        {media ? (
          <Image src={media.url} alt="" fill sizes="98px" className="pointer-events-none object-contain p-2" />
        ) : (
          <ImageIcon aria-hidden className="m-auto size-6 text-muted-foreground" />
        )}
        {index === 0 && <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 text-caption font-bold text-primary-foreground">Main</span>}
      </button>
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove image ${index + 1}`}
          className="tap-target absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-card text-text-body hover:text-sale"
        >
          <CircleXIcon aria-hidden className="size-4.5 stroke-[1.5]" />
        </button>
      )}
    </li>
  );
}

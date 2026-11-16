"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon, ImageIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { AddImageTile, UploadTaskTile } from "@/components/admin/media/upload-tile";
import { useUploader } from "@/components/admin/media/use-uploader";
import { Field, FieldError, fieldInput } from "@/components/admin/products/form/fields";
import { dropdownClass } from "@/components/admin/products/form/pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { checkCategorySlug } from "@/lib/actions/admin-categories";
import type { ActionResult } from "@/lib/actions/result";
import type { AdminCategoryRow, ParentOption } from "@/lib/admin/categories/params";
import type { MediaItem } from "@/lib/admin/media";
import { slugify } from "@/lib/admin/products/rules";
import { UPLOAD_ACCEPT } from "@/lib/media/upload-rules";
import { cn } from "@/lib/utils";
import { CATEGORY_LIMITS, categoryFormSchema, type CategoryFormData, type CategoryFormValues } from "@/lib/validations/admin-category";

export const CATEGORY_FORM_ID = "category-form";
const TOP_LEVEL = "__top";

type Preview = { url: string; blurDataURL: string | null; name: string };

export function emptyCategoryValues(): CategoryFormValues {
  return {
    name: "",
    slug: "",
    parentId: null,
    description: "",
    imageId: null,
    imageAlt: "",
    isActive: true,
    isFeatured: false,
    seoTitle: "",
    seoDescription: "",
  };
}

export function categoryValuesOf(row: AdminCategoryRow): CategoryFormValues {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parentId,
    description: row.description,
    imageId: row.imageId,
    imageAlt: row.imageAlt,
    isActive: row.isActive,
    isFeatured: row.isFeatured,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}

/**
 * Create / Edit Category form (no PNG: built from the Add Products field kit).
 * Fields, in order: image, name, slug (+ store URL), parent, description,
 * Active + Featured toggles, collapsed SEO. react-hook-form + the same zod schema
 * as the server action; the modal's footer submits it (`form={CATEGORY_FORM_ID}`),
 * and Enter in any input submits too.
 */
export function CategoryForm({
  row,
  parents,
  canWrite,
  maxMb,
  onSubmit,
  onDirtyChange,
  onPendingChange,
}: {
  /** null: a new category. */
  row: AdminCategoryRow | null;
  parents: ParentOption[];
  canWrite: boolean;
  maxMb: number;
  onSubmit: (data: CategoryFormData) => Promise<ActionResult<AdminCategoryRow>>;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const isNew = !row;
  const form = useForm<CategoryFormValues, unknown, CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: row ? categoryValuesOf(row) : emptyCategoryValues(),
    mode: "onTouched",
  });
  const { register, control, formState, setValue, getValues, setError } = form;
  const errors = formState.errors;
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [preview, setPreview] = useState<Preview | null>(row?.imageUrl ? { url: row.imageUrl, blurDataURL: row.blurDataURL, name: row.name } : null);

  const name = useWatch({ control, name: "name" });
  const slug = useWatch({ control, name: "slug" });
  const imageId = useWatch({ control, name: "imageId" });
  const seoTitle = useWatch({ control, name: "seoTitle" }) ?? "";
  const seoDescription = useWatch({ control, name: "seoDescription" }) ?? "";
  const description = useWatch({ control, name: "description" }) ?? "";

  // Slug follows the name until edited by hand (as on Add Products).
  useEffect(() => {
    if (!slugTouched) setValue("slug", slugify(name ?? ""), { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }, [name, slugTouched, setValue, formState.isSubmitted]);

  const dirty = formState.isDirty && canWrite;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const pending = formState.isSubmitting;
  useEffect(() => onPendingChange(pending), [pending, onPendingChange]);

  const pickImage = (m: MediaItem) => {
    setValue("imageId", m.id, { shouldDirty: true });
    if (!getValues("imageAlt")) setValue("imageAlt", m.alt || getValues("name"), { shouldDirty: true });
    setPreview({ url: m.url, blurDataURL: m.blurDataURL, name: m.originalName });
  };
  const uploader = useUploader({ scope: "tmp", maxMb, onUploaded: pickImage });
  const replaceInput = useRef<HTMLInputElement>(null);
  const task = uploader.tasks.at(-1);

  const onSlugBlur = async () => {
    if (!canWrite || !(await form.trigger("slug"))) return; // fresh format check first
    const res = await checkCategorySlug({ slug: getValues("slug"), excludeId: row?.id });
    if (res.ok && !res.data.available) setError("slug", { type: "server", message: `Already used. Try “${res.data.suggestion}”.` });
  };

  const submit = form.handleSubmit(async (data) => {
    if (uploader.busy) return;
    const res = await onSubmit(data);
    if (res.ok) {
      form.reset(categoryValuesOf(res.data)); // clean: closing won't ask to discard
      return;
    }
    const fields = Object.entries(res.fieldErrors ?? {}).filter(([, m]) => m?.length);
    for (const [key, messages] of fields) setError(key as FieldPath<CategoryFormValues>, { type: "server", message: messages![0] }, { shouldFocus: true });
  });

  const parentOptions = parents.filter((p) => p.id !== row?.id);
  const hasChildren = (row?.childCount ?? 0) > 0;
  const optional = <span className="font-normal text-muted-foreground">(Optional)</span>;

  return (
    <form id={CATEGORY_FORM_ID} noValidate onSubmit={submit} aria-busy={pending} className="flex flex-col gap-6">
      <fieldset disabled={!canWrite || pending} className="flex min-w-0 flex-col gap-6">
        {/* Image: square drop zone / preview, alt text, Browse the library. */}
        <div className="flex flex-col gap-3">
          <span id="category-image-label" className="text-lead font-medium text-foreground">
            Category Image {optional}
          </span>
          <div className="flex flex-col gap-4 tablet:flex-row tablet:items-start">
            <div className="relative size-40 shrink-0">
              {task && task.status !== "done" ? (
                <UploadTaskTile
                  task={task}
                  className="size-full"
                  onCancel={() => uploader.cancel(task.id)}
                  onRetry={() => uploader.retry(task.id)}
                  onDismiss={() => uploader.dismiss(task.id)}
                />
              ) : imageId && preview ? (
                <div className="relative size-full overflow-hidden rounded-xl border border-border bg-card">
                  <Image
                    src={preview.url}
                    alt={getValues("imageAlt") || preview.name}
                    fill
                    sizes="160px"
                    placeholder={preview.blurDataURL ? "blur" : "empty"}
                    blurDataURL={preview.blurDataURL ?? undefined}
                    className="object-contain p-3"
                  />
                </div>
              ) : (
                <AddImageTile onFiles={(f) => uploader.addFiles([f[0]!])} disabled={!canWrite} className="size-full" />
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {imageId && (
                <Field id="imageAlt" label={<>Alt text {optional}</>} hint="Describes the image for screen readers and search." error={errors.imageAlt?.message}>
                  <input id="imageAlt" {...register("imageAlt")} maxLength={CATEGORY_LIMITS.alt} aria-invalid={!!errors.imageAlt} aria-describedby="imageAlt-error" className={fieldInput} placeholder={name || "e.g. Fresh vegetables"} />
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                <MediaPicker
                  attached={new Set(imageId ? [imageId] : [])}
                  onPick={(items) => items[0] && pickImage(items[0])}
                  trigger={
                    <button type="button" disabled={!canWrite} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-copy text-text-body shadow-sm hover:bg-muted disabled:opacity-50">
                      <ImageIcon aria-hidden className="size-5 fill-text-body stroke-card" /> Browse
                    </button>
                  }
                />
                {imageId && (
                  <>
                    <button
                      type="button"
                      disabled={!canWrite || uploader.busy}
                      onClick={() => replaceInput.current?.click()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2 text-copy text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
                    >
                      <RefreshCwIcon aria-hidden className="size-4" /> Replace
                    </button>
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => {
                        setValue("imageId", null, { shouldDirty: true });
                        setPreview(null);
                      }}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2 text-copy text-foreground shadow-sm hover:bg-muted hover:text-sale disabled:opacity-50"
                    >
                      <Trash2Icon aria-hidden className="size-4" /> Remove
                    </button>
                  </>
                )}
              </div>
              {!imageId && <p className="text-caption text-muted-foreground">Square images look best (JPG, PNG, WebP or AVIF, up to {maxMb} MB).</p>}
              <input
                ref={replaceInput}
                type="file"
                accept={UPLOAD_ACCEPT}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploader.addFiles([f]);
                  e.target.value = "";
                }}
              />
              <FieldError message={errors.imageId?.message} />
            </div>
          </div>
        </div>

        <Field id="name" label="Category Name" error={errors.name?.message}>
          <input
            id="name"
            {...register("name")}
            aria-invalid={!!errors.name}
            aria-describedby="name-error"
            aria-required
            maxLength={CATEGORY_LIMITS.name}
            className={fieldInput}
            placeholder="e.g. Fresh Vegetables"
            autoFocus={isNew}
          />
        </Field>

        <Field id="slug" label="URL slug" hint={`Store URL: /shop?category=${slug || "…"}`} error={errors.slug?.message}>
          <input
            id="slug"
            {...register("slug", {
              onChange: () => setSlugTouched(true),
              onBlur: onSlugBlur,
              setValueAs: (v: string) => v.trim().toLowerCase(),
            })}
            aria-invalid={!!errors.slug}
            aria-describedby="slug-error"
            className={fieldInput}
            spellCheck={false}
          />
        </Field>

        <Field
          id="parentId"
          label="Parent category"
          hint={hasChildren ? `It has ${row!.childCount} subcategor${row!.childCount === 1 ? "y" : "ies"}, so it stays top-level.` : "Subcategories show under their parent in menus and filters."}
          error={errors.parentId?.message}
        >
          <Controller
            control={control}
            name="parentId"
            render={({ field }) => (
              <Select value={field.value ?? TOP_LEVEL} onValueChange={(v) => field.onChange(v === TOP_LEVEL ? null : v)} disabled={!canWrite || hasChildren}>
                <SelectTrigger id="parentId" aria-invalid={!!errors.parentId || undefined} aria-describedby="parentId-error" className={cn(dropdownClass, "data-[size=default]:h-12")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectItem value={TOP_LEVEL}>None (top level)</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="description" label={<>Description {optional}</>} hint={`${description.length}/${CATEGORY_LIMITS.description}`} error={errors.description?.message}>
          <textarea
            id="description"
            {...register("description")}
            rows={3}
            maxLength={CATEGORY_LIMITS.description}
            aria-invalid={!!errors.description}
            aria-describedby="description-error"
            className={cn(fieldInput, "h-auto py-3")}
          />
        </Field>

        <div className="grid gap-4 tablet:grid-cols-2">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex min-h-6 items-center gap-3 text-lead text-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canWrite} className="h-6 w-12" />
                Active
              </label>
            )}
          />
          <Controller
            control={control}
            name="isFeatured"
            render={({ field }) => (
              <label className="flex min-h-6 items-center gap-3 text-lead text-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canWrite} className="h-6 w-12" />
                Featured on home
              </label>
            )}
          />
        </div>

        <details className="group rounded-lg border border-border" open={Boolean(errors.seoTitle || errors.seoDescription) || undefined}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-h4 text-foreground">
            Search engine listing (SEO)
            <ChevronDownIcon aria-hidden className="size-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-5 px-4 pb-4">
            <Field id="seoTitle" label="Page title" hint={`${seoTitle.length}/${CATEGORY_LIMITS.seoTitle}. Empty uses the category name.`} error={errors.seoTitle?.message}>
              <input id="seoTitle" {...register("seoTitle")} maxLength={CATEGORY_LIMITS.seoTitle} aria-invalid={!!errors.seoTitle} aria-describedby="seoTitle-error" className={fieldInput} />
            </Field>
            <Field
              id="seoDescription"
              label="Meta description"
              hint={`${seoDescription.length}/${CATEGORY_LIMITS.seoDescription}. Empty uses the description.`}
              error={errors.seoDescription?.message}
            >
              <textarea
                id="seoDescription"
                {...register("seoDescription")}
                rows={3}
                maxLength={CATEGORY_LIMITS.seoDescription}
                aria-invalid={!!errors.seoDescription}
                aria-describedby="seoDescription-error"
                className={cn(fieldInput, "h-auto py-3")}
              />
            </Field>
          </div>
        </details>
      </fieldset>
    </form>
  );
}

"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  Heading3Icon,
  Heading4Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  SquarePenIcon,
  Undo2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Add Product → "Product Description": Tiptap limited to what the PDP
 * Description tab renders and lib/rich-text.ts keeps (p, h3/h4, lists, bold,
 * italic, links). The HTML is sanitized again on save. The pencil icon (PNG,
 * bottom-right) toggles the formatting toolbar.
 */
export function RichTextEditor({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const [toolbar, setToolbar] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3, 4] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], defaultProtocol: "https" },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": `${id}-label`,
        ...(describedBy && { "aria-describedby": describedBy }),
        ...(invalid && { "aria-invalid": "true" }),
        class: "product-prose min-h-24 px-3 pt-3 pb-12 text-lead text-foreground outline-none",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
    onBlur: () => onBlur?.(),
  });

  // External resets (load, save, discard) replace the content.
  useEffect(() => {
    if (editor && value !== (editor.isEmpty ? "" : editor.getHTML())) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => editor?.setEditable(!disabled), [editor, disabled]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            h3: e.isActive("heading", { level: 3 }),
            h4: e.isActive("heading", { level: 4 }),
            ul: e.isActive("bulletList"),
            ol: e.isActive("orderedList"),
            link: e.isActive("link"),
            undo: e.can().undo(),
            redo: e.can().redo(),
          }
        : null,
  });

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave empty to remove)", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const tools = editor && state && [
    { label: "Bold", icon: BoldIcon, on: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: ItalicIcon, on: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Heading", icon: Heading3Icon, on: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Subheading", icon: Heading4Icon, on: state.h4, run: () => editor.chain().focus().toggleHeading({ level: 4 }).run() },
    { label: "Bulleted list", icon: ListIcon, on: state.ul, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListOrderedIcon, on: state.ol, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Link", icon: LinkIcon, on: state.link, run: setLink },
    { label: "Undo", icon: Undo2Icon, on: false, disabled: !state.undo, run: () => editor.chain().focus().undo().run() },
    { label: "Redo", icon: Redo2Icon, on: false, disabled: !state.redo, run: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-muted transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15",
        invalid && "border-destructive",
        disabled && "opacity-70",
      )}
    >
      {toolbar && tools && (
        <div role="toolbar" aria-label="Formatting" aria-controls={id} className="flex flex-wrap gap-1 border-b border-border p-1.5">
          {tools.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-label={t.label}
              title={t.label}
              aria-pressed={t.on}
              disabled={disabled || t.disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
              className={cn(
                "tap-target grid size-8 place-items-center rounded-md text-text-body hover:bg-card disabled:opacity-40",
                t.on && "bg-card text-primary",
              )}
            >
              <t.icon aria-hidden className="size-4" />
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} />
      {!editor && <div aria-hidden className="min-h-31" />}
      <button
        type="button"
        aria-label={toolbar ? "Hide formatting toolbar" : "Show formatting toolbar"}
        aria-pressed={toolbar}
        title="Formatting"
        disabled={disabled}
        onClick={() => setToolbar((v) => !v)}
        className="tap-target absolute right-3 bottom-3 grid size-8 place-items-center rounded-md text-foreground hover:bg-card"
      >
        <SquarePenIcon aria-hidden className="size-6 stroke-[1.5]" />
      </button>
    </div>
  );
}

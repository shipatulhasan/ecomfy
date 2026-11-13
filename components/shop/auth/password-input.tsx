"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { inputClass } from "@/components/shared/form-field";
import { cn } from "@/lib/utils";

/** Password field with the design's eye toggle (Sign In, Create Account, Settings). */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn(inputClass, "pr-13", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={props.id}
        className="tap-target absolute inset-y-0 right-1 grid w-11 place-items-center text-foreground hover:text-primary laptop:right-2"
      >
        {visible ? <EyeOffIcon aria-hidden className="size-5" /> : <EyeIcon aria-hidden className="size-5" />}
      </button>
    </div>
  );
}

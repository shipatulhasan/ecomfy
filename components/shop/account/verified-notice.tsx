"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormAlert } from "@/components/shared/form-field";

/** "/account?verified=1" after opening the verification link. */
export function VerifiedNotice() {
  return (
    <Suspense fallback={null}>
      <Notice />
    </Suspense>
  );
}

function Notice() {
  const verified = useSearchParams().get("verified");
  if (!verified) return null;
  return <FormAlert tone="success">Thanks! Your email is verified.</FormAlert>;
}

"use client";

import { ChevronDownIcon } from "lucide-react";
import { FormField, inputClass } from "@/components/shared/form-field";
import { DISTRICTS } from "@/lib/config/districts";
import { cn } from "@/lib/utils";

export type AddressState = {
  firstName: string;
  lastName: string;
  companyName: string;
  street: string;
  city: string;
  district: string;
  zip: string;
  email: string;
  phone: string;
};

export const EMPTY_ADDRESS: AddressState = {
  firstName: "",
  lastName: "",
  companyName: "",
  street: "",
  city: "",
  district: "",
  zip: "",
  email: "",
  phone: "",
};

/**
 * Billing / shipping fields in the Checkout.png grid (3 + 1 + 3 + 2 columns from
 * tablet, 1 column on mobile). Bangladesh-first: the PNG's Country / States / Zip
 * row is District (select) / City or area / Postcode. Input types and
 * autocomplete tokens give mobile keyboards and autofill the right data.
 */
export function AddressFields({
  section,
  value,
  onChange,
  errors,
  withEmail = true,
}: {
  section: "billing" | "shipping";
  value: AddressState;
  onChange: (field: keyof AddressState, v: string) => void;
  errors: Record<string, string | undefined>;
  withEmail?: boolean;
}) {
  const id = (f: keyof AddressState) => `${section}-${f}`;
  const err = (f: keyof AddressState) => errors[`${section}.${f}`];
  const ac = (token: string) => `section-${section} ${section} ${token}`;
  const input = (f: keyof AddressState, extra: React.ComponentProps<"input">) => (
    <input
      id={id(f)}
      name={id(f)}
      value={value[f]}
      onChange={(e) => onChange(f, e.target.value)}
      aria-invalid={!!err(f) || undefined}
      aria-describedby={err(f) ? `${id(f)}-error` : undefined}
      className={inputClass}
      {...extra}
    />
  );

  return (
    <div className="grid gap-4 tablet:grid-cols-6 tablet:gap-x-4">
      <FormField label="First name" htmlFor={id("firstName")} error={err("firstName")} errorId={`${id("firstName")}-error`} className="tablet:col-span-2">
        {input("firstName", { autoComplete: ac("given-name"), placeholder: "Your first name", required: true })}
      </FormField>
      <FormField label="Last name" htmlFor={id("lastName")} error={err("lastName")} errorId={`${id("lastName")}-error`} className="tablet:col-span-2">
        {input("lastName", { autoComplete: ac("family-name"), placeholder: "Your last name", required: true })}
      </FormField>
      <FormField label="Company Name" optional htmlFor={id("companyName")} error={err("companyName")} errorId={`${id("companyName")}-error`} className="tablet:col-span-2">
        {input("companyName", { autoComplete: ac("organization"), placeholder: "Company name" })}
      </FormField>

      <FormField label="Street Address" htmlFor={id("street")} error={err("street")} errorId={`${id("street")}-error`} className="tablet:col-span-6">
        {input("street", { autoComplete: ac("address-line1"), placeholder: "House, road, block", required: true })}
      </FormField>

      <FormField label="District" htmlFor={id("district")} error={err("district")} errorId={`${id("district")}-error`} className="tablet:col-span-2">
        <div className="relative">
          <select
            id={id("district")}
            name={id("district")}
            value={value.district}
            onChange={(e) => onChange("district", e.target.value)}
            autoComplete={ac("address-level1")}
            required
            aria-invalid={!!err("district") || undefined}
            aria-describedby={err("district") ? `${id("district")}-error` : undefined}
            // <select> matches :read-only, so undo inputClass's read-only styling.
            className={cn(inputClass, "appearance-none pr-10 read-only:bg-background read-only:text-foreground", !value.district && "read-only:text-muted-foreground")}
          >
            <option value="" disabled>
              Select
            </option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d} className="text-foreground">
                {d}
              </option>
            ))}
          </select>
          <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-foreground" />
        </div>
      </FormField>
      <FormField label="City / Area" htmlFor={id("city")} error={err("city")} errorId={`${id("city")}-error`} className="tablet:col-span-2">
        {input("city", { autoComplete: ac("address-level2"), placeholder: "e.g. Dhanmondi", required: true })}
      </FormField>
      <FormField label="Postcode" htmlFor={id("zip")} error={err("zip")} errorId={`${id("zip")}-error`} className="tablet:col-span-2">
        {input("zip", { autoComplete: ac("postal-code"), inputMode: "numeric", pattern: "[0-9]{4}", maxLength: 4, placeholder: "Postcode", required: true })}
      </FormField>

      {withEmail && (
        <FormField label="Email" htmlFor={id("email")} error={err("email")} errorId={`${id("email")}-error`} className="tablet:col-span-3">
          {input("email", { type: "email", autoComplete: ac("email"), inputMode: "email", placeholder: "Email Address", required: true })}
        </FormField>
      )}
      <FormField label="Phone" htmlFor={id("phone")} error={err("phone")} errorId={`${id("phone")}-error`} className={withEmail ? "tablet:col-span-3" : "tablet:col-span-6"}>
        {input("phone", { type: "tel", autoComplete: ac("tel"), inputMode: "tel", placeholder: "01XXXXXXXXX", required: true })}
      </FormField>
    </div>
  );
}

import "server-only";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { bkash } from "./bkash";
import { cod } from "./cod";
import { sslcommerz } from "./sslcommerz";
import type { PaymentProvider } from "./types";

/** One line per method. Adding / removing a method never touches another provider. */
const providers: Record<PaymentMethod, PaymentProvider> = {
  BKASH: bkash,
  SSLCOMMERZ: sslcommerz,
  COD: cod,
};

export const getProvider = (method: PaymentMethod) => providers[method];

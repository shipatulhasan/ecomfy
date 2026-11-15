/**
 * Order dates (Intl.DateTimeFormat, shop time zone so server and client agree).
 *   formatOrderDate     → "24 Apr 2021"        (history rows, cards, invoice)
 *   formatOrderDateLong → "April 24, 2021"     (Order Details header, PNG)
 *   formatOrderDateTime → "24 Apr, 3:05 pm"    (tracker steps, status banner)
 */
const TZ = "Asia/Dhaka";

const short = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const long = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
});

export const formatOrderDate = (d: Date) => short.format(d);
export const formatOrderDateLong = (d: Date) => long.format(d);
export const formatOrderDateTime = (d: Date) => dateTime.format(d);

export const productCount = (n: number) => `${n} Product${n === 1 ? "" : "s"}`;
export const orderHref = (n: number) => `/account/orders/${n}`;

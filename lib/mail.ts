import "server-only";
import { appendFile, mkdir } from "node:fs/promises";

/**
 * Transactional mail (email verification, password reset).
 *
 * No provider is wired up yet. In development the message is logged (terminal and
 * `.data/dev-mail.log`, gitignored) so the link can be opened; in production it is dropped with a warning
 * (never the link: it carries a sign-in-equivalent token). Plug a provider in
 * here (Resend, SES, …) when one exists — callers don't change.
 *
 * Never pass passwords or other secrets in `text`.
 */
export type Mail = { to: string; subject: string; text: string; link?: string };

export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    const entry = `[mail] ${new Date().toISOString()} to=${mail.to}\n[mail] subject=${mail.subject}\n[mail] link=${mail.link ?? "-"}\n`;
    console.info(`\n${entry}`);
    await mkdir(".data", { recursive: true });
    await appendFile(".data/dev-mail.log", `${entry}\n`).catch(() => {});
    return;
  }
  console.warn(`[mail] no mail provider configured; "${mail.subject}" was not sent`);
}

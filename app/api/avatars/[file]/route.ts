import { readFile } from "node:fs/promises";
import path from "node:path";
import { AVATAR_FILE_RE, avatarDir } from "@/lib/avatars";

/**
 * Serves uploaded avatars (lib/avatars.ts). File names are content-hashed, so
 * they're cached forever; a new upload gets a new name.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/avatars/[file]">) {
  const { file } = await ctx.params;
  if (!AVATAR_FILE_RE.test(file)) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(path.join(avatarDir(), file));
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

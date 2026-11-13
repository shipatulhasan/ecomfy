import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Product descriptions are stored as HTML (Product.description). They are written
 * by admins, but are still sanitized on read before they reach
 * `dangerouslySetInnerHTML`. Only the tags the PDP "Descriptions" tab styles are
 * allowed (`.product-prose` in app/globals.css); everything else is stripped.
 * Plain text without tags (older rows) is turned into paragraphs.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "a", "h3", "h4"],
  // rel/target are always overwritten by the transform below.
  allowedAttributes: { a: ["href", "title", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener nofollow", target: "_blank" }),
  },
};

export function sanitizeProductHtml(input: string): string {
  const html = /<[a-z][\s\S]*>/i.test(input)
    ? input
    : input
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeText(p.trim())}</p>`)
        .join("");
  return sanitizeHtml(html, OPTIONS);
}

/** Text-only version (meta description, JSON-LD). */
export function productHtmlToText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

function escapeText(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

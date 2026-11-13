import { createCn } from "cn/config";

/**
 * Class merging aware of our design tokens (app/theme.css): without this,
 * `cn("text-h2", "text-foreground")` treats `text-h2` as a color and drops it.
 * (Vendored components/ui import `cn` from "cn" directly and are unaffected.)
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "h4", "lead", "copy", "caption"] }],
      shadow: [{ shadow: ["card-hover", "dropdown", "modal"] }],
    },
  },
});

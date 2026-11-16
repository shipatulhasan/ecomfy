/** Media as the admin UI sees it (plain data, crosses to client components). */
export type MediaItem = {
  id: string;
  url: string;
  originalName: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  blurDataURL: string | null;
  createdAt: string;
  /** Products using this image (Product Media "used" filter, delete guard). */
  usedBy?: { id: string; name: string }[];
};

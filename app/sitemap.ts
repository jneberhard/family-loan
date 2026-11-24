import type { MetadataRoute } from "next";
import { publicPagePaths, siteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPagePaths.map((path) => ({ url: new URL(path, siteUrl).toString() }));
}

import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://partsagricola.com.br";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/conta/"] },
    sitemap: `${origin}/sitemap.xml`,
  };
}

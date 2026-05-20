import { Helmet } from "react-helmet-async";

const SITE_URL = "https://amlaki1.app";
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`;

interface SEOProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
}

/** Per-route head: unique title, description, canonical, og:* — overrides index.html defaults. */
export function SEO({ title, description, path, image = DEFAULT_IMAGE, type = "website" }: SEOProps) {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

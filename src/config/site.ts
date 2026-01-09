export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  links: {
    twitter: string;
    github: string;
  };
}

export const siteConfig: SiteConfig = {
  name: "smry.ai",
  description:
    "Paste any paywalled article link and get the full text plus an AI summary. Free to use, no account, no browser extension.",
  url: "https://smry.ai",
  ogImage: "https://smry.ai/og-image.png",
  links: {
    twitter: "https://twitter.com/michael_chomsky",
    github: "https://github.com/mrmps/SMRY",
  },
};

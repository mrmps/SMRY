export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  links: {
    twitter: string;
    github: string;
  };
};

export const siteConfig: SiteConfig = {
  name: "smry.ai",
  description:
    "An open source paywall bypass site with instant ai summaries, inspired by 12ft.io and 1ft.io",
  url: "https://smry.ai",
  ogImage: "https://tx.shadcn.com/og.jpg",
  links: {
    twitter: "https://twitter.com/michael_chomsky",
    github: "https://github.com/mrmps/SMRY",
  },
};

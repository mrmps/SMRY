declare module 'diffbot' {
  export interface DiffbotArticleOptions {
    uri: string;
    html?: boolean;
    comments?: boolean;
    stats?: boolean;
  }

  export interface DiffbotImage {
    url?: string;
    title?: string;
    height?: number;
    width?: number;
    primary?: boolean;
  }

  export interface DiffbotMedia {
    type?: string;
    url?: string;
    title?: string;
  }

  export interface DiffbotTag {
    label?: string;
    uri?: string;
    score?: number;
  }

  export interface DiffbotCategory {
    name?: string;
    score?: number;
  }

  export interface DiffbotAuthor {
    name?: string;
    link?: string;
  }

  export interface DiffbotArticleObject {
    title?: string;
    text?: string;
    html?: string;
    dom?: string; // Full page HTML (optional field)
    author?: string;
    date?: string;
    url?: string;
    pageUrl?: string;
    authorUrl?: string;
    siteName?: string;
    humanLanguage?: string;
    images?: DiffbotImage[];
    media?: DiffbotMedia[];
    tags?: DiffbotTag[];
    categories?: DiffbotCategory[];
    authors?: DiffbotAuthor[];
    stats?: {
      fetchTime?: number;
      confidence?: number;
    };
    [key: string]: unknown;
  }

  // Response can have both old format (direct properties) and new format (objects array)
  export interface DiffbotArticleResponse {
    // Old API format (direct properties)
    title?: string;
    text?: string;
    html?: string;
    dom?: string; // Full page HTML (optional field)
    author?: string;
    date?: string;
    url?: string;
    media?: DiffbotMedia[];
    stats?: {
      fetchTime?: number;
      confidence?: number;
    };

    // New API format (objects array)
    request?: {
      pageUrl: string;
      api: string;
      version: number;
      options?: string[];
      [key: string]: unknown;
    };
    objects?: DiffbotArticleObject[];

    // Error response
    errorCode?: number;
    error?: string;

    [key: string]: unknown;
  }

  export interface DiffbotFrontpageOptions {
    uri: string;
  }

  export class Diffbot {
    constructor(apiKey: string);
    
    article(
      options: DiffbotArticleOptions,
      callback: (err: Error | null, response: DiffbotArticleResponse) => void
    ): void;
    
    frontpage(
      options: DiffbotFrontpageOptions,
      callback: (err: Error | null, response: unknown) => void
    ): void;
  }
}


declare module 'diffbot' {
  export interface DiffbotArticleOptions {
    uri: string;
    html?: boolean;
    comments?: boolean;
    stats?: boolean;
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
    images?: any[];
    media?: any[];
    tags?: any[];
    categories?: any[];
    authors?: any[];
    stats?: {
      fetchTime?: number;
      confidence?: number;
    };
    [key: string]: any;
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
    media?: any[];
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
      [key: string]: any;
    };
    objects?: DiffbotArticleObject[];
    
    // Error response
    errorCode?: number;
    error?: string;
    
    [key: string]: any;
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
      callback: (err: Error | null, response: any) => void
    ): void;
  }
}


export interface Article {
  title: string;
  content: string;
  url: string;
  source: string;
  byline?: string;
  image?: string;
  date?: string;
}

export interface ArticleLength {
  wordCount: number;
  readingTime: number; // in minutes
} 
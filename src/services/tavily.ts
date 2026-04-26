import axios from 'axios';

export interface TavilyArticle {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  source?: string;
}

export async function fetchCryptoNews(symbol: string, maxResults = 5): Promise<TavilyArticle[]> {
  try {
    const res = await axios.post(
      'https://api.tavily.com/search',
      {
        query: `${symbol} crypto news today`,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: false,
        topic: 'finance',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );
    return res.data.results || [];
  } catch {
    return [];
  }
}
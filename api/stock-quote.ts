import type { VercelRequest, VercelResponse } from '@vercel/node';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFetch = require('node-fetch') as typeof import('node-fetch').default;
import { setCorsHeaders, handleOptions } from '../lib/server/db';
import { verifyAccessToken } from '../lib/server/auth';

/**
 * GET /api/stock-quote?ticker=AAPL
 *
 * Proxies Yahoo Finance v7/finance/quote for a single ticker.
 * Returns a small, normalised StockQuote payload.
 *
 * Yahoo Finance is an unofficial, rate-limited endpoint — results are
 * delayed ~15 min during market hours. We proxy server-side to avoid
 * CORS issues and to keep the Yahoo crumb/cookie flow server-side.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check — guests (no token) are allowed to look up quotes too
  const authHeader = req.headers.authorization ?? '';
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (!verifyAccessToken(token)) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  const ticker = (req.query.ticker as string ?? '').trim().toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'ticker query param is required' });

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=symbol,shortName,regularMarketPrice,currency,regularMarketChange,regularMarketChangePercent,marketState`;

    const yahooRes = await nodeFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Nestworth/1.0)',
        Accept: 'application/json',
      },
    });

    if (!yahooRes.ok) {
      return res.status(502).json({ error: `Yahoo Finance returned ${yahooRes.status}` });
    }

    const json = await yahooRes.json() as {
      quoteResponse?: {
        result?: Array<{
          symbol: string;
          shortName?: string;
          longName?: string;
          regularMarketPrice?: number;
          currency?: string;
          regularMarketChange?: number;
          regularMarketChangePercent?: number;
          marketState?: string;
        }>;
        error?: unknown;
      };
    };

    const results = json?.quoteResponse?.result;
    if (!results || results.length === 0) {
      return res.status(404).json({ error: `Ticker "${ticker}" not found` });
    }

    const q = results[0];
    return res.status(200).json({
      ticker: q.symbol,
      name: q.shortName ?? q.longName ?? q.symbol,
      price: q.regularMarketPrice ?? 0,
      currency: q.currency ?? 'USD',
      change: q.regularMarketChange ?? 0,
      changePct: q.regularMarketChangePercent ?? 0,
      marketState: q.marketState ?? 'CLOSED',
    });
  } catch (err) {
    console.error('stock-quote error:', err);
    return res.status(500).json({ error: 'Failed to fetch quote' });
  }
}

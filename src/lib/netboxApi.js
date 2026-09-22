import { useCallback, useRef } from 'react';

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/$/, '');
}

function createRequestError(response, body) {
  const detail = body ? ` — ${body.slice(0, 200)}` : '';
  return new Error(`${response.status} ${response.statusText}${detail}`);
}

export function useNetBox(baseUrl, token) {
  const cache = useRef(new Map());

  const request = useCallback(async (path, { useCache = true } = {}) => {
    if (!baseUrl || !token) throw new Error('Not configured');

    const url = `${normalizeBaseUrl(baseUrl)}${path}`;
    if (useCache && cache.current.has(url)) return cache.current.get(url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw createRequestError(response, body);
    }

    const data = await response.json();
    cache.current.set(url, data);
    return data;
  }, [baseUrl, token]);

  const fetchAllPages = useCallback(async (path, limit = 200) => {
    let results = [];
    let url = `${path}${path.includes('?') ? '&' : '?'}limit=${limit}`;
    let pageCount = 0;

    while (url && pageCount < 50) {
      const data = await request(url, { useCache: false });
      results = results.concat(data.results || []);
      url = data.next ? data.next.replace(normalizeBaseUrl(baseUrl), '') : null;
      pageCount += 1;
    }

    return results;
  }, [request, baseUrl]);

  const clearCache = useCallback(() => cache.current.clear(), []);

  return { request, fetchAllPages, clearCache };
}

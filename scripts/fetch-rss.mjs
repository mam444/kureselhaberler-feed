import { XMLParser } from 'fast-xml-parser';
import { iconUrlFor } from './sources.mjs';
import { decodeHtmlEntities } from './html-text.mjs';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  // Bazı büyük yayıncı feed'leri (ör. The Guardian) çok sayıda &amp; gibi
  // varlık içeriyor; kütüphanenin varsayılan 1000 sınırı bunları reddediyor.
  processEntities: { enabled: true, maxTotalExpansions: 20_000 },
});

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(raw) {
  if (!raw) return '';
  return decodeHtmlEntities(String(raw).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImageFromItem(item, descriptionRaw) {
  const direct = item?.image;
  if (typeof direct === 'string' && direct.startsWith('http')) return direct;

  const thumb = item?.['media:thumbnail'];
  if (thumb?.['@_url']) return thumb['@_url'];
  const mediaContent = asArray(item?.['media:content']).find((m) => m?.['@_url']);
  if (mediaContent) return mediaContent['@_url'];

  const enclosure = item?.enclosure;
  if (enclosure?.['@_url'] && String(enclosure['@_type'] || '').startsWith('image')) {
    return enclosure['@_url'];
  }

  const imgMatch = /<img[^>]+src="([^"]+)"/.exec(descriptionRaw || '');
  if (imgMatch) return imgMatch[1];

  return null;
}

function textOf(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node === 'object' && '#text' in node) return String(node['#text']);
  return String(node);
}

const robotsRulesByOrigin = new Map();

async function publisherAllowsArticleRead(articleUrl) {
  const url = new URL(articleUrl);
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  let rules = robotsRulesByOrigin.get(url.origin);
  if (!rules) {
    try {
      const response = await fetch(`${url.origin}/robots.txt`, {
        headers: { 'User-Agent': 'KureselHaberlerBot/1.0 (+https://mam444.github.io/kureselhaberler-feed/)' },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status === 404) rules = [];
      else if (!response.ok) return false;
      else rules = (await response.text()).split(/\r?\n/);
      robotsRulesByOrigin.set(url.origin, rules);
    } catch {
      // If the publisher's crawler rules cannot be checked, do not fetch its page.
      return false;
    }
  }

  const groups = [];
  let group = { agents: [], rules: [] };
  for (const line of rules) {
    const clean = line.split('#', 1)[0].trim();
    if (!clean) continue;
    const match = /^(user-agent|allow|disallow)\s*:\s*(.*)$/i.exec(clean);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === 'user-agent') {
      if (group.agents.length && group.rules.length) {
        groups.push(group);
        group = { agents: [], rules: [] };
      }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length && value) {
      group.rules.push({ allow: field === 'allow', path: value });
    }
  }
  if (group.agents.length) groups.push(group);
  const specific = groups.filter((candidate) => candidate.agents.some((agent) => agent !== '*' && 'kureselhaberlerbot'.includes(agent)));
  const applicable = specific.length ? specific : groups.filter((candidate) => candidate.agents.includes('*'));
  const path = `${url.pathname}${url.search}`;
  const matchingRules = applicable.flatMap((candidate) => candidate.rules)
    .filter((rule) => {
      const pattern = rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\$$/, '$');
      return new RegExp(`^${pattern}`).test(path);
    })
    .sort((a, b) => b.path.length - a.path.length);
  return matchingRules.length === 0 || matchingRules[0].allow;
}

function collectArticleBodies(value, results) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectArticleBodies(item, results);
    return;
  }
  if (typeof value !== 'object') return;
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.some((type) => /article|reportage/i.test(String(type ?? '')))
      && typeof value.articleBody === 'string') {
    results.push(value.articleBody);
  }
  for (const child of Object.values(value)) {
    if (typeof child === 'object') collectArticleBodies(child, results);
  }
}

/** Read only publisher pages that allow our crawler, and return schema.org's
 * articleBody as source material for an original short summary. The page text
 * itself is never added to the public feed. */
export async function fetchPublisherArticleBody(articleUrl) {
  if (!articleUrl || !(await publisherAllowsArticleRead(articleUrl))) return null;
  try {
    const response = await fetch(articleUrl, {
      headers: { 'User-Agent': 'KureselHaberlerBot/1.0 (+https://mam444.github.io/kureselhaberler-feed/)', Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
    });
    if (new URL(response.url).origin !== new URL(articleUrl).origin) return null;
    if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') ?? '')) return null;
    const html = await response.text();
    const bodies = [];
    const scripts = html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const script of scripts) {
      try {
        collectArticleBodies(JSON.parse(script[1]), bodies);
      } catch {
        // A malformed unrelated JSON-LD script should not block RSS fallback.
      }
    }
    const cleaned = bodies
      .map((body) => decodeHtmlEntities(String(body).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim())
      .filter((body) => body.length >= 700)
      .sort((a, b) => b.length - a.length)[0];
    if (!cleaned) return null;
    return cleaned.length <= 8_000
      ? cleaned
      : `${cleaned.slice(0, 8_000).replace(/\s+\S*$/, '').trim()}…`;
  } catch (error) {
    console.warn(`[article] yayıncı sayfası okunamadı: ${error.message}`);
    return null;
  }
}

function parseRssItem(item, source) {
  const title = textOf(item.title).trim();
  const directLink = Array.isArray(item.link)
    ? item.link.find((candidate) => candidate?.['@_rel'] === 'alternate') ?? item.link[0]
    : item.link;
  const atomLinks = asArray(item['atom:link']);
  const atomAlternate = atomLinks.find((candidate) =>
    !candidate?.['@_rel'] || candidate['@_rel'] === 'alternate',
  );
  const link = String(
    directLink?.['@_href'] ??
      atomAlternate?.['@_href'] ??
      textOf(directLink) ??
      '',
  ).trim();
  if (!title || !link) return null;

  // Some publishers put richer copy in content:encoded than in description.
  // Keep the longer RSS field for our original summary, without scraping or
  // republishing the publisher's full webpage.
  const descriptionRaw = textOf(item.description).trim();
  const encodedRaw = textOf(item['content:encoded']).trim();
  const description = stripHtml(descriptionRaw).length >= stripHtml(encodedRaw).length
    ? stripHtml(descriptionRaw)
    : stripHtml(encodedRaw);
  const publishedAt = item.pubDate ? new Date(textOf(item.pubDate)) : null;
  const image = extractImageFromItem(item, encodedRaw || descriptionRaw);
  // Always our own curated Turkish category, never the feed's own <category>
  // tag — those are inconsistent per source (some English, some missing),
  // and a real news site's category nav needs to be clean and predictable.
  const category = source.defaultCategory;

  return {
    id: link,
    headline: stripHtml(title),
    source: source.name,
    sourceIconUrl: iconUrlFor(source.domain),
    imageUrl: image,
    body: description || null,
    externalUrl: link,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null,
    category: category || null,
    lang: source.lang,
  };
}

function parseAtomEntry(entry, source) {
  const title = textOf(entry.title).trim();
  const links = asArray(entry.link);
  const linkEl = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') || links[0];
  const link = (linkEl?.['@_href'] || textOf(entry.id) || '').trim();
  if (!title || !link) return null;

  const summaryRaw = textOf(entry.summary).trim();
  const contentRaw = textOf(entry.content).trim();
  const description = stripHtml(summaryRaw).length >= stripHtml(contentRaw).length
    ? stripHtml(summaryRaw)
    : stripHtml(contentRaw);
  const publishedRaw = entry.published || entry.updated;
  const publishedAt = publishedRaw ? new Date(textOf(publishedRaw)) : null;
  const image = extractImageFromItem(entry, contentRaw || summaryRaw);
  const category = source.defaultCategory;

  return {
    id: link,
    headline: stripHtml(title),
    source: source.name,
    sourceIconUrl: iconUrlFor(source.domain),
    imageUrl: image,
    body: description || null,
    externalUrl: link,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null,
    category: category || null,
    lang: source.lang,
  };
}

export async function fetchSource(source) {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const doc = parser.parse(xml);

    const items = asArray(doc?.rss?.channel?.item);
    if (items.length > 0) {
      return items.map((el) => parseRssItem(el, source)).filter(Boolean);
    }
    const entries = asArray(doc?.feed?.entry);
    return entries.map((el) => parseAtomEntry(el, source)).filter(Boolean);
  } catch (err) {
    console.warn(`[rss] ${source.name} (${source.url}) başarısız: ${err.message}`);
    return [];
  }
}

export async function fetchAllSources(sources) {
  const results = await Promise.all(sources.map(fetchSource));
  return results.flat();
}

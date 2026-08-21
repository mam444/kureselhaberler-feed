import { XMLParser } from 'fast-xml-parser';
import { iconUrlFor } from './sources.mjs';

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
  return String(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
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

function parseRssItem(item, source) {
  const title = textOf(item.title).trim();
  const link = textOf(item.link).trim();
  if (!title || !link) return null;

  const descriptionRaw = textOf(item.description).trim();
  const description = stripHtml(descriptionRaw);
  const publishedAt = item.pubDate ? new Date(textOf(item.pubDate)) : null;
  const image = extractImageFromItem(item, descriptionRaw);
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
  const descriptionRaw = summaryRaw || contentRaw;
  const description = stripHtml(descriptionRaw);
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

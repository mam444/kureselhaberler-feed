/** Decode common HTML entities and numeric character references in RSS text. */
export function decodeHtmlEntities(value) {
  let decoded = String(value ?? '');
  // A few publishers double-escape values (for example &amp;#039;), so make
  // two passes while keeping the supported named set deliberately small.
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded.replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x([\da-f]{1,6})|(\d{1,7}));/gi, (entity, hex, decimal) => {
      const lower = entity.toLowerCase();
      if (lower === '&amp;') return '&';
      if (lower === '&quot;') return '"';
      if (lower === '&apos;') return "'";
      if (lower === '&lt;') return '<';
      if (lower === '&gt;') return '>';
      if (lower === '&nbsp;') return ' ';
      const codePoint = hex ? Number.parseInt(hex, 16) : Number.parseInt(decimal, 10);
      if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return entity;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    });
  }
  return decoded;
}

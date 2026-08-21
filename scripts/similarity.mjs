function wordSet(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4),
  );
}

/**
 * Jaccard benzerliği (0-1). Groq'un metni yeterince yeniden yazmadığı,
 * neredeyse kaynağın kelime kelime aynısını döndürdüğü durumları yakalamak
 * için kullanılır — "verbatim kopyalama" hukuki riskine karşı teknik bir
 * son savunma hattı.
 */
export function jaccardSimilarity(a, b) {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

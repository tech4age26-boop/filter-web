/** Normalize text for fuzzy employee/entity search (Latin accents, extra spaces). */
export function normalizeEntitySearchText(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s@._+-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Build searchable haystack from combobox option fields. */
export function entitySearchHaystack(option) {
    const parts = [
        option?.label,
        option?.subtitle,
        option?.searchText,
        ...(Array.isArray(option?.searchTokens) ? option.searchTokens : []),
    ];
    return normalizeEntitySearchText(parts.filter(Boolean).join(' '));
}

/**
 * Score how well an option matches query (higher = better). Returns -1 if no match.
 */
export function scoreEntitySearchMatch(option, rawQuery) {
    const query = normalizeEntitySearchText(rawQuery);
    if (!query) return 0;

    const haystack = entitySearchHaystack(option);
    if (!haystack) return -1;

    if (haystack === query) return 1000;
    if (haystack.startsWith(query)) return 900;

    const label = normalizeEntitySearchText(option?.label);
    if (label.startsWith(query)) return 850;
    if (label.includes(query)) return 800;

    if (haystack.includes(query)) return 700;

    const tokens = query.split(' ').filter(Boolean);
    if (tokens.length > 1 && tokens.every((t) => haystack.includes(t))) return 600;

    const words = haystack.split(' ').filter(Boolean);
    if (tokens.every((t) => words.some((w) => w.startsWith(t)))) return 500;

    // Subsequence match e.g. "alim" → "aalim"
    let qi = 0;
    for (let i = 0; i < haystack.length && qi < query.length; i += 1) {
        if (haystack[i] === query[qi]) qi += 1;
    }
    if (qi === query.length) return 300;

    return -1;
}

/** Filter + rank options for combobox search. */
export function filterSearchOptions(options, rawQuery, { maxInitial = 100, maxFiltered = 200 } = {}) {
    const list = Array.isArray(options) ? options : [];
    const query = normalizeEntitySearchText(rawQuery);
    if (!query) return list.slice(0, maxInitial);

    return list
        .map((option) => ({ option, score: scoreEntitySearchMatch(option, query) }))
        .filter((row) => row.score >= 0)
        .sort(
            (a, b) =>
                b.score - a.score ||
                String(a.option.label || '').localeCompare(String(b.option.label || '')),
        )
        .slice(0, maxFiltered)
        .map((row) => row.option);
}

export function countSearchMatches(options, rawQuery) {
    const query = normalizeEntitySearchText(rawQuery);
    if (!query) return Array.isArray(options) ? options.length : 0;
    return (Array.isArray(options) ? options : []).filter(
        (option) => scoreEntitySearchMatch(option, query) >= 0,
    ).length;
}

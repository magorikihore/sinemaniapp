// Lightweight SRT / WebVTT parser.
// Returns an array of cues sorted by startMs.

export interface SubtitleCue {
    startMs: number;
    endMs: number;
    text: string;
}

function tsToMs(ts: string): number {
    // Accepts 00:00:00,000 (SRT) or 00:00:00.000 (VTT) or 00:00.000
    const clean = ts.trim().replace(',', '.');
    const parts = clean.split(':');
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) {
        h = parseInt(parts[0], 10) || 0;
        m = parseInt(parts[1], 10) || 0;
        s = parseFloat(parts[2]) || 0;
    } else if (parts.length === 2) {
        m = parseInt(parts[0], 10) || 0;
        s = parseFloat(parts[1]) || 0;
    } else {
        return 0;
    }
    return Math.round(((h * 3600) + (m * 60) + s) * 1000);
}

export function parseSubtitles(raw: string): SubtitleCue[] {
    if (!raw) return [];
    // Normalize line endings, strip BOM and "WEBVTT" header
    const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/^WEBVTT[^\n]*\n+/, '');
    const blocks = text.split(/\n\n+/);
    const cues: SubtitleCue[] = [];
    const arrowRe = /(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/;
    for (const block of blocks) {
        const lines = block.split('\n').filter(Boolean);
        if (lines.length === 0) continue;
        // Find arrow line (skip optional numeric/cue id line)
        let arrowIdx = lines.findIndex(l => arrowRe.test(l));
        if (arrowIdx < 0) continue;
        const m = lines[arrowIdx].match(arrowRe);
        if (!m) continue;
        const startMs = tsToMs(m[1]);
        const endMs = tsToMs(m[2]);
        const body = lines.slice(arrowIdx + 1).join('\n').trim();
        if (!body) continue;
        // Strip basic tags
        const clean = body.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '');
        cues.push({ startMs, endMs, text: clean });
    }
    cues.sort((a, b) => a.startMs - b.startMs);
    return cues;
}

// Binary-search-ish: find cue whose [start,end] contains posMs
export function findCue(cues: SubtitleCue[], posMs: number): SubtitleCue | null {
    if (!cues.length) return null;
    // Linear is fine for typical sizes; can binary search if needed.
    let lo = 0, hi = cues.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const c = cues[mid];
        if (posMs < c.startMs) hi = mid - 1;
        else if (posMs > c.endMs) lo = mid + 1;
        else return c;
    }
    return null;
}

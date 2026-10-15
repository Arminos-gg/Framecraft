/**
 * What an Embed shows: the address of a YouTube player or a map, worked out from what people
 * paste or type in Source. Both are other sites' pages in an iframe, so neither needs a key.
 */
import type { EmbedKind } from './classes.ts';

/** The parts of an Embed these need. */
export interface EmbedProps {
  readonly Kind: EmbedKind;
  readonly Source: string;
  readonly Autoplay: boolean;
  readonly Zoom: number;
  readonly Title: string;
}

const VIDEO_ID = /^[\w-]{11}$/;

/**
 * The video id in a YouTube link (watch, youtu.be, embed, shorts or live), or in a bare id.
 * Undefined when there's none.
 */
export function youtubeId(source: string): string | undefined {
  const s = source.trim();
  if (VIDEO_ID.test(s)) return s;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | undefined;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [first, second] = url.pathname.split('/').slice(1);
    id =
      first === 'watch'
        ? (url.searchParams.get('v') ?? undefined)
        : ['embed', 'shorts', 'live', 'v'].includes(first ?? '')
          ? second
          : undefined;
  }
  return id && VIDEO_ID.test(id) ? id : undefined;
}

/** Where a YouTube link starts playing, in seconds: `t=90`, `t=1m30s` or `start=90`. */
export function youtubeStart(source: string): number {
  const m = /[?&#](?:t|start)=([\dhms]+)/.exec(source);
  if (!m) return 0;
  const t = m[1]!;
  if (/^\d+$/.test(t)) return Number(t);
  const part = (unit: string) => Number(new RegExp(`(\\d+)${unit}`).exec(t)?.[1] ?? 0);
  return part('h') * 3600 + part('m') * 60 + part('s');
}

/** The address the iframe loads, or undefined when Source doesn't give one yet. */
export function embedSrc(p: EmbedProps): string | undefined {
  if (p.Kind === 'Map') {
    const place = p.Source.trim();
    if (!place) return undefined;
    return `https://maps.google.com/maps?q=${encodeURIComponent(place)}&z=${p.Zoom}&output=embed`;
  }
  const id = youtubeId(p.Source);
  if (!id) return undefined;
  const params = new URLSearchParams();
  const start = youtubeStart(p.Source);
  if (start) params.set('start', String(start));
  // Browsers only start a video by themselves when it's muted.
  if (p.Autoplay) {
    params.set('autoplay', '1');
    params.set('mute', '1');
  }
  params.set('rel', '0');
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

/** The picture YouTube shows before a video plays, for the editor. */
export const youtubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** What a screen reader says for the iframe: its Title, or what it shows. */
export function embedTitle(p: EmbedProps): string {
  if (p.Title.trim()) return p.Title.trim();
  return p.Kind === 'Map' ? `Map of ${p.Source.trim() || 'a place'}` : 'YouTube video';
}

/** What the iframe may do: YouTube's player needs these to play and go full screen. */
export const EMBED_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

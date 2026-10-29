import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { ICON_PATH } from './assets.js';
import './fonts.js';

const W = 1200;
const H = 440;
const GREEN = '#00FF66';
const INK = '#0B0D0C';
const MUTED = '#8A9A90';
/** Discord's CDN normally answers in well under a second; past this the card goes out without the photo. */
const AVATAR_TIMEOUT_MS = 8_000;

export interface JoinCardInfo {
  name: string;
  avatarUrl: string;
  /** e.g. "4th" */
  ordinal: string;
}

/** Shrink the font until `text` fits `maxWidth`, then ellipsize as a last resort. */
export function fitText(ctx: SKRSContext2D, text: string, maxWidth: number, startSize: number, minSize: number, weight: number): string {
  let size = startSize;
  ctx.font = `${weight} ${size}px Inter`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = `${weight} ${size}px Inter`;
  }
  let out = text;
  while (ctx.measureText(out).width > maxWidth && out.length > 1) out = out.slice(0, -2) + '…';
  return out;
}

/** Deterministic pseudo-random bar heights so each name gets its own waveform. */
export function waveform(seed: string, count: number): number[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Array.from({ length: count }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) ^ i;
    const noise = ((h >>> 0) % 1000) / 1000;
    const envelope = 0.35 + 0.65 * Math.sin((i / count) * Math.PI);
    return 0.15 + 0.85 * noise * envelope;
  });
}

/** Render the 1200×440 "now playing" welcome card as a PNG. */
export async function renderJoinCard({ name, avatarUrl, ordinal }: JoinCardInfo): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Ground and glow
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(220, 220, 40, 220, 220, 420);
  glow.addColorStop(0, 'rgba(0,255,102,0.28)');
  glow.addColorStop(1, 'rgba(0,255,102,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Waveform across the bottom
  const bars = waveform(name, 96);
  const barW = W / bars.length;
  bars.forEach((v, i) => {
    const bh = v * 120;
    ctx.fillStyle = `rgba(0,255,102,${0.06 + v * 0.1})`;
    ctx.fillRect(i * barW + 2, H - bh, barW - 4, bh);
  });

  // Avatar with green ring
  const cx = 220;
  const cy = 210;
  const r = 132;
  ctx.save();
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.fillStyle = GREEN;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  try {
    // Fetched here rather than by loadImage, whose download has no timeout: one stalled request
    // would hold the welcome forever without an error.
    const res = await fetch(avatarUrl, { signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`avatar request returned ${res.status}`);
    const avatar = await loadImage(Buffer.from(await res.arrayBuffer()));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } catch (err) {
    console.warn('[Discord Bot] Join card avatar failed to load:', (err as Error).message);
  }

  // Pulse mark, top right
  try {
    const mark = await loadImage(ICON_PATH);
    ctx.drawImage(mark, W - 120, 28, 84, 84);
  } catch {
    // card still reads without the mark
  }

  // Text block
  const x = 420;
  const maxW = W - x - 150;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = GREEN;
  ctx.font = '600 22px Inter';
  ctx.letterSpacing = '6px';
  ctx.fillText('NOW PLAYING ON PULSIFY', x, 118);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(fitText(ctx, name, maxW, 76, 40, 800), x, 196);

  ctx.fillStyle = MUTED;
  ctx.font = '400 28px Inter';
  ctx.fillText(`Welcome to the floor · ${ordinal} through the door`, x, 244);

  // Progress bar
  const barY = 300;
  const barX2 = W - 70;
  const progress = 0.08;
  ctx.fillStyle = '#1F2A23';
  ctx.beginPath();
  ctx.roundRect(x, barY, barX2 - x, 8, 4);
  ctx.fill();
  const knobX = x + (barX2 - x) * progress;
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.roundRect(x, barY, knobX - x, 8, 4);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(knobX, barY + 4, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = MUTED;
  ctx.font = '600 20px Inter';
  ctx.fillText('0:01', x, barY + 44);
  const end = '3:30';
  ctx.fillText(end, barX2 - ctx.measureText(end).width, barY + 44);

  return canvas.encode('png');
}

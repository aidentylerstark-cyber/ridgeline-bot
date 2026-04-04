import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';
import { SWIPEMATCH } from '../config.js';

// ─────────────────────────────────────────
// Card Dimensions
// ─────────────────────────────────────────

const CARD_W = 680;
const CARD_H = 920;
const PADDING = 32;
const AVATAR_SIZE = 160;
const PILL_H = 34;
const PILL_RADIUS = 17;
const PANEL_RADIUS = 16;

// ─────────────────────────────────────────
// Theme Gradient Definitions
// ─────────────────────────────────────────

interface ThemeGradient {
  stops: Array<[number, string]>;
  overlayOpacity: number;
}

// Dark-base gradients — theme color as accent, dark enough for white text
const THEME_GRADIENTS: Record<string, ThemeGradient> = {
  default:    { stops: [[0, '#2A1520'], [0.4, '#3D1F2A'], [1, '#1A0E14']], overlayOpacity: 0 },
  country:    { stops: [[0, '#1A1408'], [0.4, '#2D2210'], [1, '#1A1408']], overlayOpacity: 0 },
  midnight:   { stops: [[0, '#08090C'], [0.4, '#0D1117'], [1, '#08090C']], overlayOpacity: 0 },
  sunset:     { stops: [[0, '#1A0E05'], [0.4, '#2D1A0A'], [1, '#1A0E05']], overlayOpacity: 0 },
  wildflower: { stops: [[0, '#1A0E16'], [0.4, '#2D1A28'], [1, '#1A0E16']], overlayOpacity: 0 },
  thunder:    { stops: [[0, '#0A0B10'], [0.4, '#141628'], [1, '#0A0B10']], overlayOpacity: 0 },
  campfire:   { stops: [[0, '#1A0800'], [0.4, '#2D1205'], [1, '#1A0800']], overlayOpacity: 0 },
  moonshine:  { stops: [[0, '#1A1408'], [0.4, '#2D2210'], [1, '#1A1408']], overlayOpacity: 0 },
  lavender:   { stops: [[0, '#120E1A'], [0.4, '#1E182D'], [1, '#120E1A']], overlayOpacity: 0 },
  riverbank:  { stops: [[0, '#0A1A10'], [0.4, '#142D1E'], [1, '#0A1A10']], overlayOpacity: 0 },
  neon:       { stops: [[0, '#0D0010'], [0.4, '#1A0020'], [1, '#0D0010']], overlayOpacity: 0 },
  vintage:    { stops: [[0, '#140E0A'], [0.4, '#241C14'], [1, '#140E0A']], overlayOpacity: 0 },
};

// ─────────────────────────────────────────
// Profile Card Data Interface
// ─────────────────────────────────────────

export interface CardData {
  characterName: string;
  age?: string | null;
  gender?: string | null;
  interestedIn?: string | null;
  bio?: string | null;
  interests: string[];
  slName?: string | null;
  theme?: string | null;
  vibe?: string;
  promptQuestion?: string | null;
  promptAnswer?: string | null;
  photoUrl?: string | null;
  avatarUrl?: string | null;
  compatPercent?: number | null;
  sharedInterests?: string[];
  swipesRemaining?: number;
  isOwnProfile?: boolean;
}

// ─────────────────────────────────────────
// Main Render Function
// ─────────────────────────────────────────

export async function renderProfileCard(data: CardData): Promise<AttachmentBuilder> {
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext('2d');

  const themeKey = data.theme ?? 'default';
  const theme = SWIPEMATCH.profileThemes[themeKey] ?? SWIPEMATCH.profileThemes['default'];
  const gradient = THEME_GRADIENTS[themeKey] ?? THEME_GRADIENTS['default'];

  // ── 1. Background gradient ──
  drawBackground(ctx, gradient, theme.color);

  // ── 2. Photo or avatar as hero (top portion) ──
  let heroImage: Awaited<ReturnType<typeof loadImage>> | null = null;
  const heroUrl = data.photoUrl || data.avatarUrl;
  if (heroUrl) {
    try {
      heroImage = await loadImage(heroUrl);
    } catch { /* image fetch failed */ }
  }

  if (heroImage) {
    // Draw hero image in top half with gradient fade to background
    const heroH = 400;
    drawImageCover(ctx, heroImage, 0, 0, CARD_W, heroH);

    // Gradient overlay from transparent to theme color at bottom of hero
    const fadeGrad = ctx.createLinearGradient(0, heroH - 150, 0, heroH);
    const bgColor = hexFromInt(theme.color);
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    fadeGrad.addColorStop(1, bgColor);
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, heroH - 150, CARD_W, 150);
  }

  // ── 3. Avatar circle (overlapping hero/content boundary) ──
  const avatarY = heroImage ? 320 : 40;
  if (data.avatarUrl && heroImage) {
    // Small avatar circle on top of hero image
    try {
      const avatarImg = await loadImage(data.avatarUrl);
      const ax = CARD_W - 80 - PADDING;
      const ay = avatarY - 30;
      const aSize = 64;

      // Ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + aSize / 2, ay + aSize / 2, aSize / 2 + 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Clip and draw
      ctx.beginPath();
      ctx.arc(ax + aSize / 2, ay + aSize / 2, aSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, ax, ay, aSize, aSize);
      ctx.restore();
    } catch { /* avatar fetch fail */ }
  } else if (data.avatarUrl && !heroImage) {
    // No photo — draw large centered avatar
    try {
      const avatarImg = await loadImage(data.avatarUrl);
      const cx = CARD_W / 2;
      const cy = avatarY + AVATAR_SIZE / 2 + 20;
      const r = AVATAR_SIZE / 2;

      // Gold ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = hexFromInt(theme.color);
      ctx.lineWidth = 4;
      ctx.stroke();

      // Clip and draw
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, cx - r, cy - r, AVATAR_SIZE, AVATAR_SIZE);
      ctx.restore();
    } catch { /* avatar fetch fail */ }
  }

  // ── 4. Content area ──
  const contentY = heroImage ? 410 : avatarY + AVATAR_SIZE + 60;
  let y = contentY;

  // Vibe tag
  if (theme.vibe) {
    ctx.font = '600 16px sans-serif';
    ctx.fillStyle = hexFromInt(theme.color);
    ctx.textAlign = 'center';
    ctx.fillText(theme.vibe, CARD_W / 2, y);
    y += 28;
  }

  // Name + Age (with text shadow for readability)
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  const nameText = `${data.characterName}${data.age ? `, ${data.age}` : ''}`;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillText(nameText, CARD_W / 2 + 2, y + 2);
  // Main text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(nameText, CARD_W / 2, y);
  y += 32;

  // Gender + Looking for
  if (data.gender || data.interestedIn) {
    ctx.font = '18px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const subParts: string[] = [];
    if (data.gender) subParts.push(data.gender);
    if (data.interestedIn) subParts.push(`Looking for ${data.interestedIn}`);
    ctx.fillText(subParts.join('  ·  '), CARD_W / 2, y);
    y += 28;
  }

  // Compatibility bar
  if (data.compatPercent != null && data.compatPercent > 0) {
    y += 8;
    drawCompatBar(ctx, data.compatPercent, y, theme.color);
    y += 36;
  }

  // ── 5. Bio panel (frosted glass) ──
  if (data.bio) {
    y += 12;
    const bioLines = wrapText(ctx, data.bio, CARD_W - PADDING * 4, '18px sans-serif');
    const panelH = bioLines.length * 26 + 28;

    drawFrostedPanel(ctx, PADDING, y, CARD_W - PADDING * 2, panelH);

    ctx.font = 'italic 18px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    for (let i = 0; i < bioLines.length; i++) {
      const prefix = i === 0 ? '"' : '';
      const suffix = i === bioLines.length - 1 ? '"' : '';
      ctx.fillText(`${prefix}${bioLines[i]}${suffix}`, PADDING + 18, y + 26 + i * 26);
    }
    y += panelH + 12;
  }

  // ── 6. Interest pills ──
  if (data.interests.length > 0) {
    y += 6;
    y = drawInterestPills(ctx, data.interests, y, theme.color, data.sharedInterests);
    y += 10;
  }

  // ── 7. Weekly prompt ──
  if (data.promptQuestion && data.promptAnswer) {
    const promptLines = wrapText(ctx, data.promptAnswer, CARD_W - PADDING * 4 - 16, '14px sans-serif');
    const panelH = 24 + promptLines.length * 20 + 16;

    drawFrostedPanel(ctx, PADDING, y, CARD_W - PADDING * 2, panelH);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = hexFromInt(theme.color);
    ctx.textAlign = 'left';
    ctx.fillText(`💬 ${data.promptQuestion}`, PADDING + 14, y + 20);

    ctx.font = 'italic 14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < promptLines.length; i++) {
      ctx.fillText(promptLines[i], PADDING + 20, y + 40 + i * 20);
    }
    y += panelH + 10;
  }

  // ── 8. SL Name / Theme badge (bottom row) ──
  {
    const bottomItems: string[] = [];
    if (data.slName) bottomItems.push(`🌐 ${data.slName}`);
    if (themeKey !== 'default') bottomItems.push(`🎨 ${theme.label}`);
    if (data.sharedInterests && data.sharedInterests.length > 0) {
      bottomItems.push(`🤝 ${data.sharedInterests.length} in common`);
    }

    if (bottomItems.length > 0) {
      ctx.font = '15px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(bottomItems.join('  ·  '), CARD_W / 2, CARD_H - 44);
    }
  }

  // ── 9. Footer ──
  if (data.swipesRemaining != null) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(`${data.swipesRemaining} swipes left today · Ridgeline Connections`, CARD_W / 2, CARD_H - 18);
  } else if (data.isOwnProfile) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('Edit · Photos · Theme · Prompt', CARD_W / 2, CARD_H - 18);
  }

  // ── Encode and return ──
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'profile-card.png' });
}

// ─────────────────────────────────────────
// Drawing Helpers
// ─────────────────────────────────────────

function drawBackground(ctx: SKRSContext2D, gradient: ThemeGradient, themeColor: number): void {
  // Dark base gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_H);
  for (const [stop, color] of gradient.stops) {
    grad.addColorStop(stop, color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Subtle theme-colored accent glow at top
  const r = (themeColor >> 16) & 0xff;
  const g = (themeColor >> 8) & 0xff;
  const b = themeColor & 0xff;
  const accentGrad = ctx.createLinearGradient(0, 0, 0, 300);
  accentGrad.addColorStop(0, `rgba(${r},${g},${b},0.15)`);
  accentGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, CARD_W, 300);

  // Thin accent line at very top
  ctx.fillStyle = hexFromInt(themeColor);
  ctx.fillRect(0, 0, CARD_W, 3);
}

function drawImageCover(ctx: SKRSContext2D, img: unknown, x: number, y: number, w: number, h: number): void {
  const imgAny = img as { width: number; height: number };
  const scale = Math.max(w / imgAny.width, h / imgAny.height);
  const sw = imgAny.width * scale;
  const sh = imgAny.height * scale;
  const sx = x + (w - sw) / 2;
  const sy = y + (h - sh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img as CanvasImageSource, sx, sy, sw, sh);
  ctx.restore();
}

function drawFrostedPanel(ctx: SKRSContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, PANEL_RADIUS);
  ctx.fill();

  // Visible border
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawCompatBar(ctx: SKRSContext2D, percent: number, y: number, themeColor: number): void {
  const barW = 240;
  const barH = 14;
  const x = (CARD_W - barW) / 2;

  const emoji = percent >= 80 ? '🔥' : percent >= 60 ? '✨' : percent >= 40 ? '💫' : '👀';

  // Label
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(`${emoji} ${percent}% Compatible`, CARD_W / 2, y);

  // Bar background
  const barY = y + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  roundRect(ctx, x, barY, barW, barH, barH / 2);
  ctx.fill();

  // Bar fill
  const fillW = Math.max(barH, (percent / 100) * barW);
  const barGrad = ctx.createLinearGradient(x, 0, x + fillW, 0);
  barGrad.addColorStop(0, hexFromInt(themeColor));
  barGrad.addColorStop(1, lighten(hexFromInt(themeColor), 30));
  ctx.fillStyle = barGrad;
  ctx.beginPath();
  roundRect(ctx, x, barY, fillW, barH, barH / 2);
  ctx.fill();
}

function drawInterestPills(
  ctx: SKRSContext2D,
  interests: string[],
  startY: number,
  themeColor: number,
  shared?: string[],
): number {
  ctx.font = '16px sans-serif';
  const sharedSet = new Set(shared ?? []);
  let x = PADDING;
  let y = startY;
  const maxW = CARD_W - PADDING * 2;

  for (const interest of interests) {
    const textW = ctx.measureText(interest).width;
    const pillW = textW + 20;

    // Wrap to next line
    if (x + pillW > PADDING + maxW) {
      x = PADDING;
      y += PILL_H + 8;
    }

    const isShared = sharedSet.has(interest);

    // Pill background
    ctx.fillStyle = isShared
      ? `rgba(${(themeColor >> 16) & 0xff},${(themeColor >> 8) & 0xff},${themeColor & 0xff},0.6)`
      : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    roundRect(ctx, x, y, pillW, PILL_H, PILL_RADIUS);
    ctx.fill();

    if (isShared) {
      ctx.strokeStyle = hexFromInt(themeColor);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Pill text
    ctx.fillStyle = isShared ? '#ffffff' : 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText(interest, x + 12, y + 23);

    x += pillW + 8;
  }

  return y + PILL_H;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number, font: string): string[] {
  ctx.font = font;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 4); // Max 4 lines
}

function hexFromInt(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ─────────────────────────────────────────
// Render Cache (5-minute TTL)
// ─────────────────────────────────────────

const cardCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function getCachedCard(userId: string): Buffer | null {
  const entry = cardCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cardCache.delete(userId);
    return null;
  }
  return entry.buffer;
}

export function cacheCard(userId: string, buffer: Buffer): void {
  cardCache.set(userId, { buffer, timestamp: Date.now() });
  // Prune old entries
  if (cardCache.size > 200) {
    const now = Date.now();
    for (const [key, val] of cardCache) {
      if (now - val.timestamp > CACHE_TTL) cardCache.delete(key);
    }
  }
}

export function invalidateCardCache(userId: string): void {
  cardCache.delete(userId);
}

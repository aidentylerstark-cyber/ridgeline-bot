import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { ICON_PATH } from './assets.js';
import { fitText } from './join-card-image.js';
import './fonts.js';

const W = 1000;
const H = 620;
const GREEN = '#00FF66';
const INK = '#0B0D0C';
const PANEL = '#121614';
const MUTED = '#7E8C84';

export interface EmployeeSheet {
  name: string;
  phone: string;
  position: string;
  routing: string;
}

export interface BadgeInput extends EmployeeSheet {
  /** Image URL or the image bytes. */
  photo: string | Buffer;
  employeeNo: number;
}

function label(ctx: SKRSContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = MUTED;
  ctx.font = '600 15px Inter';
  ctx.letterSpacing = '4px';
  ctx.fillText(text, x, y);
  ctx.letterSpacing = '0px';
}

/** Barcode stripes derived from the name, so each badge has its own. */
function barcode(ctx: SKRSContext2D, seed: string, x: number, y: number, w: number, h: number): void {
  let hash = 2166136261;
  for (const ch of seed) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  ctx.fillStyle = '#E8EFEA';
  let cx = x;
  while (cx < x + w) {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    const bar = 2 + ((hash >>> 0) % 4);
    const gap = 2 + ((hash >>> 8) % 4);
    ctx.fillRect(cx, y, Math.min(bar, x + w - cx), h);
    cx += bar + gap;
  }
}

/** Render the Pulsify employee ID badge (1000×620 PNG) with the employee's photo. */
export async function renderEmployeeBadge(input: BadgeInput): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Card body
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 28);
  ctx.fill();
  ctx.save();
  ctx.clip();

  const glow = ctx.createRadialGradient(190, 330, 40, 190, 330, 460);
  glow.addColorStop(0, 'rgba(0,255,102,0.16)');
  glow.addColorStop(1, 'rgba(0,255,102,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header band
  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, '#0F2A1A');
  band.addColorStop(1, '#0B0D0C');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 104);
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 104, W, 3);

  try {
    ctx.drawImage(await loadImage(ICON_PATH), 34, 20, 64, 64);
  } catch {
    // header still reads without the mark
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 38px Inter';
  ctx.fillText('Pulsify', 112, 64);
  ctx.fillStyle = MUTED;
  ctx.font = '400 16px Inter';
  ctx.fillText('A Pulse Media Company', 114, 88);

  ctx.textAlign = 'right';
  ctx.fillStyle = GREEN;
  ctx.font = '800 26px Inter';
  ctx.letterSpacing = '8px';
  ctx.fillText('EMPLOYEE', W - 34, 58);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = MUTED;
  ctx.font = '600 16px Inter';
  ctx.fillText(`No. ${String(input.employeeNo).padStart(4, '0')}`, W - 40, 86);
  ctx.textAlign = 'left';

  // Photo, cover-fit into a rounded frame with a green ring
  const px = 40;
  const py = 136;
  const pw = 290;
  const ph = 370;
  ctx.save();
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 28;
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.roundRect(px - 5, py - 5, pw + 10, ph + 10, 22);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 18);
  ctx.fill();
  try {
    const photo = await loadImage(input.photo);
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const sw = pw / scale;
    const sh = ph / scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 18);
    ctx.clip();
    // Bias the crop toward the top so faces stay in frame.
    ctx.drawImage(photo, (photo.width - sw) / 2, Math.max(0, (photo.height - sh) * 0.2), sw, sh, px, py, pw, ph);
    ctx.restore();
  } catch (err) {
    console.warn('[Discord Bot] Employee photo failed to load:', (err as Error).message);
    ctx.fillStyle = MUTED;
    ctx.font = '600 20px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No photo', px + pw / 2, py + ph / 2);
    ctx.textAlign = 'left';
  }

  // Details
  const x = 380;
  const maxW = W - x - 44;
  label(ctx, 'NAME', x, 160);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(fitText(ctx, input.name, maxW, 52, 30, 800), x, 214);

  label(ctx, 'POSITION', x, 264);
  ctx.fillStyle = GREEN;
  ctx.fillText(fitText(ctx, input.position, maxW, 32, 22, 600), x, 302);

  ctx.fillStyle = '#1F2A23';
  ctx.fillRect(x, 330, maxW, 2);

  label(ctx, 'PHONE', x, 370);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(fitText(ctx, input.phone, 250, 30, 20, 600), x, 406);

  label(ctx, 'ROUTING NO.', x + 280, 370);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(fitText(ctx, input.routing, maxW - 280, 30, 18, 600), x + 280, 406);

  // Footer: barcode and licence line
  barcode(ctx, `${input.name}${input.employeeNo}`, x, 486, 300, 34);
  ctx.fillStyle = MUTED;
  ctx.font = '400 15px Inter';
  ctx.fillText('LS-BL-000424 · City of Los Santos', x, 548);
  ctx.textAlign = 'right';
  ctx.fillText('Business line 19003998', W - 44, 548);
  ctx.textAlign = 'left';

  ctx.fillStyle = GREEN;
  ctx.fillRect(0, H - 8, W, 8);
  ctx.restore();

  return canvas.encode('png');
}

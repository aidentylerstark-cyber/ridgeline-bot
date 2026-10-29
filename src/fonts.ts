import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

// Inter, the brand typeface, bundled so rendered cards look the same on any host.
const fontPath = (weight: number) => fileURLToPath(new URL(`../assets/fonts/inter-latin-${weight}-normal.woff2`, import.meta.url));
for (const weight of [400, 600, 800]) GlobalFonts.registerFromPath(fontPath(weight), 'Inter');

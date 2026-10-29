import { fileURLToPath } from 'node:url';
import { AttachmentBuilder } from 'discord.js';

const assetPath = (file: string) => fileURLToPath(new URL(`../assets/${file}`, import.meta.url));

export const ICON_PATH = assetPath('pulse-icon-512.png');
export const WORDMARK_PATH = assetPath('pulsify-wordmark.png');

// Referenced from embeds as attachment://<name>; the file must be sent with the same message.
export const ICON_URL = 'attachment://pulse-icon.png';
export const WORDMARK_URL = 'attachment://pulsify-wordmark.png';

export const iconFile = () => new AttachmentBuilder(ICON_PATH, { name: 'pulse-icon.png' });
export const wordmarkFile = () => new AttachmentBuilder(WORDMARK_PATH, { name: 'pulsify-wordmark.png' });

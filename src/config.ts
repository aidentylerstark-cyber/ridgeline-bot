import 'dotenv/config';

function required(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  console.error(`[Discord Bot] Missing required env var ${names.join(' or ')} — see .env.example`);
  process.exit(1);
}

export const config = {
  token: required('DISCORD_TOKEN', 'DISCORD_BOT_TOKEN'),
  guildId: process.env.GUILD_ID || '1548799697781792900',
  welcomeChannelId: process.env.WELCOME_CHANNEL_ID || undefined,
  supportChannelId: process.env.SUPPORT_CHANNEL_ID || undefined,
  port: Number(process.env.PORT ?? 5000),
};

// Names, colours, links and voice follow the Pulsify Discord Server Brief.
export const brand = {
  name: 'Pulsify',
  // In-city listening only (car radio / boombox), not a brand of its own.
  stationDial: 'Station 327',
  // In-city phone line for calling Pulsify.
  phone: '19003998',
  chart: 'The Pulsify 10',
  color: 0x00ff66,
  footer: 'Pulsify · A Pulse Media Company · © 2026 · LS-BL-000424 · City of Los Santos · 19003998',
  ooc: '(( Pulsify is a player-run, in-character fan project. It is not an official GTA World service. ))',
  /** Server description (Discovery, invites, the server profile). Discord allows 120 characters. */
  description: 'The records Los Santos is making: stream, charts, artist merch. (( Player-run fan project, not official GTA World ))',
  links: {
    website: 'https://pulsify.world',
    merch: 'https://merch.pulsify.world',
    stream: 'https://pulsify.world/stream',
    charts: 'https://pulsify.world/charts',
    rules: 'https://pulsify.world/rules',
    advertise: 'https://pulsify.world/advertise',
    events: 'https://pulsify.world/events',
    friday: 'https://pulsify.world/friday',
    facebrowser: 'https://face.gta.world/page/pulsify',
  },
};

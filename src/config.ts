import 'dotenv/config';

function required(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  console.error(`[Discord Bot] Missing required env var ${names.join(' or ')} — see .env.example`);
  process.exit(1);
}

/** A Discord ID from the environment, without the stray spaces, quotes or punctuation a dashboard paste can add. */
function snowflake(name: string, fallback?: string): string | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const id = raw.replace(/\D/g, '');
  if (!/^\d{17,20}$/.test(id)) {
    console.error(`[Discord Bot] ${name} should be a Discord ID (17-20 digits), got "${raw}"`);
    process.exit(1);
  }
  if (id !== raw) console.warn(`[Discord Bot] ${name} had extra characters ("${raw}"); using ${id}`);
  return id;
}

export const config = {
  token: required('DISCORD_TOKEN', 'DISCORD_BOT_TOKEN'),
  guildId: snowflake('GUILD_ID', '1548799697781792900')!,
  welcomeChannelId: snowflake('WELCOME_CHANNEL_ID'),
  supportChannelId: snowflake('SUPPORT_CHANNEL_ID'),
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

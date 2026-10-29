import { Client, GatewayIntentBits, type Guild } from 'discord.js';
import { config } from '../config.js';

/** Log in, hand the guild to `task`, then disconnect. For one-off setup scripts. */
export async function withGuild(task: (guild: Guild) => Promise<void>): Promise<void> {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.rest.on('rateLimited', (info) =>
    console.warn(`[Discord Bot] Rate limited on ${info.method} ${info.route}, waiting ${Math.ceil(info.retryAfter / 1000)}s`),
  );
  try {
    // Subscribe before logging in: "ready" can fire before login() resolves.
    const ready = new Promise<void>((resolve) => client.once('clientReady', () => resolve()));
    await client.login(config.token);
    await ready;
    const guild = await client.guilds.fetch(config.guildId);
    console.log(`[Discord Bot] Connected as ${client.user?.tag} to "${guild.name}"`);
    await task(guild);
  } catch (err) {
    console.error('[Discord Bot] Setup failed:', err);
    process.exitCode = 1;
  } finally {
    await client.destroy();
  }
}

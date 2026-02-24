import { ActivityType, type Client } from 'discord.js';
import { GUILD_ID } from '../config.js';
import { claimInstanceLock, startInstanceHeartbeat } from '../utilities/instance-lock.js';
import { registerSlashCommands } from '../commands/index.js';
import { updateStatsChannels } from '../features/stats-channels.js';

export function setupReadyHandler(client: Client) {
  client.on('ready', async () => {
    console.log(`[Discord Bot] Logged in as ${client.user?.tag}`);
    console.log(`[Discord Bot] Serving guild: ${GUILD_ID}`);

    // Claim the instance lock — tells any older running instance to shut down
    try {
      await claimInstanceLock();
      startInstanceHeartbeat(client);
    } catch (err) {
      console.error('[Peaches] Failed to claim instance lock (non-fatal):', err);
    }

    // Register slash commands with the guild
    try {
      await registerSlashCommands(client);
    } catch (err) {
      console.error('[Peaches] Failed to register slash commands (non-fatal):', err);
    }

    // Set bot nickname to Peaches
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild && client.user) {
        const me = await guild.members.fetch(client.user.id);
        await me.setNickname('Peaches 🍑');
        console.log('[Discord Bot] Nickname set to Peaches 🍑');
      }
    } catch {
      console.log('[Discord Bot] Could not set nickname (may already be set)');
    }

    // Set activity
    client.user?.setPresence({
      activities: [{ name: 'the town gossip', type: ActivityType.Listening }],
      status: 'online',
    });

    // Start stats channel update interval (every 10 minutes)
    updateStatsChannels(client).catch(() => {});
    setInterval(() => updateStatsChannels(client).catch(() => {}), 10 * 60 * 1000);
  });
}

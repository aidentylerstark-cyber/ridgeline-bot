import { ActivityType, type Client } from 'discord.js';
import { GUILD_ID } from '../config.js';
import { claimInstanceLock, startInstanceHeartbeat } from '../utilities/instance-lock.js';

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

    // Set bot nickname to Peaches
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild && client.user) {
        const me = await guild.members.fetch(client.user.id);
        await me.setNickname('Peaches \uD83C\uDF51');
        console.log('[Discord Bot] Nickname set to Peaches \uD83C\uDF51');
      }
    } catch {
      console.log('[Discord Bot] Could not set nickname (may already be set)');
    }

    // Set activity
    client.user?.setPresence({
      activities: [{ name: 'the town gossip', type: ActivityType.Listening }],
      status: 'online',
    });

    // Clear old slash commands (XP/kudos system was removed)
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild) {
        await guild.commands.set([]);
        console.log('[Peaches] Cleared old slash commands');
      }
    } catch (err) {
      console.error('[Peaches] Failed to clear slash commands:', err);
    }
  });
}

import { ActivityType, ChannelType, REST, Routes, type Client } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { claimInstanceLock, startInstanceHeartbeat } from '../utilities/instance-lock.js';
import { registerSlashCommands } from '../commands/index.js';
import { updateStatsChannels } from '../features/stats-channels.js';
import { postTimecardPanel } from '../panels/timecard-panel.js';

let _statsInterval: ReturnType<typeof setInterval> | null = null;

/** Clear the stats update interval on shutdown to prevent timer leaks. */
export function destroyStatsInterval(): void {
  if (_statsInterval) {
    clearInterval(_statsInterval);
    _statsInterval = null;
  }
}

export function setupReadyHandler(client: Client) {
  client.on('clientReady', async () => {
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

    // Pin stats category to the top of the channel list
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      const token = process.env.DISCORD_BOT_TOKEN;
      if (guild && token && CHANNELS.statsMembersVC) {
        await guild.channels.fetch();
        const statsVC = guild.channels.cache.get(CHANNELS.statsMembersVC);
        const statsCategoryId = statsVC?.parentId;
        if (statsCategoryId) {
          const categories = guild.channels.cache
            .filter(c => c.type === ChannelType.GuildCategory)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

          const positionUpdates: { id: string; position: number }[] = [
            { id: statsCategoryId, position: 0 },
          ];
          let pos = 1;
          for (const cat of categories.values()) {
            if (cat.id !== statsCategoryId) positionUpdates.push({ id: cat.id, position: pos++ });
          }

          const rest = new REST({ version: '10' }).setToken(token);
          await rest.patch(Routes.guildChannels(GUILD_ID), { body: positionUpdates });
          console.log('[Discord Bot] Stats category pinned to position 0');
        }
      }
    } catch (err) {
      console.error('[Discord Bot] Could not pin stats category (non-fatal):', err);
    }

    // Post timecard panels (creates channels if missing)
    try {
      await postTimecardPanel(client);
    } catch (err) {
      console.error('[Peaches] Failed to post timecard panels (non-fatal):', err);
    }

    // Start stats channel update interval (every 10 minutes)
    updateStatsChannels(client).catch(err => console.error('[Peaches] Stats channel update failed:', err));
    _statsInterval = setInterval(() => updateStatsChannels(client).catch(err => console.error('[Peaches] Stats channel update failed:', err)), 10 * 60 * 1000);
  });
}

import { ChannelType, type Client, type VoiceChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';

export async function updateStatsChannels(client: Client): Promise<void> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  // Members count channel
  if (CHANNELS.statsMembersVC) {
    try {
      const vc = guild.channels.cache.get(CHANNELS.statsMembersVC) as VoiceChannel | undefined;
      if (vc && vc.type === ChannelType.GuildVoice) {
        const newName = `Members: ${guild.memberCount}`;
        if (vc.name !== newName) {
          await vc.setName(newName);
        }
      }
    } catch (err) {
      console.error('[Peaches] Stats channels: failed to update member count VC:', err);
    }
  }

  // Online count channel — requires GuildPresences intent; skip gracefully if not available
  if (CHANNELS.statsOnlineVC) {
    try {
      const vc = guild.channels.cache.get(CHANNELS.statsOnlineVC) as VoiceChannel | undefined;
      if (vc && vc.type === ChannelType.GuildVoice) {
        // Only available when GuildPresences intent is enabled
        const onlineCount = guild.members.cache.filter(
          m => !m.user.bot && (m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd')
        ).size;
        const newName = `Online: ${onlineCount}`;
        if (vc.name !== newName) {
          await vc.setName(newName);
        }
      }
    } catch (err) {
      console.error('[Peaches] Stats channels: failed to update online count VC:', err);
    }
  }
}

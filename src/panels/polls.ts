import { type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';

export async function postCommunityPoll(client: Client, question: string, options: string[], durationHours = 24) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const pollChannel = guild.channels.cache.get(CHANNELS.communityPolls) as TextChannel | undefined;
  if (!pollChannel) {
    console.log('[Peaches] Community polls channel not found');
    return;
  }

  await pollChannel.send({
    content: `\uD83C\uDF51 *Peaches taps the podium* Alright y'all, time to make your voices heard!`,
    poll: {
      question: { text: question },
      answers: options.map(text => ({ text })),
      duration: durationHours,
      allowMultiselect: false,
    },
  });
  console.log(`[Peaches] Community poll posted: "${question}"`);
}


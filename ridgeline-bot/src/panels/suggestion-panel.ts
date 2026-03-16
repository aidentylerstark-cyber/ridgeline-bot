import {
  MessageFlags,
  SeparatorSpacingSize,
  type Client,
  type TextChannel,
} from 'discord.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
} from '@discordjs/builders';
import { GUILD_ID, CHANNELS } from '../config.js';

export async function postSuggestionPanel(client: Client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(CHANNELS.suggestions) as TextChannel | undefined;
  if (!channel) {
    console.log('[Peaches] Suggestion box channel not found');
    return;
  }

  // Clear old bot messages
  const oldMessages = await channel.messages.fetch({ limit: 20 });
  const botMessages = oldMessages.filter(m => m.author.id === client.user?.id && m.embeds.length === 0);
  for (const msg of Array.from(botMessages.values())) {
    await msg.delete().catch(() => {});
  }

  const container = new ContainerBuilder()
    .setAccentColor(0xD4A574);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## \uD83D\uDCA1 Ridgeline Suggestion Box\n` +
      `> *Peaches slides a notepad and pen across the counter*\n\n` +
      `Got an idea to make Ridgeline even better? Drop it in the box, sugar! ` +
      `Our staff reviews every suggestion and you'll get notified when yours gets a response.`
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### \uD83D\uDCDD How to Submit\n` +
      `Type \`/suggest\` followed by your idea in **any channel**.\n` +
      `Your suggestion will appear here for the community to see and staff to review.\n\n` +
      `### \uD83D\uDCCB Status Tags\n` +
      `\uD83D\uDFE2 **Open** \u2014 Submitted, awaiting review\n` +
      `\uD83D\uDD35 **Reviewing** \u2014 Staff is looking into it\n` +
      `\uD83D\uDFE0 **In Progress** \u2014 Being worked on\n` +
      `\u2705 **Approved** \u2014 Accepted & implemented\n` +
      `\u274C **Denied** \u2014 Not moving forward (reason provided)`
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# \uD83C\uDF51 All suggestions are anonymous to the community \u2014 only staff can see who submitted. Keep it constructive, sugar!`
    )
  );

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
  console.log('[Peaches] Suggestion box panel posted');
}

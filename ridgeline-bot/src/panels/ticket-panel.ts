import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

export async function postTicketPanel(client: Client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const panelChannel = guild.channels.cache.get(CHANNELS.ticketPanel) as TextChannel | undefined;
  if (!panelChannel) {
    console.log('[Avery] Ticket panel channel not found');
    return;
  }

  // Clear old bot messages
  const oldMessages = await panelChannel.messages.fetch({ limit: 50 });
  const botMessages = oldMessages.filter(m => m.author.id === client.user?.id);
  if (botMessages.size > 0) {
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recent = botMessages.filter(m => m.createdTimestamp > fourteenDaysAgo);
    const old = botMessages.filter(m => m.createdTimestamp <= fourteenDaysAgo);
    if (recent.size > 1) await panelChannel.bulkDelete(recent).catch(() => {});
    else if (recent.size === 1) await recent.first()!.delete().catch(() => {});
    for (const msg of Array.from(old.values())) {
      await msg.delete().catch(() => {});
    }
  }

  // Components V2 ticket panel
  const panelContainer = new ContainerBuilder()
    .setAccentColor(0x2E8B57);

  panelContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## \uD83C\uDFAB Support Tickets\n` +
      `Need a hand from the staff team? Open a ticket and we'll help you out in a **private channel**. ` +
      `Pick the department that best fits your request.`
    )
  );

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  panelContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### Departments\n` +
      `\u26A0\uFE0F **General Support** \u2014 account issues, questions, anything else\n` +
      `\uD83C\uDFE0 **Rental / Landscaping** \u2014 housing, property, landscaping\n` +
      `\uD83D\uDCC6 **Events** \u2014 event planning & scheduling\n` +
      `\uD83D\uDCC1 **Marketing** \u2014 promotions, media, marketing requests\n` +
      `\uD83D\uDCCD **Roleplay Support** \u2014 storylines, RP questions, disputes`
    )
  );

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  panelContainer.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_open')
        .setLabel('Open a Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji('\uD83C\uDFAB'),
    )
  );

  panelContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# One open ticket at a time per department. For quick questions, try general chat first.`
    )
  );

  await panelChannel.send({
    components: [panelContainer],
    flags: MessageFlags.IsComponentsV2,
  });
  console.log('[Avery] Ticket panel posted');
}

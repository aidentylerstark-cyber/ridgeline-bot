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
    console.log('[Peaches] Ticket panel channel not found');
    return;
  }

  // Clear old bot messages
  const oldMessages = await panelChannel.messages.fetch({ limit: 50 });
  const botMessages = oldMessages.filter(m => m.author.id === client.user?.id);
  for (const msg of Array.from(botMessages.values())) {
    await msg.delete().catch(() => {});
  }

  // Components V2 ticket panel
  const panelContainer = new ContainerBuilder()
    .setAccentColor(0xD4A574);

  panelContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## \uD83C\uDFAB  Need Help? Open a Ticket!\n` +
      `> *Peaches leans over the counter with a smile*\n\n` +
      `Hey there, sugar! If you need help from our staff team, ` +
      `you're in the right place. Click the button below and I'll get you set up ` +
      `with a private ticket channel.`
    )
  );

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  panelContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `\u26A0\uFE0F **General Support** \u2014 Account issues, questions, anything else\n` +
      `\uD83C\uDFE0 **Rental / Landscaping** \u2014 Housing, property, landscaping help\n` +
      `\uD83D\uDCC6 **Events** \u2014 Event planning, scheduling, event issues\n` +
      `\uD83D\uDCC1 **Marketing** \u2014 Promotions, media, marketing requests\n` +
      `\uD83D\uDCCD **Roleplay Support** \u2014 RP questions, storyline help, disputes`
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
      `-# Please don't open tickets for things that can be handled in general chat. Peaches will know. Peaches always knows. \uD83D\uDC40`
    )
  );

  await panelChannel.send({
    components: [panelContainer],
    flags: MessageFlags.IsComponentsV2,
  });
  console.log('[Peaches] Ticket panel posted');
}

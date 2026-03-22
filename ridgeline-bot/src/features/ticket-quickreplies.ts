import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ChatInputCommandInteraction,
  type Client,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import * as storage from '../storage.js';
import { isValidDepartment } from '../config.js';
import { isStaffForTicket } from './tickets.js';

// ─────────────────────────────────────────
// Quick Reply Templates
// ─────────────────────────────────────────

interface QuickReplyTemplate {
  key: string;
  label: string;
  emoji: string;
  message: string;
}

const QUICK_REPLY_TEMPLATES: QuickReplyTemplate[] = [
  {
    key: 'greeting',
    label: 'Greeting',
    emoji: '\uD83D\uDC4B',
    message: "Hey there, sugar! I'm {staff} and I'll be helpin' you out today. Let me take a look at this for ya!",
  },
  {
    key: 'need_info',
    label: 'Need More Info',
    emoji: '\u2753',
    message: "I'd love to help more, darlin', but I need a bit more information. Could you tell me more about what happened?",
  },
  {
    key: 'working_on_it',
    label: 'Working On It',
    emoji: '\uD83D\uDD27',
    message: "I'm lookin' into this right now, hon. Sit tight and I'll have an update for you shortly!",
  },
  {
    key: 'waiting',
    label: 'Waiting on User',
    emoji: '\u23F3',
    message: "I've set this ticket to waiting on you, sugar. Just reply here when you're ready and we'll pick right back up!",
  },
  {
    key: 'close_warning',
    label: 'Close Warning',
    emoji: '\u26A0\uFE0F',
    message: "Just a heads up, darlin' \u2014 if I don't hear back in a couple days, I'll go ahead and close this out. You can always open a new one!",
  },
  {
    key: 'escalating',
    label: 'Escalating',
    emoji: '\u2B06\uFE0F',
    message: "I'm going to bring in someone with a bit more expertise on this one, sugar. They'll be jumping in shortly!",
  },
  {
    key: 'resolved',
    label: 'Resolved',
    emoji: '\u2705',
    message: "Looks like we got this all sorted out! I'm going to go ahead and close this ticket. Don't hesitate to open a new one if you need anything!",
  },
];

// ─────────────────────────────────────────
// /ticket quickreply handler
// ─────────────────────────────────────────

export async function handleQuickReply(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  const channelId = interaction.channelId;

  // Check it's a ticket channel
  const ticket = await storage.getOpenTicketByChannelId(channelId);
  if (!ticket) {
    await interaction.reply({ content: "This command must be run inside a ticket channel, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  if (!isValidDepartment(ticket.department) || !isStaffForTicket(member, ticket.department)) {
    await interaction.reply({ content: "Only staff can use quick replies, sugar! \uD83C\uDF51", flags: 64 });
    return;
  }

  // Build select menu
  const options = QUICK_REPLY_TEMPLATES.map(t =>
    new StringSelectMenuOptionBuilder()
      .setLabel(t.label)
      .setValue(t.key)
      .setEmoji(t.emoji)
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_quickreply_select')
    .setPlaceholder("Pick a template, sugar...")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const reply = await interaction.reply({
    content: "**Pick a quick reply template:**",
    components: [row],
    flags: 64,
  });

  // Use a collector to handle the select menu response
  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.isStringSelectMenu(),
    time: 30_000,
    max: 1,
  });

  collector.on('collect', async (selectInteraction) => {
    if (!selectInteraction.isStringSelectMenu()) return;

    const selectedKey = selectInteraction.values[0];
    const template = QUICK_REPLY_TEMPLATES.find(t => t.key === selectedKey);
    if (!template) {
      try {
        await selectInteraction.update({ content: "Couldn't find that template, sugar. \uD83C\uDF51", components: [] });
      } catch { /* token expired */ }
      return;
    }

    // Replace {staff} placeholder
    const message = template.message.replace(/\{staff\}/g, member.displayName);

    // Post as a regular message in the channel
    const channel = interaction.channel as TextChannel;
    try {
      await channel.send(message);
      await selectInteraction.update({ content: `Quick reply sent! \uD83C\uDF51`, components: [] });
    } catch (err) {
      console.error('[Peaches] Failed to send quick reply:', err);
      try {
        await selectInteraction.update({ content: "Something went wrong sending that reply, sugar. \uD83C\uDF51", components: [] });
      } catch { /* token expired */ }
    }

    // Update last activity and first response time
    storage.updateTicketLastActivity(channelId).catch(() => {});
    storage.updateFirstResponseTime(channelId).catch(() => {});
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      try {
        await interaction.editReply({ content: "Quick reply timed out, sugar. Run the command again if you need it! \uD83C\uDF51", components: [] });
      } catch { /* token expired */ }
    }
  });
}

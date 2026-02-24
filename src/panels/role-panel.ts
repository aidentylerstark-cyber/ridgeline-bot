import {
  ActionRowBuilder,
  ButtonBuilder,
  MessageFlags,
  type Client,
  type TextChannel,
} from 'discord.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
} from '@discordjs/builders';
import { SeparatorSpacingSize } from 'discord.js';
import { GUILD_ID, CHANNELS, SELF_ASSIGN_ROLES, ROLE_CATEGORY_STYLE } from '../config.js';

export async function postRoleButtons(client: Client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const getRolesChannel = guild.channels.cache.get(CHANNELS.getRoles) as TextChannel | undefined;

  if (!getRolesChannel) {
    console.log('[Discord Bot] #get-roles channel not found');
    return;
  }

  // Clear old messages from bot
  const oldMessages = await getRolesChannel.messages.fetch({ limit: 50 });
  const botMessages = oldMessages.filter(m => m.author.id === client.user?.id);
  for (const msg of Array.from(botMessages.values())) {
    await msg.delete().catch(() => {});
  }

  // Header (Components V2)
  const headerContainer = new ContainerBuilder()
    .setAccentColor(0xD4A574);

  headerContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## \uD83C\uDFAD Ridgeline Role Selection Board\n` +
      `> *Peaches slides a clipboard across the counter*\n\n` +
      `Welcome to the role board, sugar! Click a button to **add** a role to your profile. ` +
      `Click it again to **remove** it \u2014 no hard feelings.\n\n` +
      `These roles help us get to know you and keep you in the loop on the things you care about.`
    )
  );

  await getRolesChannel.send({
    components: [headerContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // Each category (Components V2)
  for (const [category, roleNames] of Object.entries(SELF_ASSIGN_ROLES)) {
    const style = ROLE_CATEGORY_STYLE[category];

    const categoryContainer = new ContainerBuilder()
      .setAccentColor(style?.color ?? 0x4A7C59);

    categoryContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${category}\n${style?.description ?? 'Select your roles below.'}`
      )
    );

    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const roleName of roleNames) {
      const buttonId = `role_${roleName.replace(/ /g, '_')}`;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buttonId)
          .setLabel(roleName)
          .setStyle(style?.buttonStyle ?? 2) // Secondary
      );
    }

    categoryContainer.addActionRowComponents(row);

    await getRolesChannel.send({
      components: [categoryContainer],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  // Footer (Components V2)
  const footerContainer = new ContainerBuilder()
    .setAccentColor(0xD4A574);

  footerContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `\uD83C\uDF51 *If you need a role that ain't listed here, just holler at Peaches or click "Open a Ticket" in <#${CHANNELS.ticketPanel}>!*\n\n` +
      `-# \uD83C\uDFE1 Ridgeline, Georgia \u2014 Where Every Story Matters`
    )
  );

  await getRolesChannel.send({
    components: [footerContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  console.log('[Discord Bot] Role selection buttons posted to #get-roles');
}

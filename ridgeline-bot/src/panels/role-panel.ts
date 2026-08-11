import {
  ActionRowBuilder,
  ButtonBuilder,
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
  if (botMessages.size > 0) {
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recent = botMessages.filter(m => m.createdTimestamp > fourteenDaysAgo);
    const old = botMessages.filter(m => m.createdTimestamp <= fourteenDaysAgo);
    if (recent.size > 1) await getRolesChannel.bulkDelete(recent).catch(() => {});
    else if (recent.size === 1) await recent.first()!.delete().catch(() => {});
    for (const msg of Array.from(old.values())) {
      await msg.delete().catch(() => {});
    }
  }

  // One clean Components V2 panel with every category
  const container = new ContainerBuilder().setAccentColor(0x5865F2);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## \uD83C\uDFF7\uFE0F Role Selection\n` +
      `Pick your roles below \u2014 **click to add, click again to remove**. ` +
      `Some tags unlock hidden channels (Gamer \u2192 \uD83C\uDFAE Gaming, Avelora Kids \u2192 \uD83E\uDDF8 Kids/Family).`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  const entries = Object.entries(SELF_ASSIGN_ROLES);
  entries.forEach(([category, roleNames], i) => {
    const style = ROLE_CATEGORY_STYLE[category];
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ${category}\n${style?.description ?? 'Select your roles below.'}`)
    );

    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const roleName of roleNames) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_${roleName.replace(/ /g, '_')}`)
          .setLabel(roleName)
          .setStyle(style?.buttonStyle ?? 2)
      );
    }
    container.addActionRowComponents(row);

    if (i < entries.length - 1) {
      container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    }
  });

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Need a role that isn't here? Open a ticket in <#${CHANNELS.ticketPanel}> \u00B7 \uD83C\uDFD9\uFE0F Avelora, California`
    )
  );

  await getRolesChannel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  console.log('[Discord Bot] Role selection panel posted to #get-roles');
}

import {
  EmbedBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  type Client,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
} from '@discordjs/builders';
import { CHANNELS, CITIZEN_ROLE, NEW_ARRIVAL_ROLE } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';

export function setupMemberJoinHandler(client: Client) {
  client.on('guildMemberAdd', async (member: GuildMember) => {
    if (!isBotActive()) return;
    try {
      // 1. Auto-assign Citizen role
      const citizenRole = member.guild.roles.cache.find(r => r.name === CITIZEN_ROLE);
      if (citizenRole) {
        await member.roles.add(citizenRole);
        console.log(`[Discord Bot] Assigned ${CITIZEN_ROLE} to ${member.displayName}`);
      }

      // 1b. Auto-assign New Arrival role (removed after 7 days)
      const newArrivalRole = member.guild.roles.cache.find(r => r.name === NEW_ARRIVAL_ROLE);
      if (newArrivalRole) {
        await member.roles.add(newArrivalRole);
        console.log(`[Discord Bot] Assigned ${NEW_ARRIVAL_ROLE} to ${member.displayName}`);
        setTimeout(async () => {
          try {
            // Re-fetch to ensure member is still in guild and still has the role
            const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
            if (freshMember && freshMember.roles.cache.has(newArrivalRole.id)) {
              await freshMember.roles.remove(newArrivalRole);
              console.log(`[Discord Bot] Removed ${NEW_ARRIVAL_ROLE} from ${freshMember.displayName} (7 days elapsed)`);
            }
          } catch (err) {
            console.error(`[Discord Bot] Failed to remove ${NEW_ARRIVAL_ROLE} from ${member.displayName}:`, err);
          }
        }, 7 * 24 * 60 * 60 * 1000);
      }

      // 2. Post welcome message in #welcome channel
      const welcomeChannel = member.guild.channels.cache.get(CHANNELS.welcome) as TextChannel | undefined;

      if (welcomeChannel) {
        const welcomeContainer = new ContainerBuilder()
          .setAccentColor(0xD4A574);

        const welcomeHeader = new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## \uD83C\uDFE1 Welcome to Ridgeline, ${member.displayName}!\n` +
              `> *Well, ring the porch bell! We got ourselves a new neighbor!*\n\n` +
              `Hey there, sugar \u2014 I'm **Peaches**, the town secretary. ` +
              `Welcome to **Ridgeline, Georgia** \u2014 a close-knit community nestled in the hills ` +
              `where neighbors look out for each other and there's always a story waiting to unfold.\n\n` +
              `I went ahead and pinned that shiny **Ridgeline Citizen** badge on ya \u2014 ` +
              `you're officially one of us now. You're resident **#${member.guild.memberCount}**! \uD83C\uDF51`
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(member.user.displayAvatarURL({ size: 256 }))
          );

        welcomeContainer.addSectionComponents(welcomeHeader);
        welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

        welcomeContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### \uD83D\uDDFA\uFE0F Your First Steps\n` +
            `**Step 1** \u2014 Read the Rules in <#${CHANNELS.rules}>\n` +
            `**Step 2** \u2014 Pick Your Roles in <#${CHANNELS.getRoles}>\n` +
            `**Step 3** \u2014 Introduce Yourself in <#${CHANNELS.characterIntros}>\n` +
            `**Step 4** \u2014 Explore <#${CHANNELS.realEstate}>, <#${CHANNELS.upcomingEvents}>, or <#${CHANNELS.generalChat}>`
          )
        );

        welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

        welcomeContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `\uD83C\uDF10 **[ridgelinesl.com](https://ridgelinesl.com)** \u2014 Town website, property listings, & more\n` +
            `\uD83C\uDF51 **Need help?** Just say "hey Peaches" in any channel\n` +
            `\uD83C\uDD98 **Staff help?** Click "Open a Ticket" in <#${CHANNELS.ticketPanel}>\n\n` +
            `-# \uD83C\uDF51 A new face in town! Welcome, <@${member.id}>!`
          )
        );

        await welcomeChannel.send({
          components: [welcomeContainer],
          flags: MessageFlags.IsComponentsV2,
        });
        console.log(`[Peaches] Welcome message posted for ${member.displayName} in #${welcomeChannel.name}`);
      }

      // 3. Send DM — Full Orientation Packet
      try {
        const dmBanner = new EmbedBuilder()
          .setColor(0xD4A574)
          .setAuthor({
            name: 'Peaches \uD83C\uDF51 \u2014 Town Secretary',
            iconURL: client.user?.displayAvatarURL({ size: 128 }),
          })
          .setTitle('\uD83D\uDCEC Your New Resident Packet')
          .setDescription(
            `> *Peaches slips an envelope across the desk with a warm smile*\n\n` +
            `Hey ${member.displayName}! I put together everything you need to get settled in. ` +
            `Think of this as your welcome folder straight from the town office \u2014 ` +
            `all the essentials in one place, sugar.`
          );

        const dmGuide = new EmbedBuilder()
          .setColor(0x8B6F47)
          .setTitle('\u2501\u2501\u2501 \uD83D\uDCCB Resident Quick Guide \u2501\u2501\u2501')
          .addFields(
            {
              name: '\uD83D\uDCDC Community Rules',
              value: `Review our guidelines in <#${CHANNELS.rules}> \u2014 they keep Ridgeline safe and welcoming for everyone.`,
              inline: false,
            },
            {
              name: '\uD83C\uDFAD Customize Your Experience',
              value:
                `Visit <#${CHANNELS.getRoles}> to pick up:\n` +
                `> \uD83D\uDD14 **Notifications** \u2014 Event alerts, job postings\n` +
                `> \uD83C\uDFF7\uFE0F **Pronouns** \u2014 Let folks know how to address you\n` +
                `> \uD83C\uDFE1 **Community tags** \u2014 Business owner, roleplayer, adult`,
              inline: false,
            },
            {
              name: '\uD83D\uDDFA\uFE0F Key Channels',
              value:
                `> <#${CHANNELS.generalChat}> \u2014 Hang out with the community\n` +
                `> <#${CHANNELS.characterIntros}> \u2014 Tell us about your character\n` +
                `> <#${CHANNELS.roleplayChat}> \u2014 Jump into the action\n` +
                `> <#${CHANNELS.realEstate}> \u2014 Find a place to call home\n` +
                `> <#${CHANNELS.upcomingEvents}> \u2014 See what's happening in town`,
              inline: false,
            },
          );

        const dmFooter = new EmbedBuilder()
          .setColor(0xD4A574)
          .setDescription(
            `\uD83C\uDF10 **[ridgelinesl.com](https://ridgelinesl.com)** \u2014 Property listings, community news, business directory\n\n` +
            `\uD83C\uDD98 **Need help?** Click "Open a Ticket" in <#${CHANNELS.ticketPanel}> or find any **Community Manager** / **Community Moderator**\n\n` +
            `\uD83C\uDF51 **Talk to Peaches** \u2014 Just say "hey Peaches" in any channel and I'll come runnin'!`
          )
          .setFooter({ text: '\uD83C\uDFE1 Ridgeline, Georgia \u2014 Where Every Story Matters' })
          .setTimestamp();

        await member.send({ embeds: [dmBanner, dmGuide, dmFooter] });
        console.log(`[Discord Bot] Sent welcome DM to ${member.displayName}`);
      } catch {
        console.log(`[Discord Bot] Could not DM ${member.displayName} (DMs likely disabled)`);
      }
    } catch (err) {
      console.error(`[Discord Bot] Error handling new member ${member.displayName}:`, err);
    }
  });
}

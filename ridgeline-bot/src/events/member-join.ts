import {
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
import { scheduleRoleRemoval } from '../storage.js';
import { isBotActive } from '../utilities/instance-lock.js';
import {
  getRandomGreeting,
  getRandomReturningGreeting,
  buildWelcomeButtons,
  buildAccountAgeWarningEmbed,
  sendOnboardingDM,
} from '../features/onboarding.js';
import { getOnboardingRecord } from '../storage.js';

// ── Raid guard for welcome messages ──
// Track recent join timestamps; if too many join in a short window, skip welcome messages/DMs
const recentJoinTimestamps: number[] = [];
const WELCOME_RAID_THRESHOLD = 5;    // max joins in window before suppressing
const WELCOME_RAID_WINDOW_MS = 30_000; // 30 seconds
const NEW_ACCOUNT_THRESHOLD_DAYS = 7;

function isWelcomeRaid(): boolean {
  const now = Date.now();
  // Prune old timestamps
  while (recentJoinTimestamps.length > 0 && recentJoinTimestamps[0]! < now - WELCOME_RAID_WINDOW_MS) {
    recentJoinTimestamps.shift();
  }
  recentJoinTimestamps.push(now);
  return recentJoinTimestamps.length > WELCOME_RAID_THRESHOLD;
}

export function setupMemberJoinHandler(client: Client) {
  client.on('guildMemberAdd', async (member: GuildMember) => {
    if (!isBotActive()) return;
    try {
      // 1. Auto-assign Citizen role
      const citizenRole = member.guild.roles.cache.find(r => r.name === CITIZEN_ROLE);
      if (citizenRole) {
        try {
          await member.roles.add(citizenRole);
          console.log(`[Discord Bot] Assigned ${CITIZEN_ROLE} to ${member.displayName}`);
        } catch (err) {
          console.error(`[Discord Bot] Failed to assign ${CITIZEN_ROLE} to ${member.displayName}:`, err);
        }
      }

      // 1b. Auto-assign New Arrival role (scheduled for removal after 7 days via DB)
      const newArrivalRole = member.guild.roles.cache.find(r => r.name === NEW_ARRIVAL_ROLE);
      if (newArrivalRole) {
        try {
          await member.roles.add(newArrivalRole);
          const removeAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await scheduleRoleRemoval(member.id, NEW_ARRIVAL_ROLE, removeAt);
          console.log(`[Discord Bot] Assigned ${NEW_ARRIVAL_ROLE} to ${member.displayName} (removal scheduled for ${removeAt.toISOString()})`);
        } catch (err) {
          console.error(`[Discord Bot] Failed to assign ${NEW_ARRIVAL_ROLE} to ${member.displayName}:`, err);
        }
      }

      // Raid guard: skip welcome message and DM if too many joins in a short window
      if (isWelcomeRaid()) {
        console.warn(`[Discord Bot] Welcome raid guard triggered — suppressing welcome message/DM for ${member.displayName}`);
        return;
      }

      // ── Check if returning member ──
      let isReturning = false;
      try {
        const onboardingRecord = await getOnboardingRecord(member.id);
        if (onboardingRecord && onboardingRecord.completed_at) {
          isReturning = true;
        }
      } catch (err) {
        console.error(`[Discord Bot] Failed to check onboarding record for ${member.displayName}:`, err);
      }

      // 2. Post welcome message in #welcome channel
      const welcomeChannel = member.guild.channels.cache.get(CHANNELS.welcome) as TextChannel | undefined;

      if (welcomeChannel) {
        const greeting = isReturning
          ? getRandomReturningGreeting()
          : getRandomGreeting();

        const title = isReturning
          ? `Welcome Back, ${member.displayName}!`
          : `Welcome to Ridgeline, ${member.displayName}!`;

        const body = isReturning
          ? (
            `> *${greeting}*\n\n` +
            `Hey there, sugar \u2014 I'm **Peaches**, and I remember you! ` +
            `Welcome back to **Ridgeline, Georgia**. We missed ya around here. ` +
            `Your **Ridgeline Citizen** badge is right back where it belongs. \uD83C\uDF51`
          )
          : (
            `> *${greeting}*\n\n` +
            `Hey there, sugar \u2014 I'm **Peaches**, the town secretary. ` +
            `Welcome to **Ridgeline, Georgia** \u2014 a close-knit community nestled in the hills ` +
            `where neighbors look out for each other and there's always a story waiting to unfold.\n\n` +
            `I went ahead and pinned that shiny **Ridgeline Citizen** badge on ya \u2014 ` +
            `you're officially one of us now. You're resident **#${member.guild.memberCount}**! \uD83C\uDF51`
          );

        const welcomeContainer = new ContainerBuilder()
          .setAccentColor(0xD4A574);

        const welcomeHeader = new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## \uD83C\uDFE1 ${title}\n${body}`
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(member.user.displayAvatarURL({ size: 256 }))
          );

        welcomeContainer.addSectionComponents(welcomeHeader);
        welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

        if (!isReturning) {
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
        }

        welcomeContainer.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `\uD83C\uDF10 **[ridgelinesl.com](https://ridgelinesl.com)** \u2014 Town website, property listings, & more\n` +
            `\uD83C\uDF51 **Need help?** Just say "hey Peaches" in any channel\n` +
            `\uD83C\uDD98 **Staff help?** Click "Open a Ticket" in <#${CHANNELS.ticketPanel}>\n\n` +
            `-# \uD83C\uDF51 ${isReturning ? 'A familiar face returns!' : 'A new face in town!'} Welcome, <@${member.id}>!`
          )
        );

        // Build message with quick-action URL buttons
        const welcomeButtons = buildWelcomeButtons();

        await welcomeChannel.send({
          components: [welcomeContainer, welcomeButtons],
          flags: MessageFlags.IsComponentsV2,
        });
        console.log(`[Peaches] Welcome message posted for ${member.displayName} in #${welcomeChannel.name}${isReturning ? ' (returning)' : ''}`);
      }

      // 3. Account age warning — post to mod-log if account < 7 days old
      const accountAgeMs = Date.now() - member.user.createdTimestamp;
      const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));

      if (accountAgeDays < NEW_ACCOUNT_THRESHOLD_DAYS) {
        const modLogChannel = member.guild.channels.cache.get(CHANNELS.modLog) as TextChannel | undefined;
        if (modLogChannel) {
          try {
            const warningEmbed = buildAccountAgeWarningEmbed(member, accountAgeDays);
            await modLogChannel.send({ embeds: [warningEmbed] });
            console.log(`[Discord Bot] Posted new account alert for ${member.displayName} (${accountAgeDays} days old)`);
          } catch (err) {
            console.error(`[Discord Bot] Failed to post account age warning:`, err);
          }
        }
      }

      // 4. Send interactive onboarding DM
      await sendOnboardingDM(client, member);

    } catch (err) {
      console.error(`[Discord Bot] Error handling new member ${member.displayName}:`, err);
    }
  });
}

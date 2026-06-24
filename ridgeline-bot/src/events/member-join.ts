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
import { CHANNELS, CITIZEN_ROLE, NEW_ARRIVAL_ROLE, LEADERSHIP } from '../config.js';
import type { Guild } from 'discord.js';
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

// ── Burst guard for onboarding DMs only ──
// The in-channel welcome message ALWAYS fires for every member (even simultaneous
// joins). This guard only throttles the onboarding *DM*: mass-DMing during a join
// burst is what gets a bot flagged by Discord's anti-spam, so we skip DMs (not the
// welcome) when many join at once. The anti-raid verification bump lives in modlog.ts.
const recentJoinTimestamps: number[] = [];
const WELCOME_RAID_THRESHOLD = 5;    // max joins in window before throttling DMs
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

/**
 * Build the "town leadership" line with clickable profile mentions, resolved from
 * usernames in the guild member cache. Returns '' if none are resolvable.
 */
function buildLeadershipLine(guild: Guild): string {
  const parts: string[] = [];
  for (const l of LEADERSHIP) {
    const member = guild.members.cache.find(m => m.user.username.toLowerCase() === l.username.toLowerCase());
    if (member) parts.push(`${l.emoji} **${l.title}:** <@${member.id}>`);
  }
  return parts.length ? parts.join('\n') : '';
}

// ─────────────────────────────────────────
// Immediate single welcome message
// ─────────────────────────────────────────
async function postWelcomeMessage(member: GuildMember, isReturning: boolean): Promise<void> {
  const welcomeChannel = member.guild.channels.cache.get(CHANNELS.welcome) as TextChannel | undefined;
  if (!welcomeChannel) return;

  const greeting = isReturning ? getRandomReturningGreeting() : getRandomGreeting();

  const title = isReturning
    ? `Welcome Back, ${member.displayName}!`
    : `Welcome to Ridgeline, ${member.displayName}!`;

  const body = isReturning
    ? (
      `> *${greeting}*\n\n` +
      `Hey there, sugar — I'm **Peaches**, and I remember you! ` +
      `Welcome back to **Ridgeline, Georgia**. We missed ya around here. ` +
      `Your **Ridgeline Citizen** badge is right back where it belongs. 🍑`
    )
    : (
      `> *${greeting}*\n\n` +
      `Hey there, sugar — I'm **Peaches**, the town secretary. ` +
      `Welcome to **Ridgeline, Georgia** — a close-knit community nestled in the hills ` +
      `where neighbors look out for each other and there's always a story waiting to unfold.\n\n` +
      `I went ahead and pinned that shiny **Ridgeline Citizen** badge on ya — ` +
      `you're officially one of us now. You're resident **#${member.guild.memberCount}**! 🍑`
    );

  const welcomeContainer = new ContainerBuilder().setAccentColor(0xD4A574);

  const welcomeHeader = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## 🏡 ${title}\n${body}`)
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder().setURL(member.user.displayAvatarURL({ size: 256 }))
    );

  welcomeContainer.addSectionComponents(welcomeHeader);
  welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  if (!isReturning) {
    welcomeContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### 🗺️ Your First Steps\n` +
        `**Step 1** — Read the Rules in <#${CHANNELS.rules}>\n` +
        `**Step 2** — Pick Your Roles in <#${CHANNELS.getRoles}>\n` +
        `**Step 3** — Introduce Yourself in <#${CHANNELS.characterIntros}>\n` +
        `**Step 4** — Explore <#${CHANNELS.realEstate}>, <#${CHANNELS.upcomingEvents}>, or <#${CHANNELS.generalChat}>`
      )
    );
    welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }

  const leadershipLine = buildLeadershipLine(member.guild);
  if (leadershipLine) {
    welcomeContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### 🤝 Your Town Leadership\n${leadershipLine}`)
    );
    welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }

  welcomeContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `🌐 **[ridgeline-sl.com](https://ridgeline-sl.com)** — Town website, property listings, & more\n` +
      `🍑 **Need help?** Just say "hey Peaches" in any channel\n` +
      `🆘 **Staff help?** Click "Open a Ticket" in <#${CHANNELS.ticketPanel}>\n\n` +
      `-# 🍑 ${isReturning ? 'A familiar face returns!' : 'A new face in town!'} Welcome, <@${member.id}>!`
    )
  );

  await welcomeChannel.send({
    components: [welcomeContainer, buildWelcomeButtons()],
    flags: MessageFlags.IsComponentsV2,
    // Ping ONLY the new member — leadership mentions stay clickable but silent.
    allowedMentions: { users: [member.id] },
  });
  console.log(`[Peaches] Welcome message posted for ${member.displayName} in #${welcomeChannel.name}${isReturning ? ' (returning)' : ''}`);
}

// ─────────────────────────────────────────
// Deferred batched welcome (join-burst path)
// During a burst, individual welcomes are deferred and collapsed into ONE message
// posted once the burst settles — so nobody is forgotten, without spamming the channel.
// ─────────────────────────────────────────
interface PendingWelcome { member: GuildMember; isReturning: boolean; }
const pendingWelcomes: PendingWelcome[] = [];
const MAX_PENDING_WELCOMES = 50;       // flush (not drop) once a batch reaches this size
const MAX_BATCH_WAIT_MS = 90_000;       // hard ceiling so a SUSTAINED burst still flushes
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let firstQueuedAt = 0;

function triggerFlushNow(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  void flushPendingWelcomes();
}

function queuePendingWelcome(member: GuildMember, isReturning: boolean): void {
  if (pendingWelcomes.some(p => p.member.id === member.id)) return; // dedup re-joins
  // If the batch is full, flush it FIRST (drains synchronously) so this member starts
  // a fresh batch and is never dropped.
  if (pendingWelcomes.length >= MAX_PENDING_WELCOMES) triggerFlushNow();
  if (pendingWelcomes.length === 0) firstQueuedAt = Date.now();
  pendingWelcomes.push({ member, isReturning });

  // Pure trailing-debounce would never fire during a sustained raid (every join resets
  // the timer), so also force a flush once we've waited the hard ceiling.
  if (Date.now() - firstQueuedAt >= MAX_BATCH_WAIT_MS) {
    triggerFlushNow();
    return;
  }
  // Otherwise: flush WELCOME_RAID_WINDOW_MS after the LAST join (once the burst settles).
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { flushTimer = null; void flushPendingWelcomes(); }, WELCOME_RAID_WINDOW_MS);
}

async function flushPendingWelcomes(): Promise<void> {
  const batch = pendingWelcomes.splice(0, pendingWelcomes.length);
  firstQueuedAt = 0; // next batch starts its own clock
  if (batch.length === 0) return;

  const guild = batch[0]!.member.guild;
  // Only welcome members still in the server (raid accounts may already be gone/banned).
  const present = batch.filter(p => guild.members.cache.has(p.member.id));
  if (present.length === 0) return;

  const welcomeChannel = guild.channels.cache.get(CHANNELS.welcome) as TextChannel | undefined;
  if (!welcomeChannel) return;

  const SHOWN = 20;
  const mentions = present.slice(0, SHOWN).map(p => `<@${p.member.id}>`).join(' ');
  const overflow = present.length > SHOWN ? ` …and **${present.length - SHOWN}** more` : '';

  const container = new ContainerBuilder().setAccentColor(0xD4A574);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## 🏡 Welcome to Ridgeline, y'all!\n` +
      `A whole wave of new neighbors just rolled into town — **${present.length}** of 'em! ` +
      `Pull up a rockin' chair and make yourselves at home, sugars. 🍑`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${mentions}${overflow}`));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  const batchLeadership = buildLeadershipLine(guild);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### 🗺️ Your First Steps\n` +
      `**1** — Read the Rules in <#${CHANNELS.rules}>\n` +
      `**2** — Pick Your Roles in <#${CHANNELS.getRoles}>\n` +
      `**3** — Introduce Yourself in <#${CHANNELS.characterIntros}>\n` +
      (batchLeadership ? `\n**🤝 Your Town Leadership**\n${batchLeadership}\n` : '') +
      `\n🌐 **[ridgeline-sl.com](https://ridgeline-sl.com)** • 🍑 Say "hey Peaches" anytime`
    )
  );

  try {
    await welcomeChannel.send({
      components: [container, buildWelcomeButtons()],
      flags: MessageFlags.IsComponentsV2,
      // Ping the new members being welcomed; keep leadership mentions silent.
      allowedMentions: { users: present.map(p => p.member.id) },
    });
    console.log(`[Peaches] Batched welcome posted for ${present.length} members after join burst`);
  } catch (err) {
    console.error('[Peaches] Failed to post batched welcome:', err);
  }
}

/** Clear the pending-welcome flush timer on shutdown (prevents timer leaks). */
export function destroyWelcomeQueue(): void {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  pendingWelcomes.length = 0;
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

      // Track join rate (used only to throttle the onboarding DM during a burst —
      // the in-channel welcome below always posts, for every member).
      const inJoinBurst = isWelcomeRaid();

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

      // 2. Welcome message. Normally posted immediately; during a join burst the
      //    raid guard defers it to a single batched welcome so nobody is forgotten.
      if (inJoinBurst) {
        queuePendingWelcome(member, isReturning);
        console.warn(`[Discord Bot] Join burst \u2014 deferring welcome for ${member.displayName} to a batched message`);
      } else {
        await postWelcomeMessage(member, isReturning);
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

      // 4. Send interactive onboarding DM — skipped during a burst to avoid mass-DM
      //    spam flags (the raid guard). These members are still welcomed in-channel.
      if (!inJoinBurst) {
        await sendOnboardingDM(client, member);
      }

    } catch (err) {
      console.error(`[Discord Bot] Error handling new member ${member.displayName}:`, err);
    }
  });
}

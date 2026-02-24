import {
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
import { GUILD_ID, CHANNELS } from '../config.js';

export async function postTriggerReference(client: Client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(CHANNELS.botCommands) as TextChannel | undefined;
  if (!channel) {
    console.log('[Discord Bot] #bot-commands channel not found');
    return;
  }

  // Clear old bot messages
  const oldMessages = await channel.messages.fetch({ limit: 50 });
  const botMessages = oldMessages.filter(m => m.author.id === client.user?.id);
  for (const msg of Array.from(botMessages.values())) {
    await msg.delete().catch(() => {});
  }

  // ── Header ──
  const headerContainer = new ContainerBuilder()
    .setAccentColor(0xD4A574);

  headerContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## :peach: Peaches — Command & Trigger Reference\n` +
      `> *Everything you need to know about gettin' Peaches to talk back.*\n\n` +
      `Peaches responds when a message **starts with** one of her trigger words, or when she's **@mentioned**.`
    )
  );

  await channel.send({
    components: [headerContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // ── Trigger Words ──
  const triggerContainer = new ContainerBuilder()
    .setAccentColor(0xF5A623);

  triggerContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### :speech_balloon: How to Get Peaches' Attention\n` +
      `Start your message with any of these:\n` +
      `- \`hey peaches\`\n` +
      `- \`yo peaches\`\n` +
      `- \`peaches\` (just her name works)\n\n` +
      `Or just **@mention** her.\n\n` +
      `> :warning: Peaches will **not** respond in ticket channels.`
    )
  );

  await channel.send({
    components: [triggerContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // ── FAQ Topics ──
  const faqContainer = new ContainerBuilder()
    .setAccentColor(0xE67E22);

  faqContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### :book: FAQ Topics\n` +
      `Mention any of these words after a trigger and Peaches gives a quick answer:\n\n` +
      `- **Rules** — \`rules\`, \`guidelines\`, \`community rules\`\n` +
      `- **Roles** — \`get roles\`, \`how do i get a role\`, \`pick roles\`, \`assign role\`\n` +
      `- **Events** — \`events\`, \`what's happening\`, \`schedule\`\n` +
      `- **Housing** — \`house\`, \`rent\`, \`real estate\`, \`property\`, \`housing\`, \`apartment\`\n` +
      `- **Support** — \`help\`, \`support\`, \`problem\`, \`issue\`, \`ticket\`\n` +
      `- **Website** — \`website\`, \`site\`, \`web\`\n` +
      `- **Intros** — \`character\`, \`intro\`, \`introduce myself\`\n` +
      `- **Roleplay** — \`roleplay\`, \`storyline\`, \`where do i rp\`\n` +
      `- **Suggestions** — \`suggest\`, \`suggestion\`, \`idea\`, \`feedback\`\n` +
      `- **Announcements** — \`announce\`, \`announcement\`, \`news\`\n` +
      `- **Polls** — \`poll\`, \`vote\``
    )
  );

  await channel.send({
    components: [faqContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // ── Conversational Topics ──
  const convContainer = new ContainerBuilder()
    .setAccentColor(0xB07CC6);

  convContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### :speech_left: Conversational Topics\n` +
      `Peaches has personality responses for all of these:\n\n` +
      `**About Peaches**\n` +
      `\`your name\` · \`who are you\` · \`how old\` · \`are you a bot\` · \`where do you live\` · \`what's your job\`\n\n` +
      `**Favorites**\n` +
      `\`favorite food\` · \`favorite drink\` · \`favorite place\` · \`favorite song\` · \`favorite season\` · \`favorite movie\` · \`favorite color\`\n\n` +
      `**About Ridgeline**\n` +
      `\`tell me about ridgeline\` · \`when was ridgeline founded\`\n\n` +
      `**Mood Check-ins**\n` +
      `\`i'm sad\` · \`i'm happy\` · \`i'm bored\` · \`i'm tired\` · \`i'm new\`\n\n` +
      `**General Chat**\n` +
      `\`how are you\` · \`good morning\` · \`good night\` · \`what are you doing\` · \`what's up\`\n\n` +
      `**Reactions**\n` +
      `\`you're funny\` · \`good bot\` · \`bad bot\` · \`i love you\` · \`thank you\`\n\n` +
      `**Fun Stuff**\n` +
      `\`tell me a joke\` · \`tell me a secret\` · \`gossip\` · \`weather\` · \`are we friends\` · \`howdy\` · \`sing\`\n\n` +
      `**Birthday**\n` +
      `\`my birthday is January 15\` — registers your birthday\n` +
      `\`when's my birthday\` — looks up your saved birthday`
    )
  );

  await channel.send({
    components: [convContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // ── AI Chat ──
  const aiContainer = new ContainerBuilder()
    .setAccentColor(0x2ECC71);

  aiContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### :sparkles: AI Conversations\n` +
      `If none of the above triggers match, Peaches uses **AI** to have a natural conversation.\n\n` +
      `Just talk to her about anything — she'll stay in character as the sassy town secretary.\n` +
      `She remembers context within each channel (last 20 messages).`
    )
  );

  await channel.send({
    components: [aiContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // ── Automatic Features ──
  const autoContainer = new ContainerBuilder()
    .setAccentColor(0x95A5A6);

  autoContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### :gear: Automatic Features (No Trigger Needed)\n\n` +
      `**Welcome Messages** — New members get auto-role + welcome + DM\n` +
      `**Birthday Announcements** — Daily at 8 AM EST in <#${CHANNELS.celebrationCorner}>\n` +
      `**Milestone Celebrations** — Daily at 9 AM EST in <#${CHANNELS.celebrationCorner}>\n` +
      `**XP Level-ups** — Posted in <#${CHANNELS.celebrationCorner}>\n` +
      `**Conversation Starters** — Daily at 10 AM EST in <#${CHANNELS.generalChat}>\n` +
      `**Photo of the Week** — Sundays at 12 PM EST in <#${CHANNELS.generalChat}>\n` +
      `**Food Topics** — Mondays at 11 AM EST in <#${CHANNELS.foodLovers}>`
    )
  );

  await channel.send({
    components: [autoContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // ── Footer ──
  const footerContainer = new ContainerBuilder()
    .setAccentColor(0xD4A574);

  footerContainer.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  footerContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# :peach: Peaches Bot — Ridgeline, Georgia — Last updated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    )
  );

  await channel.send({
    components: [footerContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  console.log('[Discord Bot] Trigger reference posted to #bot-commands');
}

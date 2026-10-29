/**
 * Post the #tuning-in join card for an existing member, e.g. to preview it or greet someone the bot missed.
 *
 *   npm run setup:join-card -- <username>
 */
import { GatewayIntentBits, Client } from 'discord.js';
import { config } from '../config.js';
import { joinCardMessage } from '../welcome.js';

const username = process.argv[2]?.toLowerCase();
if (!username) {
  console.error('Usage: npm run setup:join-card -- <username>');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const ready = new Promise<void>((resolve) => client.once('clientReady', () => resolve()));
try {
  await client.login(config.token);
  await ready;
  const guild = await client.guilds.fetch(config.guildId);
  await guild.channels.fetch();
  const members = await guild.members.fetch({ query: username, limit: 10 });
  const member = members.find((m) => m.user.username.toLowerCase() === username) ?? members.first();
  const channel = guild.systemChannel;
  if (!member) throw new Error(`No member matching "${username}"`);
  if (!channel?.isSendable()) throw new Error('No system channel set — run setup:welcome first');
  // Replace this member's earlier card rather than stacking a second one.
  const recent = await channel.messages.fetch({ limit: 50 });
  for (const old of recent.filter((m) => m.author.id === client.user!.id && (m.embeds[0]?.title === member.displayName || m.attachments.some((a) => a.name === 'join-card.png') && m.mentions.users.has(member.id))).values()) {
    await old.delete().catch(() => {});
  }
  await channel.send(await joinCardMessage(member));
  console.log(`[Pulsify] Join card for ${member.user.username} posted in #${channel.name}`);
} catch (err) {
  console.error('[Discord Bot] Join card failed:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.destroy();
}

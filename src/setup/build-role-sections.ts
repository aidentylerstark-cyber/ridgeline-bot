/**
 * Role sections: create the divider roles, put every role in section order under the bot,
 * and give each member the dividers for the sections they hold roles in. Safe to re-run.
 *
 *   npm run setup:roles
 */
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config.js';
import { ROLE_SECTIONS, arrangeRoles, syncDividers } from '../role-sections.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const ready = new Promise<void>((resolve) => client.once('clientReady', () => resolve()));
try {
  await client.login(config.token);
  await ready;
  const guild = await client.guilds.fetch(config.guildId);
  await arrangeRoles(guild);
  console.log(`[Pulsify] Roles arranged in ${ROLE_SECTIONS.length} sections`);
  const members = await guild.members.fetch();
  for (const member of members.values()) await syncDividers(member);
  console.log(`[Pulsify] Section dividers synced for ${members.filter((m) => !m.user.bot).size} members`);
} catch (err) {
  console.error('[Discord Bot] Role sections failed:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.destroy();
}

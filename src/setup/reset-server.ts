/**
 * Wipe the Pulsify server back to empty: every channel and every role the bot can delete.
 * Dry run by default — prints what would go. Pass --confirm to actually delete.
 *
 *   npm run setup:reset             # preview
 *   npm run setup:reset -- --confirm
 */
import { withGuild } from './connect.js';

const confirm = process.argv.includes('--confirm');

await withGuild(async (guild) => {
  const channels = [...(await guild.channels.fetch()).values()].filter((c) => c !== null);
  const me = await guild.members.fetchMe();
  const roles = [...(await guild.roles.fetch()).values()]
    .filter((r) => r.id !== guild.id && !r.managed) // keep @everyone and bot/integration roles
    .sort((a, b) => b.position - a.position);
  const deletableRoles = roles.filter((r) => r.position < me.roles.highest.position);
  const blockedRoles = roles.filter((r) => r.position >= me.roles.highest.position);

  console.log(`\n${channels.length} channels:`);
  for (const c of channels) console.log(`  - ${c.name}`);
  console.log(`\n${deletableRoles.length} roles:`);
  for (const r of deletableRoles) console.log(`  - ${r.name}`);
  if (blockedRoles.length) {
    console.log(`\nCan't delete (above the bot's role — drag the bot's role to the top to include them):`);
    for (const r of blockedRoles) console.log(`  - ${r.name}`);
  }

  if (!confirm) {
    console.log('\nDry run — nothing deleted. Re-run with --confirm to wipe.');
    return;
  }

  let failed = 0;
  // Delete children before categories so nothing gets orphaned mid-run.
  for (const c of channels.sort((a, b) => Number(a.type === 4) - Number(b.type === 4))) {
    try {
      await c.delete('Pulsify fresh start');
    } catch (err) {
      failed++;
      console.warn(`[Discord Bot] Couldn't delete #${c.name}: ${(err as Error).message}`);
    }
  }
  for (const r of deletableRoles) {
    try {
      await r.delete('Pulsify fresh start');
    } catch (err) {
      failed++;
      console.warn(`[Discord Bot] Couldn't delete role ${r.name}: ${(err as Error).message}`);
    }
  }
  console.log(`\n[Pulsify] Server wiped (${failed} failures).`);
});

import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS, BIRTHDAY_ROLE } from '../config.js';
import { getTodaysBirthdays, formatBirthdayDate } from '../features/birthdays.js';
import { hasBirthdayPosted, recordBirthdayPost, scheduleRoleRemoval } from '../storage.js';
import { isBotActive } from '../utilities/instance-lock.js';

export function scheduleBirthdayCheck(client: Client): cron.ScheduledTask {
  // Run daily at 8 AM Eastern
  const task = cron.schedule('0 8 * * *', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const birthdayChannel = guild.channels.cache.get(CHANNELS.birthdays ?? CHANNELS.celebrationCorner) as TextChannel | undefined;
      if (!birthdayChannel) return;

      // Use Eastern time to match the cron schedule timezone
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const birthdayPeople = await getTodaysBirthdays();

      if (birthdayPeople.length > 0) {
        const members = await guild.members.fetch({ user: birthdayPeople.map(b => b.discordUserId) });
        const currentYear = today.getFullYear();

        for (const bp of birthdayPeople) {
          const alreadyPosted = await hasBirthdayPosted(bp.discordUserId, currentYear);
          if (alreadyPosted) continue;

          // Check member exists BEFORE recording the post (so left members can retry next year)
          const member = members.get(bp.discordUserId);
          if (!member) {
            console.log(`[Peaches] Birthday user ${bp.discordUserId} not found in guild — skipping`);
            continue;
          }

          await recordBirthdayPost(bp.discordUserId, currentYear);

          const charName = bp.characterName ?? member.displayName;
          const embed = new EmbedBuilder()
            .setColor(0xFF69B4)
            .setTitle(`\uD83C\uDF82  Happy Birthday, ${charName}!`)
            .setDescription(
              `Well ring the church bells and break out the cake \u2014 it's **${charName}'s** birthday today!\n\n` +
              `> *The whole town of Ridgeline wishes you the sweetest day, sugar. ` +
              `May your year be full of front-porch sittin', sweet tea sippin', and all the good things you deserve.*\n\n` +
              `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n` +
              `\uD83C\uDF89 **Resident:** ${member.displayName}\n` +
              `\uD83C\uDF82 **Birthday:** ${formatBirthdayDate(bp.month, bp.day)}\n` +
              `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n` +
              `*Drop a birthday wish below! Let's make 'em feel the Ridgeline love!* \uD83C\uDF51\uD83C\uDF8A`
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: 'Ridgeline Birthday Celebrations \u2014 Powered by Peaches \uD83C\uDF51' })
            .setTimestamp();

          await birthdayChannel.send({ content: `\uD83C\uDF82 Happy Birthday <@${bp.discordUserId}>!`, embeds: [embed] });
          console.log(`[Peaches] Birthday posted for ${member.displayName} (${charName})`);

          // Assign birthday role — schedule removal via DB (survives restarts)
          const birthdayRole = member.guild.roles.cache.find(r => r.name === BIRTHDAY_ROLE);
          if (birthdayRole && !member.roles.cache.has(birthdayRole.id)) {
            await member.roles.add(birthdayRole).catch(() => {});
            const removeAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await scheduleRoleRemoval(member.id, BIRTHDAY_ROLE, removeAt);
          }

          await new Promise(r => setTimeout(r, 2000));
        }
      }
    } catch (err) {
      console.error('[Peaches] Birthday check failed:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Birthday check scheduled: 8:00 AM ET daily');
  return task;
}

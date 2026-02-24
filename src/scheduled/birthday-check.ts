import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { getTodaysBirthdays, formatBirthdayDate } from '../features/birthdays.js';
import { isBotActive } from '../utilities/instance-lock.js';

let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

// Track posted birthday celebrations to avoid duplicates within the current day
const postedBirthdays = new Set<string>();
let lastBirthdayCleanupDate = '';

export function scheduleBirthdayCheck(client: Client) {
  const now = new Date();
  // Check daily at 8 AM EST = 13:00 UTC
  const next = new Date(now);
  next.setUTCHours(13, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  const delay = next.getTime() - now.getTime();

  pendingTimeout = setTimeout(async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) { scheduleBirthdayCheck(client); return; }

      const birthdayChannel = guild.channels.cache.get(CHANNELS.birthdays) as TextChannel | undefined;
      if (!birthdayChannel) { scheduleBirthdayCheck(client); return; }

      const today = new Date();
      const todayKey = `${today.getMonth() + 1}-${today.getDate()}`;

      // Clear the Set when the day changes to prevent unbounded growth
      if (lastBirthdayCleanupDate !== todayKey) {
        postedBirthdays.clear();
        lastBirthdayCleanupDate = todayKey;
      }

      const birthdayPeople = await getTodaysBirthdays();

      if (birthdayPeople.length > 0) {
        // Fetch only the members we need
        const members = await guild.members.fetch({ user: birthdayPeople.map(b => b.discordUserId) });

        for (const bp of birthdayPeople) {
          const key = `${bp.discordUserId}-${todayKey}`;
          if (postedBirthdays.has(key)) continue;
          postedBirthdays.add(key);

          const member = members.get(bp.discordUserId);
          if (!member) continue;

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
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    } catch (err) {
      console.error('[Peaches] Birthday check failed:', err);
    }

    scheduleBirthdayCheck(client);
  }, delay);

  console.log(`[Discord Bot] Next birthday check in ${Math.round(delay / 60000)} minutes`);
}

export function cancelBirthdayCheck(): void {
  if (pendingTimeout) { clearTimeout(pendingTimeout); pendingTimeout = null; }
}

import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';

const CONVERSATION_PROMPTS = [
  { emoji: '\u2600\uFE0F', prompt: 'Good morning, Ridgeline! What\'s your character up to today?' },
  { emoji: '\uD83C\uDFE1', prompt: 'What\'s your favorite spot in Ridgeline and why?' },
  { emoji: '\uD83C\uDF7D\uFE0F', prompt: 'If your character opened a restaurant in town, what would they serve?' },
  { emoji: '\uD83D\uDCD6', prompt: 'Tell us one thing about your character\'s backstory that nobody in town knows yet.' },
  { emoji: '\uD83C\uDFB5', prompt: 'What song would play if your character had a theme song?' },
  { emoji: '\uD83C\uDF05', prompt: 'Describe your character\'s perfect day in Ridgeline.' },
  { emoji: '\uD83E\uDD1D', prompt: 'Which character in town would yours most want to be friends with?' },
  { emoji: '\uD83C\uDFEA', prompt: 'If you could add one business to Ridgeline, what would it be?' },
  { emoji: '\uD83D\uDCEC', prompt: 'Your character just got a letter in the mail \u2014 who\'s it from and what does it say?' },
  { emoji: '\uD83C\uDF19', prompt: 'What does your character do when the rest of the town is asleep?' },
  { emoji: '\uD83C\uDF92', prompt: 'Your character is packing a bag for a weekend trip \u2014 what are the three things they can\'t leave without?' },
  { emoji: '\uD83C\uDFC6', prompt: 'What\'s a small win your character had recently that made them smile?' },
  { emoji: '\u2615', prompt: 'Coffee, tea, or something stronger? What\'s your character\'s go-to drink?' },
  { emoji: '\uD83D\uDC3E', prompt: 'Does your character have a pet? If not, what animal would they adopt?' },
  { emoji: '\uD83D\uDCF8', prompt: 'Post your favorite recent screenshot of Ridgeline!' },
  { emoji: '\uD83C\uDFAD', prompt: 'What roleplay scene are you most looking forward to this week?' },
  { emoji: '\uD83C\uDF33', prompt: 'If your character could change one thing about Ridgeline, what would it be?' },
  { emoji: '\uD83C\uDF89', prompt: 'What\'s something your character is secretly proud of?' },
  { emoji: '\uD83D\uDC40', prompt: 'Drop a hint about a storyline you\'re working on \u2014 no spoilers!' },
  { emoji: '\uD83C\uDFE0', prompt: 'Show us your character\'s home! Screenshots welcome.' },
  { emoji: '\uD83D\uDCAD', prompt: 'What\'s one rumor going around town right now?' },
];

export function scheduleConversationStarter(client: Client): cron.ScheduledTask {
  // Run daily at 10 AM Eastern
  const task = cron.schedule('0 10 * * *', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const generalChat = guild.channels.cache.get(CHANNELS.generalChat) as TextChannel | undefined;
      if (!generalChat) return;

      const today = new Date();
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
      const promptIndex = dayOfYear % CONVERSATION_PROMPTS.length;
      const { emoji, prompt } = CONVERSATION_PROMPTS[promptIndex];

      const embed = new EmbedBuilder()
        .setColor(0xF5A623)
        .setTitle(`${emoji}  Daily Conversation Starter`)
        .setDescription(`*${prompt}*`)
        .setFooter({ text: 'Drop your answer below! \u2014 Ridgeline Community Hub' });

      await generalChat.send({ embeds: [embed] });
      console.log(`[Discord Bot] Posted daily conversation starter: "${prompt}"`);
    } catch (err) {
      console.error('[Discord Bot] Failed to post conversation starter:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Conversation starter scheduled: 10:00 AM ET daily');
  return task;
}

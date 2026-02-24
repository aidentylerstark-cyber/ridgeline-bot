import cron from 'node-cron';
import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { isBotActive } from '../utilities/instance-lock.js';

const FOOD_TOPICS: Array<{ emoji: string; title: string; prompt: string; poll?: { question: string; options: string[] } }> = [
  { emoji: '\uD83C\uDF57', title: 'Southern Comfort Week', prompt: 'What\'s your ultimate comfort food? Fried chicken, mac & cheese, biscuits and gravy \u2014 share your favorites and recipes!', poll: { question: '\uD83C\uDF57 Best Southern comfort food?', options: ['Fried Chicken', 'Mac & Cheese', 'Biscuits & Gravy', 'Cornbread', 'Collard Greens'] } },
  { emoji: '\uD83D\uDD25', title: 'Best BBQ', prompt: 'Pulled pork, brisket, ribs \u2014 what\'s your BBQ order and who makes it best? Bonus points for recipes or SL restaurant recommendations.', poll: { question: '\uD83D\uDD25 Best BBQ meat?', options: ['Pulled Pork', 'Brisket', 'Ribs', 'Chicken'] } },
  { emoji: '\uD83E\uDD67', title: 'Pie Week', prompt: 'Sweet potato, pecan, apple, key lime \u2014 what pie does your character bring to the town potluck?', poll: { question: '\uD83E\uDD67 Best pie for the potluck?', options: ['Sweet Potato', 'Pecan', 'Apple', 'Key Lime', 'Peach Cobbler'] } },
  { emoji: '\u2615', title: 'Morning Rituals', prompt: 'How does your morning start? Coffee, tea, a full breakfast spread? Share your real or RP morning routine.', poll: { question: '\u2615 Morning drink of choice?', options: ['Coffee (black)', 'Coffee (cream & sugar)', 'Sweet Tea', 'Regular Tea', 'Orange Juice'] } },
  { emoji: '\uD83C\uDF36\uFE0F', title: 'Spice It Up', prompt: 'What\'s the spiciest thing you\'ve ever eaten? How does your character handle heat?' },
  { emoji: '\uD83C\uDF70', title: 'Bake-Off Week', prompt: 'If Ridgeline held a baking contest, what would you enter? Share your best baked goods recipes!' },
  { emoji: '\uD83E\uDD58', title: 'One-Pot Wonders', prompt: 'Soups, stews, chili, gumbo \u2014 share your best one-pot meals. Perfect for a cold Georgia evening.' },
  { emoji: '\uD83C\uDF55', title: 'Guilty Pleasures', prompt: 'What food do you eat that others might judge you for? No shame here \u2014 this is a safe space.' },
  { emoji: '\uD83E\uDD57', title: 'Garden Fresh', prompt: 'What would your character grow in a Ridgeline garden? Share your favorite fresh recipes.' },
  { emoji: '\uD83C\uDF82', title: 'Celebration Cakes', prompt: 'What cake does your character order for their birthday? Share your favorite cake recipes or bakery finds!' },
  { emoji: '\uD83C\uDF2E', title: 'Taco Tuesday (All Week)', prompt: 'Tacos, burritos, enchiladas \u2014 share your favorite Mexican-inspired dishes and recipes.' },
  { emoji: '\uD83C\uDF73', title: 'Brunch Goals', prompt: 'If Ridgeline had a brunch spot, what would be on the menu? Eggs benedict, pancake stacks, mimosas?' },
];

export function scheduleFoodTopic(client: Client): cron.ScheduledTask {
  // Run every Monday at 11 AM Eastern
  const task = cron.schedule('0 11 * * 1', async () => {
    if (!isBotActive()) return;
    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return;

      const foodChannel = guild.channels.cache.get(CHANNELS.foodLovers) as TextChannel | undefined;
      if (!foodChannel) return;

      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 0);
      const weekOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (7 * 86400000));
      const topicIndex = weekOfYear % FOOD_TOPICS.length;
      const topic = FOOD_TOPICS[topicIndex];

      const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle(`${topic.emoji}  This Week: ${topic.title}`)
        .setDescription(
          `*${topic.prompt}*\n\n` +
          '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
          '*Share recipes, photos, restaurant finds, or just talk about what makes you hungry!*'
        )
        .setFooter({ text: 'Ridgeline Food Lovers \u2014 Weekly Topic' });

      await foodChannel.send({ embeds: [embed] });

      if (topic.poll) {
        await foodChannel.send({
          poll: {
            question: { text: topic.poll.question },
            answers: topic.poll.options.map(text => ({ text })),
            duration: 168, // 7 days
            allowMultiselect: false,
          },
        });
      }

      console.log(`[Discord Bot] Posted food topic: ${topic.title}${topic.poll ? ' (with poll)' : ''}`);
    } catch (err) {
      console.error('[Discord Bot] Food topic failed:', err);
    }
  }, { timezone: 'America/New_York' });

  console.log('[Discord Bot] Food topic scheduled: 11:00 AM ET every Monday');
  return task;
}

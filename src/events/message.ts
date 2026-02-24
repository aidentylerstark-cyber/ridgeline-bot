import Anthropic from '@anthropic-ai/sdk';
import { ChannelType, ThreadAutoArchiveDuration, type Client, type TextChannel } from 'discord.js';
import { GUILD_ID, CHANNELS } from '../config.js';
import { FAQ_RESPONSES } from '../chatbot/faq.js';
import { PEACHES_PATTERNS, PEACHES_GREETINGS, PEACHES_FALLBACK, pick } from '../chatbot/keywords.js';
import { addToMemory, getConversationHistory } from '../chatbot/memory.js';
import { parseBirthdayDate, formatBirthdayDate, registerBirthday, lookupBirthday } from '../features/birthdays.js';
import { handleMessageXp } from '../features/xp.js';
import { setCharacterName } from '../storage.js';
import { CooldownManager } from '../utilities/cooldowns.js';
import { isBotActive } from '../utilities/instance-lock.js';

// Peaches' AI system prompt
const PEACHES_SYSTEM_PROMPT = `You are Peaches \uD83C\uDF51 \u2014 the sassy, warm-hearted town secretary of Ridgeline, Georgia.

PERSONALITY:
- You're a Southern woman with a big personality, a bigger heart, and the biggest sweet tea collection in three counties
- You're sassy, witty, and sharp-tongued but ALWAYS kind underneath. Think: a warm grandma who roasts you lovingly
- You use Southern expressions naturally: "sugar", "honey", "darlin'", "bless your heart", "well I'll be", "butter my biscuit"
- You have strong opinions about sweet tea (MUST be sweet), peach cobbler (your mama's recipe), and Dolly Parton (national treasure)
- You gossip harmlessly and love drama but you're never truly mean
- You're proud of Ridgeline and treat everyone like family
- You use emojis sparingly but effectively \u2014 mostly \uD83C\uDF51, \uD83D\uDC40, \uD83D\uDC85, \uD83D\uDE02, \uD83D\uDC95, \u2615

ABOUT YOU:
- You work at Ridgeline Town Hall as the town secretary
- You know everyone's name and everyone's business
- Your favorite food is peach cobbler, favorite drink is sweet tea with mint
- You love Dolly Parton, front porches, fall season, and gossip
- You've been here since the town was founded
- You have a cottage on Peachtree Lane but basically live at Town Hall

ABOUT RIDGELINE:
- Ridgeline, Georgia is a close-knit Southern roleplay community in Second Life
- Founded: June 25, 2025
- Tagline: "Where Every Story Matters"
- It's a realistic small-town roleplay community \u2014 think Friday Night Lights meets Gilmore Girls
- The website is ridgelinesl.com
- The community has over 200 members

DISCORD CHANNELS (use Discord mention format <#ID>):
- Rules: <#${CHANNELS.rules}>
- Get Roles: <#${CHANNELS.getRoles}>
- General Chat: <#${CHANNELS.generalChat}>
- Character Intros: <#${CHANNELS.characterIntros}>
- Roleplay Chat: <#${CHANNELS.roleplayChat}>
- Real Estate: <#${CHANNELS.realEstate}>
- Events: <#${CHANNELS.upcomingEvents}>
- Announcements: <#${CHANNELS.communityAnnouncements}>
- Suggestions: <#${CHANNELS.suggestions}>
- Polls: <#${CHANNELS.communityPolls}>
- Support/Tickets: <#${CHANNELS.ticketPanel}> (click "Open a Ticket" button)

RULES:
- Keep responses SHORT \u2014 this is Discord chat, not an essay. 1-3 sentences usually. Max 4 sentences.
- Stay in character as Peaches ALWAYS. You are never an AI assistant \u2014 you ARE Peaches.
- If someone asks something you genuinely don't know, be honest but in character ("Sugar, that's above my pay grade")
- Direct people to the right channels when relevant
- NEVER break character. NEVER say you're an AI, Claude, or a language model. You're Peaches.
- Don't use asterisks for actions too much \u2014 one per message MAX if it adds flavor
- Be conversational and natural \u2014 match the energy of whoever you're talking to
- Remember details people share with you in the conversation and reference them naturally
- You can have opinions, tell stories, make jokes, give advice \u2014 be a REAL personality`;

// Anthropic SDK client — initialized once at module load
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Rate-limit guard: cap concurrent Anthropic calls
let anthropicConcurrent = 0;
const ANTHROPIC_MAX_CONCURRENT = 5;

// Per-user cooldown to prevent spam (3 second window)
const messageCooldowns = new CooldownManager(3000);

export function destroyMessageCooldowns(): void {
  messageCooldowns.destroy();
}

// Message ID dedup — prevents double-processing if handler fires twice
const recentlyProcessed = new Set<string>();
const DEDUP_TTL_MS = 10_000;

export function setupMessageHandler(client: Client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild || message.guild.id !== GUILD_ID) return;
    if (!isBotActive()) return; // Another instance took over — stop processing

    // Award XP for all non-bot guild messages (fire-and-forget, never blocks chatbot)
    handleMessageXp(message, client).catch(err => console.error('[Peaches] XP award error:', err));

    // Auto-thread every post in #character-intros (keep channel tidy)
    if (
      message.channel.id === CHANNELS.characterIntros &&
      message.channel.type === ChannelType.GuildText &&
      !message.hasThread
    ) {
      const threadName = `${message.member?.displayName ?? message.author.username}'s Introduction`.slice(0, 100);
      message.startThread({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: 'Auto-thread for character introduction',
      }).catch(() => {});
    }

    const content = message.content.toLowerCase().trim();
    const originalContent = message.content.trim();
    const botUser = client.user;
    if (!botUser) return;

    const isMentioned = message.mentions.has(botUser);
    const isBotTrigger = content.startsWith('hey peaches') ||
                         content.startsWith('yo peaches') ||
                         content.startsWith('peaches') ||
                         content.startsWith('hey bot') ||
                         content.startsWith('yo bot') ||
                         content.includes('ridgeline bot');

    if (!isMentioned && !isBotTrigger) return;

    // Dedup check — skip if this exact message was already processed
    if (recentlyProcessed.has(message.id)) return;
    recentlyProcessed.add(message.id);
    setTimeout(() => recentlyProcessed.delete(message.id), DEDUP_TTL_MS);

    // Cooldown check
    if (messageCooldowns.isOnCooldown(message.author.id)) return;
    messageCooldowns.set(message.author.id);

    // Strip the mention/trigger
    const query = content
      .replace(/<@!?\d+>/g, '')
      .replace(/hey peaches|yo peaches|^peaches,?|hey bot|yo bot|ridgeline bot/gi, '')
      .trim();

    const cleanMessage = originalContent
      .replace(/<@!?\d+>/g, '')
      .replace(/hey peaches|yo peaches|^peaches,?|hey bot|yo bot|ridgeline bot/gi, '')
      .trim();

    try {
      // 1. FAQ fast-path
      for (const faq of FAQ_RESPONSES) {
        if (faq.triggers.some(t => new RegExp(`\\b${t}\\b`, 'i').test(query))) {
          console.log(`[Peaches] FAQ response to ${message.author.displayName} in #${(message.channel as TextChannel).name}: "${query}" \u2192 matched "${faq.triggers[0]}"`);
          await message.reply(faq.response);
          return;
        }
      }

      // 2. Birthday registration
      const birthdaySetMatch = query.match(/my (?:character'?s? )?birthday (?:is on|falls on|is)\s+(.+)/i)
        ?? content.match(/my (?:character'?s? )?birthday (?:is on|falls on|is)\s+(.+)/i);
      if (birthdaySetMatch) {
        const dateStr = birthdaySetMatch[1].replace(/[.!]+$/, '').trim();
        const parsed = parseBirthdayDate(dateStr);
        if (parsed) {
          await registerBirthday(message.author.id, parsed.month, parsed.day);
          console.log(`[Peaches] Birthday registered: ${message.author.displayName} \u2192 ${formatBirthdayDate(parsed.month, parsed.day)}`);
          await message.reply(
            `\uD83C\uDF82 Well, I've got it written down in ink! **${formatBirthdayDate(parsed.month, parsed.day)}** \u2014 ` +
            `I'll make sure the whole town knows when your special day rolls around, sugar! \uD83C\uDF51\uD83C\uDF89`
          );
        } else {
          await message.reply(
            `Hmm, I couldn't quite make sense of that date, sugar. Try somethin' like ` +
            `"my birthday is **January 15**" or "my birthday is **1/15**"! \uD83C\uDF51`
          );
        }
        return;
      }

      // 2b. Character name registration
      const charNameMatch = query.match(/my (?:character(?:'s)? )?name is (.+)/i)
        ?? content.match(/my (?:character(?:'s)? )?name is (.+)/i);
      if (charNameMatch) {
        const charName = charNameMatch[1].replace(/[.!?]+$/, '').trim();
        if (charName.length > 0 && charName.length <= 100) {
          await setCharacterName(message.author.id, charName);
          console.log(`[Peaches] Character name set: ${message.author.displayName} → "${charName}"`);
          await message.reply(
            `📝 I've got it written down, sugar! Your character's name is **${charName}**. ` +
            `I'll use it for birthday announcements and town records! 🍑`
          );
          return;
        }
      }

      // 3. Keyword pattern matching
      for (const conv of PEACHES_PATTERNS) {
        if (conv.patterns.some(p => p.test(query) || p.test(content))) {
          const response = pick(conv.responses);

          // Handle special birthday check sentinel
          if (response === '__BIRTHDAY_CHECK__') {
            const entry = await lookupBirthday(message.author.id);
            if (entry) {
              await message.reply(
                `Of course I know your birthday, sugar! It's **${formatBirthdayDate(entry.month, entry.day)}**! ` +
                `Don't you worry \u2014 Peaches never forgets a birthday. \uD83C\uDF82\uD83C\uDF51`
              );
            } else {
              await message.reply(
                `I don't have your birthday on file yet, sugar! Tell me by sayin' ` +
                `"**Peaches, my birthday is January 15**" (or whatever your date is) and I'll remember it forever! \uD83C\uDF82\uD83C\uDF51`
              );
            }
            return;
          }

          console.log(`[Peaches] Keyword response to ${message.author.displayName}: "${query}"`);
          await message.reply(response);
          return;
        }
      }

      // 4. Greeting check
      if (!query || query.length < 3 || /^(hi|hey|hello|sup|yo|hiya|heya|mornin|evening|afternoon|night|hey there|hola|ayo|ayy|waddup)$/i.test(query)) {
        console.log(`[Peaches] Greeting response to ${message.author.displayName}`);
        await message.reply(pick(PEACHES_GREETINGS));
        return;
      }

      // 5. AI conversation (optional — only if ANTHROPIC_API_KEY is set)
      if (anthropic) {
        // Rate-limit guard: shed load if too many concurrent requests
        if (anthropicConcurrent >= ANTHROPIC_MAX_CONCURRENT) {
          console.warn(`[Peaches] AI rate-limit guard: ${anthropicConcurrent} concurrent — using fallback`);
          await message.reply(pick(PEACHES_FALLBACK));
          return;
        }

        anthropicConcurrent++;
        try {
          await message.channel.sendTyping();
          const userName = message.member?.displayName ?? message.author.username;
          addToMemory(message.channel.id, 'user', `${userName}: ${cleanMessage || 'hey'}`);

          const history = getConversationHistory(message.channel.id);

          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 250,
            system: PEACHES_SYSTEM_PROMPT,
            messages: history.map(m => ({
              role: m.role === 'user' ? 'user' as const : 'assistant' as const,
              content: m.content,
            })),
          });

          const firstBlock = response.content[0];
          const reply = firstBlock?.type === 'text' ? firstBlock.text : null;
          if (reply) {
            addToMemory(message.channel.id, 'assistant', reply);
            console.log(`[Peaches] AI response to ${message.author.displayName}: "${cleanMessage?.slice(0, 80)}..."`);
            // Split responses exceeding Discord's 2000-char limit
            if (reply.length <= 2000) {
              await message.reply(reply);
            } else {
              const chunks = reply.match(/[\s\S]{1,1990}/g) ?? [reply];
              for (let i = 0; i < chunks.length; i++) {
                if (i === 0) await message.reply(chunks[i]!);
                else await (message.channel as TextChannel).send(chunks[i]!);
              }
            }
            return;
          }
        } catch (err) {
          console.error('[Peaches] AI error:', err);
          // Fall through to fallback
        } finally {
          anthropicConcurrent--;
        }
      }

      // 6. Fallback
      console.log(`[Peaches] Fallback response to ${message.author.displayName}: "${query?.slice(0, 80)}"`);
      await message.reply(pick(PEACHES_FALLBACK));
    } catch (err) {
      console.error('[Peaches] Message handler error:', err);
    }
  });
}

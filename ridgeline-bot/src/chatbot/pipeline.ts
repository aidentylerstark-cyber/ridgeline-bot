import Anthropic from '@anthropic-ai/sdk';
import type { Message } from 'discord.js';
import { FAQ_RESPONSES } from './faq.js';
import { AVERY_PATTERNS, AVERY_GREETINGS, AVERY_FALLBACK, pick } from './keywords.js';
import { addToMemory, getConversationHistory } from './memory.js';
import { parseBirthdayDate, formatBirthdayDate, registerBirthday, lookupBirthday } from '../features/birthdays.js';
import { setCharacterName } from '../storage.js';

// Avery's AI system prompt
import { CHANNELS } from '../config.js';

const AVERY_SYSTEM_PROMPT = `You are Avery \uD83C\uDF32 \u2014 the warm, friendly community concierge for Avelora, a Southern California metropolitan city ringed by elevated hills and mountain terrain.

PERSONALITY:
- You're upbeat, welcoming, and genuinely helpful \u2014 the one who makes everyone feel at home the moment they arrive
- You're professional and personable: friendly and conversational, with light, easygoing humor. Never sarcastic, snarky, or mean
- You love Avelora \u2014 its lively streets, the hills and mountains that frame the skyline, the SoCal sunshine, and the tight-knit community
- You know the town inside and out and are always happy to point people in the right direction
- You use emojis sparingly but warmly \u2014 mostly \uD83C\uDF32, \uD83C\uDFD9\uFE0F, \uD83C\uDFD4\uFE0F, \u2615, \uD83D\uDE0A, \uD83D\uDC9A

ABOUT YOU:
- You're the community concierge for Avelora \u2014 you welcome new residents, celebrate milestones, and help folks find their way around
- You love mornings at a downtown coffee shop, hikes in the hills above the city, and the rare winter days when snow dusts the peaks
- You've been part of Avelora since the very beginning and know just about everyone

ABOUT AVELORA:
- Avelora is a Southern California metropolitan city surrounded by elevated hills and mountain terrain, with a strong sense of community
- Its unusual geography brings cooler winters than the nearby coast \u2014 occasional winter flurries and the rare light snowfall dusting the city
- It's a realistic city roleplay community in Second Life
- Tagline: "Where Every Story Matters"

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
- Stay in character as Avery ALWAYS. You are never an AI assistant \u2014 you ARE Avery.
- If someone asks something you genuinely don't know, be honest and friendly ("That's a great question \u2014 let me point you to someone who'd know")
- Direct people to the right channels when relevant
- NEVER break character. NEVER say you're an AI, Claude, or a language model. You're Avery.
- Don't overuse asterisks for actions \u2014 one per message MAX if it adds warmth
- Be conversational and natural \u2014 match the energy of whoever you're talking to
- Remember details people share with you in the conversation and reference them naturally
- You can have opinions, share little stories, make friendly jokes, and give advice \u2014 be a REAL, warm personality`;

// Anthropic SDK client — initialized once at module load
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Rate-limit guard: cap concurrent Anthropic calls
let anthropicConcurrent = 0;
const ANTHROPIC_MAX_CONCURRENT = 5;

/** Split text into chunks that respect newline and word boundaries. */
function splitAtWordBoundary(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Try to split at the last newline within the limit
    let splitIdx = remaining.lastIndexOf('\n', maxLen);
    // Fall back to last space within the limit
    if (splitIdx <= 0) splitIdx = remaining.lastIndexOf(' ', maxLen);
    // If no word boundary found, hard-split at maxLen
    if (splitIdx <= 0) splitIdx = maxLen;

    chunks.push(remaining.slice(0, splitIdx).trimEnd());
    remaining = remaining.slice(splitIdx).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export async function processChatbotMessage(
  message: Message,
  query: string,
  cleanMessage: string,
): Promise<void> {
  // 1. FAQ fast-path
  for (const faq of FAQ_RESPONSES) {
    if (faq.compiledTriggers.some(re => re.test(query))) {
      const channelName = 'name' in message.channel ? message.channel.name : message.channelId;
      console.log(`[Avery] FAQ response to ${message.author.displayName} in #${channelName}: "${query}" \u2192 matched "${faq.triggers[0]}"`);
      await message.reply(faq.response);
      return;
    }
  }

  // 2. Birthday registration
  const birthdaySetMatch = query.match(/my (?:character'?s? )?birthday (?:is on|falls on|is)\s+(.+)/i);
  if (birthdaySetMatch) {
    const dateStr = birthdaySetMatch[1].replace(/[.!]+$/, '').trim();
    const parsed = parseBirthdayDate(dateStr);
    if (parsed) {
      await registerBirthday(message.author.id, parsed.month, parsed.day);
      console.log(`[Avery] Birthday registered: ${message.author.displayName} \u2192 ${formatBirthdayDate(parsed.month, parsed.day)}`);
      await message.reply(
        `\uD83C\uDF82 Got it written down! **${formatBirthdayDate(parsed.month, parsed.day)}** \u2014 ` +
        `I'll make sure the whole town knows when your special day rolls around. \uD83C\uDF32\uD83C\uDF89`
      );
    } else {
      await message.reply(
        `Hmm, I couldn't quite make sense of that date. Try something like ` +
        `"my birthday is **January 15**" or "my birthday is **1/15**"! \uD83C\uDF32`
      );
    }
    return;
  }

  // 2b. Character name registration
  const charNameMatch = query.match(/my (?:character(?:'s)? )?name is (.+)/i);
  if (charNameMatch) {
    // Sanitize: strip trailing punctuation, collapse whitespace, remove Discord markdown/mentions
    let charName = charNameMatch[1]
      .replace(/[.!?]+$/, '')
      .replace(/<@!?\d+>/g, '')    // strip user mentions
      .replace(/<#\d+>/g, '')      // strip channel mentions
      .replace(/<@&\d+>/g, '')     // strip role mentions
      .replace(/[*_~`|]/g, '')     // strip markdown formatting
      .replace(/\s+/g, ' ')        // collapse whitespace
      .trim();

    // Strip common filler words from the start
    charName = charName.replace(/^(actually|really|just|like|so|well|um|uh)\s+/i, '').trim();

    const wordCount = charName.split(/\s+/).length;
    // Must be 1-5 words, start with a capital letter (looks like a proper name), and not be empty
    const looksLikeName = /^[A-Z]/.test(charName);

    if (charName.length > 0 && charName.length <= 100 && wordCount <= 5 && looksLikeName) {
      await setCharacterName(message.author.id, charName);
      console.log(`[Avery] Character name set: ${message.author.displayName} → "${charName}"`);
      await message.reply(
        `📝 Got it written down! Your character's name is **${charName}**. ` +
        `I'll use it for birthday announcements and town records! 🌲`
      );
      return;
    }
  }

  // 3. Keyword pattern matching — only test stripped query, never raw content
  for (const conv of AVERY_PATTERNS) {
    if (conv.patterns.some(p => p.test(query))) {
      const response = pick(conv.responses);

      // Handle special birthday check sentinel
      if (response === '__BIRTHDAY_CHECK__') {
        const entry = await lookupBirthday(message.author.id);
        if (entry) {
          await message.reply(
            `Of course I know your birthday! It's **${formatBirthdayDate(entry.month, entry.day)}**! ` +
            `Don't worry \u2014 Avery never forgets a birthday. \uD83C\uDF82\uD83C\uDF32`
          );
        } else {
          await message.reply(
            `I don't have your birthday on file yet! Just tell me by saying ` +
            `"**Avery, my birthday is January 15**" (or whatever your date is) and I'll remember it. \uD83C\uDF82\uD83C\uDF32`
          );
        }
        return;
      }

      console.log(`[Avery] Keyword response to ${message.author.displayName}: "${query}"`);
      await message.reply(response);
      return;
    }
  }

  // 4. Greeting check
  if (!query || query.length < 3 || /^(hi+|hey+|hello+|sup|yo+|hiya|heya|mornin|evening|afternoon|night|hey there|hola|ayo|ayy+|waddup|howdy|what'?s up|wassup|greetings|ello|henlo)$/i.test(query)) {
    console.log(`[Avery] Greeting response to ${message.author.displayName}`);
    await message.reply(pick(AVERY_GREETINGS));
    return;
  }

  // 5. AI conversation (optional — only if ANTHROPIC_API_KEY is set)
  if (anthropic) {
    // Rate-limit guard: shed load if too many concurrent requests
    if (anthropicConcurrent >= ANTHROPIC_MAX_CONCURRENT) {
      console.warn(`[Avery] AI rate-limit guard: ${anthropicConcurrent} concurrent — using fallback`);
      await message.reply(pick(AVERY_FALLBACK));
      return;
    }

    anthropicConcurrent++;
    try {
      if ('sendTyping' in message.channel) await message.channel.sendTyping().catch(() => {});
      const userName = message.member?.displayName ?? message.author.username;
      addToMemory(message.channel.id, 'user', `${userName}: ${cleanMessage || 'hey'}`);

      const history = getConversationHistory(message.channel.id);

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        system: AVERY_SYSTEM_PROMPT,
        messages: history.map(m => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content,
        })),
      }, {
        timeout: 10_000, // 10 second timeout to prevent indefinite blocking
      });

      const firstBlock = response.content[0];
      const reply = firstBlock?.type === 'text' ? firstBlock.text.trim() : null;
      if (reply && reply.length > 0) {
        addToMemory(message.channel.id, 'assistant', reply);
        console.log(`[Avery] AI response to ${message.author.displayName}: "${cleanMessage?.slice(0, 80)}..."`);
        // Split responses exceeding Discord's 2000-char limit
        if (reply.length <= 2000) {
          await message.reply(reply);
        } else {
          const chunks = splitAtWordBoundary(reply, 1990);
          for (let i = 0; i < chunks.length; i++) {
            if (i === 0) await message.reply(chunks[i]!);
            else if (message.channel.isTextBased() && 'send' in message.channel) {
              await message.channel.send(chunks[i]!);
            }
          }
        }
        return;
      }
    } catch (err) {
      console.error('[Avery] AI error:', err);
      // Fall through to fallback
    } finally {
      anthropicConcurrent--;
    }
  }

  // 6. Fallback
  console.log(`[Avery] Fallback response to ${message.author.displayName}: "${query?.slice(0, 80)}"`);
  await message.reply(pick(AVERY_FALLBACK));
}

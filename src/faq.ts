import type { Guild } from 'discord.js';
import { cardMessage, linkRooms } from './cards.js';
import { brand } from './config.js';
import { ICON_URL, iconFile } from './assets.js';

export interface FaqEntry {
  /** Stable id used as the /faq choice value. */
  id: string;
  /** Shown in the /faq picker and as the embed title (max 100 chars). */
  question: string;
  answer: string;
  /** Lowercase words/phrases that trigger this answer when someone @mentions the bot. */
  keywords: string[];
}

// Facts and voice from the Pulsify Discord Server Brief: in character, and never the words
// player, character, roleplay, upload, user or account outside a (( )) line.
export const FAQ: FaqEntry[] = [
  {
    id: 'what-is-pulsify',
    question: 'What is Pulsify?',
    answer:
      `The records this city is actually making. Artists put their own records out on **[pulsify.world](${brand.links.website})**, ` +
      `listeners build playlists from what the rest of Los Santos is releasing, and out in the city it plays on ${brand.stationDial}.\n\n${brand.ooc}`,
    keywords: ['what is pulsify', 'about pulsify', 'what is this'],
  },
  {
    id: 'listen',
    question: 'How do I start listening?',
    answer:
      `Head to **[pulsify.world](${brand.links.website})**: play the catalog, follow artists, build playlists and save records. ` +
      'Your listener page keeps your badges, streaks and listening figures.\n\n' +
      '(( The site signs you in with your GTA World account only. ))',
    keywords: ['listen', 'sign in', 'sign up', 'signup', 'log in', 'login', 'register', 'playlist', 'badge', 'streak'],
  },
  {
    id: 'radio',
    question: 'Can I listen out in the city?',
    answer:
      `Yes. Pulsify plays in the city on ${brand.stationDial}: tune your car radio or a boombox to it and you hear the same stream as the site's player. ` +
      `**[pulsify.world/stream](${brand.links.stream})**\n\n` +
      `Want your business heard? Ad spots that play on the Pulsify stream can be bought by calling **${brand.phone}**, paid in $.`,
    keywords: ['the pulse', 'radio', 'station', '327', 'stream', 'in-car', 'car radio', 'boombox', 'in the city', 'ad spot', 'radio ad'],
  },
  {
    id: 'chart',
    question: 'What is The Pulsify 10?',
    answer:
      `The week's ten, written every Monday from the week's plays, with a countdown and past weeks at **[pulsify.world/charts](${brand.links.charts})**. ` +
      'Records that pass a plays line earn plaques, starting with Pulse Silver.',
    keywords: ['chart', 'pulsify 10', 'top 10', 'top ten', 'number one', 'plaque', 'silver', 'monday'],
  },
  {
    id: 'friday',
    question: 'What is Pulsify your Friday?',
    answer: `Twenty records picked for you every Friday, keepable as a playlist. **[pulsify.world/friday](${brand.links.friday})**`,
    keywords: ['friday', 'twenty records', 'picked for me', 'recommend'],
  },
  {
    id: 'artists',
    question: 'How do I put my records out?',
    answer:
      'Cut your record in the studio on pulsify.world and file it as a single, EP or album. Announce a drop for a day, go live from your page, ' +
      'post events, open a shop and take bookings.\n\nGot a page? Request the **Artist** role in #role-request with your page link, and a moderator sets you up here. One page each.',
    keywords: ['artist', 'my music', 'my record', 'my song', 'release', 'studio', 'drop', 'single', 'album', 'ep', 'check-in', 'check in', 'artist role', 'verified', 'go live'],
  },
  {
    id: 'merch',
    question: 'Where do I get merch?',
    answer:
      `Every artist shop is listed on **[merch.pulsify.world](${brand.links.merch})**, with each artist's own custom designs. ` +
      'Orders are paid in $ through Fleeca. New shops and drops are posted in #merch-shops.',
    keywords: ['merch', 'store', 'buy', 'clothes', 'shirt', 'hoodie', 'order', 'fleeca'],
  },
  {
    id: 'merch-shop',
    question: 'Can I get my own custom merch shop?',
    answer:
      'Yes. Every artist on Pulsify can open their own merch shop with their own designs, listed on the marketplace at ' +
      `**[merch.pulsify.world](${brand.links.merch})** and paid in $ through Fleeca.\n\n` +
      `First request the **Artist** role in #role-request with your page link. Then write to merch@pulsify.world from #pulsify-mail, or call **${brand.phone}**, to get your shop set up.`,
    keywords: ['my own shop', 'own merch', 'custom merch', 'merch shop', 'open a shop', 'sell merch', 'my merch', 'shop for my', 'design'],
  },
  {
    id: 'business',
    question: 'Bookings, placements and business',
    answer:
      `Booking an artist, a spot on the front pages, an ad on the Pulsify stream, or anything else with ${brand.name}: write to business@pulsify.world from #pulsify-mail or call us on **${brand.phone}**. Everything is paid in $. ` +
      `Placements: **[pulsify.world/advertise](${brand.links.advertise})**. Partner benefits: **[pulsify.world/benefits](${brand.links.website}/benefits)**.`,
    keywords: ['advertis', 'placement', 'front page', 'sponsor', 'partner', 'business', 'booking', 'book an artist', 'hire'],
  },
  {
    id: 'gigs',
    question: 'Where are the gigs?',
    answer: `Every night in the city is on the calendar at **[pulsify.world/events](${brand.links.events})**: who is playing, where, and when.`,
    keywords: ['gig', 'event', 'show', 'concert', 'tonight', 'venue', 'calendar'],
  },
  {
    id: 'report',
    question: 'How do I report a record?',
    answer: "Use the Report button on the record's page, so there is a record of it. The moderators' word is final.",
    keywords: ['report', 'stolen', 'not theirs', 'copyright', 'rights', 'appeal', 'taken down'],
  },
  {
    id: 'contact',
    question: 'How do I contact Pulsify?',
    answer:
      `Write to any of our desks from #pulsify-mail (support, artists, merch, business, management) or call ${brand.name} on **${brand.phone}**. ` +
      `${brand.name} is a Pulse Media Company, founded by Aiden Stark and Chaylen Young. Business licence LS-BL-000424, City of Los Santos.\n` +
      `Facebrowser: **[face.gta.world/page/pulsify](${brand.links.facebrowser})**`,
    keywords: ['phone', 'number', 'call', 'contact', 'reach', 'who runs', 'who owns', 'owner', 'founder', 'company', 'licence', 'license', 'facebrowser', 'pulse media'],
  },
];

export function findFaq(id: string): FaqEntry | undefined {
  return FAQ.find((e) => e.id === id);
}

/** Best keyword match for free-text questions; longer keyword hits win ties. */
export function matchFaq(text: string): FaqEntry | undefined {
  const normalized = text.toLowerCase();
  let best: FaqEntry | undefined;
  let bestScore = 0;
  for (const entry of FAQ) {
    const score = entry.keywords.reduce((sum, k) => (normalized.includes(k) ? sum + k.length : sum), 0);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

/** A FAQ answer as a Pulsify card; `#room` names in the answer become clickable links. */
export function faqReply(entry: FaqEntry, guild: Guild | null | undefined) {
  return cardMessage(
    {
      color: brand.color,
      eyebrow: `${brand.name} FAQ`,
      title: entry.question,
      description: linkRooms(entry.answer, guild),
      thumbnail: ICON_URL,
      footer: brand.footer,
    },
    [iconFile()],
  );
}

/** Shown when a question matches nothing: every topic, and where to go next. */
export function faqIndexReply(guild: Guild | null | undefined) {
  return cardMessage(
    {
      color: brand.color,
      eyebrow: `${brand.name} FAQ`,
      title: "Let's find the right answer",
      description:
        "I couldn't match that to an answer. Try `/faq`, or ask about one of these:\n" +
        FAQ.map((e) => `• ${e.question}`).join('\n') +
        linkRooms(`\n\nStill stuck? Write to support@pulsify.world from #pulsify-mail, or call **${brand.phone}**.`, guild),
      thumbnail: ICON_URL,
      footer: brand.footer,
    },
    [iconFile()],
  );
}

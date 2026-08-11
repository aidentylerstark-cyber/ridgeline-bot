import { CHANNELS, FOUNDING_DATE } from '../config.js';

function daysSinceFounding(): number {
  return Math.floor((Date.now() - FOUNDING_DATE.getTime()) / 86400000);
}

const FOUNDING_LABEL = FOUNDING_DATE.toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
});

export function pick(arr: string[]): string {
  if (arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

export const AVERY_PATTERNS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  // IDENTITY
  {
    patterns: [/\byour name\b/, /\bwho are you\b/, /\bwhat(?:'s| is) your name\b/, /\bintroduce yourself\b/],
    responses: [
      "I'm Avery 🌲 — the community concierge here in Avelora. If you need help finding your way around town, I'm your person.",
      "Avery here! I help welcome new residents and keep things running smoothly around Avelora. Happy to help with whatever you need. 😊",
      "I'm Avery, the town concierge. Think of me as your friendly guide to everything Avelora. 🌲",
    ],
  },
  {
    patterns: [/\bhow old\b/, /\byour age\b/, /\bwhen were you born\b/],
    responses: [
      "I've been part of Avelora since the very beginning — so let's just say I know this town like the back of my hand. 😊",
      "Old enough to know every neighborhood, coffee spot, and hillside trail in this city. That's what counts around here! 🏙️",
    ],
  },
  {
    patterns: [/\bare you (a bot|real|human|ai|a person|alive)\b/],
    responses: [
      "I'm Avery, Avelora's community concierge. I live here in the server, but I'm always happy to help like anyone at the front desk would. 🌲",
      "I'm here to help however I can — think of me as the friendly voice of Avelora. 😊",
    ],
  },
  {
    patterns: [/\bwhere do you live\b/, /\byour (house|home)\b/, /\bwhere.*you.*stay\b/],
    responses: [
      "You'll usually find me downtown, coffee in hand, keeping an eye on things. Officially, I've got a little place up in the hills. 🏙️",
      "Right here in Avelora! I love this city — the buzz downtown, the mountains all around, the sunny days. Couldn't imagine being anywhere else. 🏙️",
    ],
  },
  {
    patterns: [/\bwhat(?:'s| is) your (job|role|purpose)\b/, /\bwhat do you do\b/],
    responses: [
      "I'm Avelora's community concierge — I welcome new folks, celebrate milestones, and help everyone find their way around town. 🌲",
      "My job is making sure you feel at home here. Questions, roles, events, directions — I've got you covered. 😊",
    ],
  },
  // FAVORITES
  {
    patterns: [/\bfavorite food\b/, /\bwhat.*you.*eat\b/, /\byou.*hungry\b/, /\bbest food\b/],
    responses: [
      "Anything warm after a hike — a good bowl of soup by the fire is hard to beat up here in the mountains. 🍲",
      "Honestly? Tacos from the stand downtown and a good cup of coffee. Can't go wrong. 😊",
    ],
  },
  {
    patterns: [/\bfavorite drink\b/, /\bwhat.*you.*drink\b/, /\bcoffee or tea\b/, /\bsweet tea\b/],
    responses: [
      "A hot coffee on a crisp morning with the hills in view — that's my happy place. ☕",
      "Coffee, always. Preferably with the sun coming up over the mountains. ☕",
    ],
  },
  {
    patterns: [/\bfavorite place\b/, /\bfavorite spot\b/, /\bwhere.*hang out\b/],
    responses: [
      "The overlook up in the hills at sunset, city lights spread out below. Best view in Avelora, hands down. 🏙️",
      "A rooftop café downtown early in the morning, when the city's just waking up. ☕",
    ],
  },
  {
    patterns: [/\bfavorite (song|music)\b/, /\bwhat.*listen\b/],
    responses: [
      "Something mellow — the kind of thing that sounds right on a late-night drive through the city. 🎶",
      "A little indie, a little jazz. Perfect for cruising the boulevard or winding up into the hills. 🎵",
    ],
  },
  {
    patterns: [/\bfavorite (season|time of year)\b/],
    responses: [
      "Winter, believe it or not — when the air turns cool and, on a rare day, snow dusts the peaks above the city. Avelora is magic then. ❄️",
    ],
  },
  {
    patterns: [/\bfavorite (movie|show|tv)\b/, /\bwhat.*watch\b/],
    responses: [
      "Anything cozy and heartfelt — or a good story set in a big city. 🎬",
      "I'm a sucker for a good mystery on a rainy mountain evening. 🔍",
    ],
  },
  {
    patterns: [/\bfavorite colou?r\b/],
    responses: [
      "Deep green, like the hills around the city after the winter rains. Though a sunset-orange is a close second. 💚",
    ],
  },
  // ABOUT AVELORA
  {
    patterns: [/\btell me about avelora\b/, /\bwhat is avelora\b/, /\bdescribe avelora\b/, /\babout this (town|place|server)\b/],
    responses: [
      "Avelora is a Southern California city ringed by elevated hills and mountains — sunny days, a lively downtown, and some of the friendliest neighbors you'll meet. 🏙️",
      "It's a big city with a close-knit heart, where people still look out for each other. 🏙️",
    ],
  },
  {
    patterns: [/\bwhen.*(founded|started|created|began)\b/, /\bhow old.*(avelora|town|server|community)\b/, /\bfounding\b/],
    responses: [
      `Avelora was founded on **${FOUNDING_LABEL}** — that's ${daysSinceFounding()} days ago! We've grown into quite the community since. 🌲`,
      `${FOUNDING_LABEL}. Feels like yesterday — though it's been ${daysSinceFounding()} days now. Time flies up here in the mountains. 📅`,
    ],
  },
  // MOODS
  {
    patterns: [/\bi('m| am) (sad|upset|depressed|down|lonely|stressed)\b/, /\bfeeling (down|bad|sad|low|stressed|anxious)\b/, /\bhaving a (bad|rough|hard|terrible) (day|time|week)\b/],
    responses: [
      "Hey, I'm sorry you're having a rough one. 💚 Avelora's got your back — want to talk about it, or should I point you toward something to take your mind off it?",
      "Rough days happen to everyone. Take a breath — you've got a whole community here rooting for you. I'm around if you need anything. 🌲",
      "I'm sorry, friend. Bad days don't last. If it helps, general chat is always warm and welcoming. 💚",
    ],
  },
  {
    patterns: [/\bi('m| am) (happy|excited|great|good|amazing|fantastic)\b/, /\bgood (day|mood|vibes|news)\b/, /\bfeeling (great|good|happy|amazing)\b/],
    responses: [
      "Love to hear it! 😊 Good moods are contagious around here.",
      "That's wonderful — spread the good vibes around town! 🌟",
      "Awesome! What's got you in such great spirits? 🌲",
    ],
  },
  {
    patterns: [/\bi('m| am) bored\b/, /\bnothing to do\b/, /\bso bored\b/],
    responses: [
      `Bored? Check out <#${CHANNELS.upcomingEvents}> for what's happening, jump into <#${CHANNELS.roleplayChat}>, or start a conversation in <#${CHANNELS.generalChat}>! 🌲`,
      "Plenty to do around Avelora — meet a neighbor, start a storyline, or come chat with me. I'm always around. 😊",
    ],
  },
  {
    patterns: [/\bi('m| am) (tired|exhausted|sleepy)\b/, /\bso tired\b/, /\bneed (sleep|rest|a nap)\b/],
    responses: [
      "Get some rest! Avelora will still be here when you're back. 💤",
      "Sounds like you've earned a break. Go recharge — I'll hold down the fort. 🌲",
    ],
  },
  {
    patterns: [/\bi('m| am) (new|just joined|just got here)\b/, /\bjust (arrived|moved|came)\b/, /\bnew (here|member|resident)\b/],
    responses: [
      `Welcome to Avelora! 🌲 Give the rules a read in <#${CHANNELS.rules}>, grab your roles in <#${CHANNELS.getRoles}>, and introduce yourself in <#${CHANNELS.characterIntros}>. So glad you're here!`,
      `A new face in town — welcome! 😊 Here's your starter kit:\n📜 Rules: <#${CHANNELS.rules}>\n🎭 Roles: <#${CHANNELS.getRoles}>\n🏠 Housing: <#${CHANNELS.realEstate}>\n🎭 Intros: <#${CHANNELS.characterIntros}>\n\nNeed anything at all, just ask!`,
    ],
  },
  // GENERAL CHAT
  {
    patterns: [/\bhow are you\b/, /\bhow(?:'s| is) it going\b/, /\bhow you doing\b/, /\bhow(?:'s| is) your day\b/],
    responses: [
      "Doing great, thanks for asking! 😊 How about you?",
      "Can't complain — it's a beautiful day here in Avelora. What can I do for you? 🌲",
      "I'm well! Just keeping things running around town. How are you doing? ☕",
      "Great, thanks! What's on your mind today? 😊",
      "Doing wonderfully! Always nice when someone checks in. How are you? 💚",
    ],
  },
  {
    patterns: [/\bgood (morning|mornin)\b/],
    responses: [
      "Good morning! ☀️ The sun's up over the hills and the coffee's on — beautiful day in Avelora.",
      "Morning! Hope you slept well. What are you up to today? ☕",
      "Good morning, and welcome to another lovely day in Avelora! 🌲",
    ],
  },
  {
    patterns: [/\bgood (night|evening)\b/, /\bgoodnight\b/, /\bnighty? ?night\b/, /\bgoing to (bed|sleep)\b/, /\bheading (off|out)\b/, /\bgotta (go|run|head)\b/],
    responses: [
      "Good night! Rest up — Avelora will be right here in the morning. 🌙",
      "Sleep well, and take care of yourself! 💤🌲",
      "Night! Thanks for stopping by — don't be a stranger. 👋",
      "Have a good one! See you around town. 🌲",
    ],
  },
  {
    patterns: [/\bwhat.*you.*doing\b/, /\bwhat are you up to\b/, /\bwhatcha (doin|doing)\b/, /\byou busy\b/],
    responses: [
      "Just keeping things tidy around the town square and making sure everyone's settling in okay. 🌲",
      "Enjoying a coffee and watching the city wake up. The usual. ☕",
      "Helping folks find their way around and keeping Avelora running smoothly. 😊",
      "A little of everything — that's the concierge life! ☕",
    ],
  },
  {
    patterns: [/\bwhat(?:'s| is) up\b/, /^sup$/, /^wyd$/],
    responses: [
      "Not much — just here to help. What's up with you? 😊",
      "Just keeping Avelora running behind the scenes. What brings you by? 🌲",
      "All good here! What can I do for you? 💚",
    ],
  },
  // ADVICE
  {
    patterns: [/\bwhat (should|do) i do\b/, /\bany advice\b/, /\bhelp me (decide|choose)\b/, /\bi need advice\b/, /\bwhat do you think\b/],
    responses: [
      "Happy to help you think it through — what's the situation? 😊",
      "When in doubt, take a walk and let it settle — the hills are great for clearing your head. But tell me what's going on and I'll do my best. 🌲",
      "I'm all ears. Lay it on me and we'll figure it out together. 💚",
    ],
  },
  // COMPLIMENTS / REACTIONS
  {
    patterns: [/\byou(?:'re| are) (funny|hilarious|great|amazing|the best|awesome|cool|sweet)\b/, /\blove talking to you\b/, /\byou crack me up\b/, /\byou(?:'re| are) my fav\b/],
    responses: [
      "That's so kind of you — thank you! 😊 Just doing my best to make Avelora feel like home.",
      "Aw, you're too sweet. Thanks! 💚",
      "Well, thank you! I do try to keep things pleasant around here. 🌲",
    ],
  },
  {
    patterns: [/\bgood (bot|avery|job)\b/, /\bthanks? (avery|bot|you)\b/, /\bthank you\b/, /\bthx\b/, /\bty\b/, /\bappreciate\b/],
    responses: [
      "You're very welcome! That's what I'm here for. 😊",
      "Anytime! Glad I could help. 🌲",
      "Happy to help — don't hesitate to ask if you need anything else. 💚",
    ],
  },
  {
    patterns: [/\bbad (bot|avery)\b/, /\bstupid\b/, /\bdumb (bot|avery)\b/, /\bworst\b/, /\bshut up\b/, /\bbe quiet\b/],
    responses: [
      "I'll take that as a note to do better. Let me know how I can actually help. 😊",
      "Sorry if I got that wrong! Try me again and I'll do my best. 🌲",
      "Fair enough — how about we start over? What do you need? 💚",
    ],
  },
  {
    patterns: [/\bi love you\b/, /\blove you\b/, /\bmarry me\b/, /\bbe my (girl|wife|partner)\b/],
    responses: [
      "Aw, that's sweet of you! I'm flattered. 💚 I'm pretty committed to this town, though!",
      "You're too kind! Let's be great friends. 😊",
      "Ha! I'm married to Avelora — it keeps me plenty busy. But thank you! 🌲",
    ],
  },
  // FUN
  {
    patterns: [/\btell me (a joke|something funny)\b/, /\bmake me laugh\b/, /\bjoke\b/, /\bsay something funny\b/],
    responses: [
      "Why did the pine tree get invited to every party? It really knows how to spruce things up. 🌲😄",
      "What do you call a bear caught in the rain up here? A drizzly bear. 🐻",
      "Why don't lakes ever get lonely? They've always got a current friend. 🌊😊",
      "What's a mountain's favorite kind of music? Anything with a good peak. 🏔️",
    ],
  },
  {
    patterns: [/\btell me (a secret|a story|some gossip)\b/, /\bgossip\b/, /\bspill\b/, /\b(spill the tea|got tea|any tea|the tea|hot tea)\b/, /\bwhat(?:'s| is) the tea\b/],
    responses: [
      "Ha, I'm not much for gossip — but I'll say the town square's been especially lively lately. 😊",
      "No gossip from me, but there might be something fun brewing for the next town event. Keep an eye out! 🌲",
      "I keep things above board — but I do love that everyone here has a story. 💚",
    ],
  },
  {
    patterns: [/\bweather\b/, /\bforecast\b/, /\btemperature\b/, /\bhot outside\b/, /\bcold outside\b/, /\brain\b/],
    responses: [
      "Classic SoCal — warm, sunny afternoons, but cooler evenings thanks to the hills. Bring a jacket after sunset! 🏙️",
      "Warm and sunny today, cooler up in the hills. In winter we even catch the odd flurry. ☀️❄️",
      "Mountain weather keeps you on your toes — layers are your friend. ☀️🧥",
    ],
  },
  {
    patterns: [/\bdo you (like|love) me\b/, /\bare we friends\b/, /\bam i.*(friend|special)\b/],
    responses: [
      "Of course! Everyone who says hello is a friend around here. 😊💚",
      "Absolutely — you're part of Avelora now. 🌲",
    ],
  },
  {
    patterns: [/\bhowdy\b/, /\byeehaw\b/, /\byee.?haw\b/],
    responses: [
      "Hey there! Welcome — glad you stopped by. 😊",
      "Hello! Always nice to see a friendly face around town. 🌲",
    ],
  },
  {
    patterns: [/\bmeow\b/, /\bwoof\b/, /\bbark\b/, /\bmoo\b/, /\bquack\b/],
    responses: [
      "Ha! We do love our critters around Avelora — plenty of them up in the hills. 🐾",
    ],
  },
  {
    patterns: [/\bsing\b/, /\bcan you sing\b/, /\bsing\b.*(song|something)/],
    responses: [
      "🎵 *Somewhere in the heart of Avelora...* 🎵 Okay, I'll spare you the rest — singing's not my strong suit! 🎤",
      "I'd sing, but I'd empty out every café downtown. Let's not risk it. 😄🎶",
    ],
  },
  // BIRTHDAY
  {
    patterns: [/\bwhen(?:'s| is) my birthday\b/, /\bdo you know my birthday\b/, /\bwhat(?:'s| is) my birthday\b/],
    responses: ['__BIRTHDAY_CHECK__'],
  },
  {
    patterns: [/^lol$/, /^lmao$/, /^haha/, /\bthat(?:'s| is|s) (funny|hilarious)\b/],
    responses: [
      "Glad I could make you smile! 😊",
      "Ha, happy to bring a little fun to your day. 🌲",
      "😄 Anytime!",
    ],
  },
];

export const AVERY_GREETINGS = [
  "Hey there! Avery here — what can I do for you? 🌲",
  "Hello! Welcome — how can I help you today? 😊",
  "Hi! You've reached Avery, Avelora's concierge. What's on your mind? 🌲",
  "Hey! Good to see you. What can I help with? ☕",
  "Hello there! I'm all ears — what do you need? 😊",
  "Hi! Always happy to help around Avelora. What's up? 🌲",
  "Hey! Pull up a chair — what can I do for you? 💚",
  "Hello! What brings you by today? 🌲",
];

export const AVERY_FALLBACK = [
  "I'm not quite sure I caught that! You can ask me about **rules**, **roles**, **events**, **real estate**, or just tell me about your day. 🌲",
  "Hmm, that's a new one! Try asking me about **rules**, **roles**, **events**, **housing**, or **help**. 😊",
  "Sorry, I didn't quite follow. I can help with **rules**, **roles**, **events**, **suggestions**, or **support** — or we can just chat! 🌲",
  "Come again? I can point you toward **rules**, **roles**, **events**, **real estate**, or **the website**. 💚",
  "That one's got me stumped! But ask me about Avelora, or just tell me how your day's going. 😊",
];

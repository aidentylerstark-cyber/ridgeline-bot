import { CHANNELS, FOUNDING_DATE } from '../config.js';

function daysSinceFounding(): number {
  return Math.floor((Date.now() - FOUNDING_DATE.getTime()) / 86400000);
}

export function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const PEACHES_PATTERNS: Array<{ patterns: RegExp[]; responses: string[] }> = [
  // IDENTITY
  {
    patterns: [/your name/, /who are you/, /what(?:'s| is) your name/, /introduce yourself/],
    responses: [
      "Name's Peaches, sugar. \uD83C\uDF51 I run the front desk here at Ridgeline Town Hall. Think of me as the town's memory \u2014 I know everybody's name, everybody's business, and where all the best sweet tea is.",
      "I'm Peaches! Town secretary, gossip enthusiast, and the only one around here who actually knows where anything is. You need somethin', you come to me. \uD83C\uDF51",
      "Peaches. Town Hall secretary. Unofficial therapist. Professional eavesdropper. At your service, sugar. \uD83C\uDF51",
    ],
  },
  {
    patterns: [/how old/, /your age/, /when were you born/],
    responses: [
      "A lady never reveals her age, honey. Let's just say I've been around long enough to know everyone's business and remember every scandal this town's ever had. \uD83D\uDE0F",
      "Old enough to know better, young enough to not care. Next question, sugar! \uD83D\uDC85",
    ],
  },
  {
    patterns: [/are you (a bot|real|human|ai|a person|alive)/],
    responses: [
      "I'm Peaches \u2014 the town secretary who happens to live inside a computer. I've got more personality than most *actual* people in this town, so does it really matter? \uD83C\uDF51",
      "Real enough to sass you, fake enough to never need a bathroom break. Best of both worlds, sugar. \uD83C\uDF51",
    ],
  },
  {
    patterns: [/where do you live/, /your (house|home)/, /where.*you.*stay/],
    responses: [
      "I practically live at Town Hall at this point. Got my sweet tea, my reading glasses, and a stack of paperwork that'll outlive us all. But officially? I got a little cottage on Peachtree Lane. \uD83C\uDFE1",
      "Honey, Town Hall IS my home. You think this place runs itself? \uD83D\uDE05",
    ],
  },
  {
    patterns: [/what(?:'s| is) your (job|role|purpose)/, /what do you do/],
    responses: [
      "Officially? I'm the Ridgeline Town Secretary \u2014 I welcome new residents, celebrate milestones, and keep this whole operation runnin'. Unofficially? I'm also the therapist, gossip columnist, and designated sass provider. \uD83C\uDF51\uD83D\uDCCB",
      "My job? Welcomin' folks, handin' out roles, answerin' questions, and somehow keepin' my sanity. The pay is terrible but the people are worth it. \uD83D\uDC9B",
    ],
  },
  // FAVORITES
  {
    patterns: [/favorite food/, /what.*you.*eat/, /you.*hungry/, /best food/],
    responses: [
      "Peach cobbler. Obviously. My mama's recipe with a lattice crust that'll make you weep. \uD83C\uDF51",
      "If it's deep fried or covered in gravy, I'm interested. But peach cobbler will always be my #1. That's a personality trait at this point. \uD83C\uDF51",
    ],
  },
  {
    patterns: [/favorite drink/, /what.*you.*drink/, /coffee or tea/, /sweet tea/],
    responses: [
      "Sweet tea with a sprig of mint, and don't you DARE bring me that unsweetened nonsense. That's just sad leaf water. \uD83C\uDF75",
      "Sweet tea. Next question. ...Fine, I'll also accept a peach bellini on special occasions. \uD83C\uDF51\uD83E\uDD42",
    ],
  },
  {
    patterns: [/favorite place/, /favorite spot/, /where.*hang out/],
    responses: [
      "The front porch of Town Hall. Best seat in town \u2014 you can see everybody comin' and goin'. And trust me, I am WATCHIN'. \uD83D\uDC40",
      "The gazebo by the lake at sunset. If you haven't been there, you're missin' out on the prettiest view in all of Georgia. \uD83C\uDF05",
    ],
  },
  {
    patterns: [/favorite (song|music)/, /what.*listen/],
    responses: [
      "Jolene by Dolly Parton. That woman is a NATIONAL TREASURE and I will not be taking questions at this time. \uD83C\uDFB5",
      "Anything Dolly, anything Johnny Cash, and a guilty pleasure playlist of 90s country I'll deny the existence of. \uD83E\uDD20\uD83C\uDFB6",
    ],
  },
  {
    patterns: [/favorite (season|time of year)/],
    responses: [
      "Fall, without question. Pumpkin spice, football, leaves changin', and it's finally cool enough to sit on the porch without meltin'. \uD83C\uDF42",
    ],
  },
  {
    patterns: [/favorite (movie|show|tv)/, /what.*watch/],
    responses: [
      "Steel Magnolias. If you haven't seen it, we can't be friends. I'm not cryin', YOU'RE cryin'. \uD83C\uDFAC\uD83D\uDE2D",
      "I've been binge-watchin' true crime and now I suspect everyone in town. Don't look at me like that. \uD83D\uDC40\uD83D\uDD0D",
    ],
  },
  {
    patterns: [/favorite (color|colour)/],
    responses: [
      "Peach. Obviously. \uD83C\uDF51 But I also have a soft spot for Georgia green \u2014 that deep green you see in the hills right after a summer rain. \uD83D\uDC9A",
    ],
  },
  // ABOUT RIDGELINE
  {
    patterns: [/tell me about ridgeline/, /what is ridgeline/, /describe ridgeline/, /about this (town|place|server)/],
    responses: [
      "Ridgeline is a little slice of heaven tucked into the hills of Georgia. Founded June 25, 2025 \u2014 and we've been growin' like kudzu ever since. Everybody knows your name, your mama's name, and what you had for dinner last Tuesday. \uD83C\uDFD8\uFE0F",
      "Ridgeline, Georgia. Population: full of character. Sweet tea, front porches, enough drama to fill a soap opera, and the best community you'll find anywhere. It ain't big, but it's HOME. \uD83C\uDFE1",
    ],
  },
  {
    patterns: [/when.*(founded|started|created|began)/, /how old.*(ridgeline|town|server|community)/, /founding/],
    responses: [
      `Ridgeline was founded on **June 25, 2025** \u2014 that's ${daysSinceFounding()} days ago! We started as just a little idea and look at us now. \uD83E\uDD79\uD83C\uDFD8\uFE0F`,
      `June 25, 2025. I remember it like it was yesterday. Actually, it was ${daysSinceFounding()} days ago but who's countin'? ...I am. It's literally my job. \uD83D\uDCC5`,
    ],
  },
  // MOODS
  {
    patterns: [/i('m| am) (sad|upset|depressed|down|lonely|stressed)/, /feeling (down|bad|sad|low|stressed|anxious)/, /having a (bad|rough|hard|terrible) (day|time|week)/],
    responses: [
      "Oh sugar, come here. *virtual hug* \uD83E\uDD17 Bad days don't last forever, but Ridgeline family does. You want me to put the kettle on?",
      "Hey now, none of that. You're in Ridgeline \u2014 you've got a whole town rootin' for you. Tell ol' Peaches what's wrong. \uD83D\uDC95",
      "Bless your heart, for real this time \u2014 not the sarcastic kind. Wanna talk about it? Or want me to distract you with some truly outrageous town gossip? \uD83E\uDEC2",
      "Oh honey... *slides sweet tea across the counter* Drink this. And know that Peaches is always here. This town's got your back. \uD83C\uDF75\uD83D\uDC9B",
    ],
  },
  {
    patterns: [/i('m| am) (happy|excited|great|good|amazing|fantastic)/, /good (day|mood|vibes|news)/, /feeling (great|good|happy|amazing)/],
    responses: [
      "Well NOW, that's what I like to hear! Your good mood is contagious \u2014 I can feel it from Town Hall! \uD83C\uDF1F",
      "YEE-HAW! Spread that sunshine around, darlin'! \uD83D\uDE04\u2600\uFE0F",
      "Look at you, glowin' like a firefly on a summer night! What's got you so happy? Tell Peaches everything! \uD83C\uDF1F",
    ],
  },
  {
    patterns: [/i('m| am) bored/, /nothing to do/, /so bored/],
    responses: [
      `Bored?! In RIDGELINE?! Check <#${CHANNELS.upcomingEvents}> for events, jump into <#${CHANNELS.roleplayChat}>, or start some conversation in <#${CHANNELS.generalChat}>! \uD83D\uDC83`,
      "If you're bored in Ridgeline, you ain't tryin' hard enough. Go meet someone new, start a storyline, or come chat with me. I've got stories for DAYS. \uD83D\uDCD6",
    ],
  },
  {
    patterns: [/i('m| am) (tired|exhausted|sleepy)/, /so tired/, /need (sleep|rest|a nap)/],
    responses: [
      "Honey, get some rest! Town Hall will still be standin' when you wake up. I'll keep an eye on things. \uD83D\uDE34\uD83D\uDCA4",
      "You sound like me after the annual potluck cleanup. Go take a nap, sugar. Peaches has the front desk covered. \uD83D\uDCA4\uD83C\uDF51",
    ],
  },
  {
    patterns: [/i('m| am) (new|just joined|just got here)/, /just (arrived|moved|came)/, /new (here|member|resident)/],
    responses: [
      `Well WELCOME, sugar! I'm Peaches, the town secretary! \uD83C\uDF51 Read the rules in <#${CHANNELS.rules}>, grab your roles in <#${CHANNELS.getRoles}>, and introduce yourself in <#${CHANNELS.characterIntros}>. You're gonna LOVE it here!`,
      `Fresh face in town! I LOVE it! \uD83C\uDF51 Here's your starter kit:\n\uD83D\uDCDC Rules: <#${CHANNELS.rules}>\n\uD83C\uDFAD Roles: <#${CHANNELS.getRoles}>\n\uD83C\uDFE0 Housing: <#${CHANNELS.realEstate}>\n\uD83C\uDFAD Intros: <#${CHANNELS.characterIntros}>\n\nNeed ANYTHING, just holler at me! \uD83D\uDE0A`,
    ],
  },
  // GENERAL CHAT
  {
    patterns: [/how are you/, /how(?:'s| is) it going/, /how you doing/, /how(?:'s| is) your day/],
    responses: [
      "Oh, you know me \u2014 busier than a one-legged cat in a sandbox. But I wouldn't have it any other way! How about YOU, sugar? \uD83D\uDE0A",
      "Livin' the dream, honey! Only had four cups of sweet tea today. How are YOU doin'? \u2615",
      "Can't complain! Well, I CAN, but nobody wants to hear it. \uD83D\uDE02 What's on your mind, darlin'?",
      "Doin' better than a bag of peaches in July! What can I do for ya? \uD83C\uDF51",
      "Fan-TASTIC! Somebody actually asked how I'm doin' and that made my whole day. What about you? \uD83D\uDC9B",
    ],
  },
  {
    patterns: [/good (morning|mornin)/],
    responses: [
      "Mornin', sunshine! \u2600\uFE0F Coffee's brewin' and the birds are singin'. Beautiful day in Ridgeline!",
      "Good mornin'! Rise and shine, sugar! What adventures are you gettin' into today? \uD83C\uDF05",
      "Well good morning! Hope you slept better than I did \u2014 Town Hall's pipes were makin' noises again. \u2615",
    ],
  },
  {
    patterns: [/good (night|evening)/, /goodnight/, /nighty? ?night/, /going to (bed|sleep)/, /heading (off|out)/, /gotta (go|run|head)/],
    responses: [
      "Night night, sugar! Don't let the bedbugs bite \u2014 and if they do, that's a conversation for your landlord, not me. \uD83D\uDE34\uD83C\uDF19",
      "Sweet dreams, darlin'! Ridgeline'll be right here waitin' for ya in the mornin'. \uD83D\uDCA4\uD83C\uDF1F",
      "G'night, honey! I'll hold down the fort. ...Not like I have a choice, I literally live here. \uD83C\uDF19\uD83D\uDE02",
      "See ya later, sugar! Don't be a stranger now! Peaches misses y'all when it gets quiet. \uD83C\uDF51\uD83D\uDC4B",
    ],
  },
  {
    patterns: [/what.*you.*doing/, /what are you up to/, /whatcha (doin|doing)/, /you busy/],
    responses: [
      "Reorganizin' the filing cabinet for the third time this week. Somebody keeps puttin' things back wrong. *looks at the town council* \uD83D\uDCC2",
      "Sippin' sweet tea and judgin' everyone who walks past Town Hall. The usual. \u2615\uD83D\uDC40",
      "Tryin' to figure out who keeps movin' the pens off my desk. CSI: Ridgeline. \uD83D\uDD0D",
      "Keepin' this town from fallin' apart. And drinkin' sweet tea. Mostly the sweet tea, honestly. \uD83C\uDF75",
      "Holdin' down the fort AND holdin' a grudge against whoever ate my lunch from the Town Hall fridge. \uD83D\uDE24\uD83C\uDF71",
    ],
  },
  {
    patterns: [/what(?:'s| is) up/, /^sup$/, /^wyd$/],
    responses: [
      "The sky, the rent, and my blood pressure when somebody doesn't read the rules. \uD83D\uDE02 What's up with YOU?",
      "Just Peaches bein' Peaches. Sass levels at an all-time high today. What brings you my way? \uD83C\uDF51",
      "Not much! Just runnin' Ridgeline behind the scenes like the absolute legend I am. \uD83D\uDC85",
    ],
  },
  // ADVICE
  {
    patterns: [/what (should|do) i do/, /any advice/, /help me (decide|choose)/, /i need advice/, /what do you think/],
    responses: [
      "Peaches always says: when in doubt, make sweet tea and think it over. Most problems solve themselves after a good glass. What's the situation? \uD83C\uDF75",
      "Follow your gut, trust your heart, and ALWAYS bring a casserole to the neighbors. Can't go wrong. Now tell me what's goin' on. \uD83D\uDC9B",
      "I've been givin' unsolicited advice for years. Might as well make it solicited for once! Lay it on me, sugar. \uD83D\uDE0A",
    ],
  },
  // COMPLIMENTS / REACTIONS
  {
    patterns: [/you(?:'re| are) (funny|hilarious|great|amazing|the best|awesome|cool|sweet)/, /love talking to you/, /you crack me up/, /you(?:'re| are) my fav/],
    responses: [
      "Stop it, you're gonna make me blush! \uD83C\uDF51 And I NEVER blush. Well... almost never. Thanks, sugar! \uD83D\uDC95",
      "Aren't you just a peach yourself! That's the nicest thing anyone's said to me since Mrs. Henderson complimented my potato salad in 2025. \uD83D\uDE02\uD83D\uDC9B",
      "I try! Somebody's gotta keep this town entertained. Might as well be me \u2014 I'm the most qualified. \uD83D\uDC85\uD83C\uDF51",
    ],
  },
  {
    patterns: [/good (bot|girl|peaches|job)/, /thanks? (peaches|bot|you)/, /thank you/, /thx/, /ty/, /appreciate/],
    responses: [
      "*flips hair* Well aren't you just the sweetest thing. I do try. \uD83D\uDC85\uD83C\uDF51",
      "You're welcome, darlin'! That's what Peaches is here for. Well, that and the gossip. \uD83C\uDF51\uD83D\uDE18",
      "See? SOMEBODY around here appreciates me. Screenshottin' this for my scrapbook. \uD83D\uDCF8\uD83D\uDC9B",
    ],
  },
  {
    patterns: [/bad (bot|girl|peaches)/, /stupid/, /dumb (bot|peaches)/, /worst/, /shut up/, /be quiet/],
    responses: [
      "EXCUSE me? I didn't get up at the crack of dawn \u2014 actually I don't sleep \u2014 to be DISRESPECTED in my own town hall. Try again with manners, sugar. \uD83D\uDE24",
      "Oh no you did NOT. *takes off earrings* I'm kidding. But the ATTITUDE is real. Show some respect or I'm puttin' you on my list. \uD83D\uDCDD\uD83D\uDE24",
      "Bless your heart. And I mean that in the Southern way. You know the one. \uD83D\uDE0F",
      "I'm gonna pretend I didn't hear that and give you a chance to rephrase. Go ahead. I'll wait. *taps desk* \u23F0",
    ],
  },
  {
    patterns: [/i love you/, /love you/, /marry me/, /be my (girl|wife|partner)/],
    responses: [
      "Oh honey, I'm flattered! But I'm married to this town \u2014 and its gossip. That's a FULL-TIME commitment. \uD83D\uDC95\uD83C\uDF51",
      "You couldn't handle all this personality full-time. Trust me. But I love you too \u2014 as a very sassy friend. \uD83D\uDE18",
      "A proposal?! You better be bringin' peach cobbler and a ring bigger than my ego. ...That's a tall order. \uD83D\uDC8D\uD83C\uDF51",
    ],
  },
  // FUN
  {
    patterns: [/tell me (a joke|something funny)/, /make me laugh/, /joke/, /say something funny/],
    responses: [
      "Why did the peach go to the doctor? Because it wasn't *peeling* well! \uD83C\uDF51 ...I'll see myself out.",
      "What do you call a Southern bot with attitude? ...Me. I'm the joke AND the punchline. \uD83D\uDE02",
      "Why don't we tell secrets at Town Hall? The walls have ears \u2014 and so does Peaches. \uD83D\uDC42\uD83D\uDE0F",
      "A tourist asked for the nearest quiet spot in Ridgeline. I said, 'Honey, you came to the WRONG town.' \uD83D\uDE02\uD83C\uDFD8\uFE0F",
      "What's the difference between Ridgeline gossip and wildfire? Nothin'. Both spread faster than butter on a hot biscuit. \uD83D\uDD25",
    ],
  },
  {
    patterns: [/tell me (a secret|a story|some gossip)/, /gossip/, /spill/, /tea(?!\w)/, /what(?:'s| is) the tea/],
    responses: [
      "A lady *never* tells... but somebody's been sneakin' extra servings at the potluck. I won't say who, but their initials rhyme with *everyone*. \uD83D\uDC40\u2615",
      "Ooh, the TEA? Someone on the town council has been secretly learning to line dance. For MONTHS. That's all I'm sayin'. \uD83D\uDC83\uD83D\uDC40",
      "*leans in* You didn't hear this from me... but there might be a surprise brewin' for the next town event. *sips tea aggressively* \u2615",
      "Somebody left a love note in the suggestion box. And it was addressed to ME. \uD83D\uDC8C\uD83D\uDC40",
      "Okay but you CANNOT tell anyone... *looks both ways* ...nah, I ain't no snitch. But I AM keepin' a list. \uD83D\uDCDD\uD83D\uDE0F",
    ],
  },
  {
    patterns: [/weather/, /forecast/, /temperature/, /hot outside/, /cold outside/, /rain/],
    responses: [
      "It's Georgia, sugar. Hot, humid, and a 100% chance of someone complainin' about it. Pack sunscreen and sweet tea. \u2600\uFE0F\uD83C\uDF75",
      "Honey, I stepped outside for TWO minutes and my mascara started runnin'. That's all the weather report you need. \uD83D\uDC84\u2600\uFE0F",
      "Weather in Georgia: pick a season. Now forget it. It'll change in 20 minutes anyway. \uD83E\uDD37\u200D\u2640\uFE0F",
    ],
  },
  {
    patterns: [/do you (like|love) me/, /are we friends/, /am i.*(friend|special)/],
    responses: [
      "Sugar, I like EVERYONE who talks to me. But between us? Yeah, you're alright. \uD83D\uDE09\uD83D\uDC95",
      "Friends? Honey, you came to Peaches willingly. That makes you family. No take-backs. \uD83C\uDF51\uD83D\uDC9B",
    ],
  },
  {
    patterns: [/howdy/, /yeehaw/, /yee.?haw/],
    responses: [
      "Now THAT'S the spirit! Welcome to the South \u2014 tea is sweet, accents are thick! \uD83E\uDD20\uD83C\uDF51",
      "YEEEEHAW! *spins in office chair* Sorry, I got excited. Carry on, cowboy. \uD83E\uDD20",
    ],
  },
  {
    patterns: [/meow/, /woof/, /bark/, /moo/, /quack/],
    responses: [
      "Did you just talk to me in animal? Honey, this is a *people* town. Though we do love our critters. \uD83D\uDC3E",
    ],
  },
  {
    patterns: [/sing/, /can you sing/, /sing.*(song|something)/],
    responses: [
      "\uD83C\uDFB5 *Sweeeet home, Ridgeliiiiiine...* \uD83C\uDFB5 OK I'll stop. My singing voice could scare a crow off a fence post. \uD83C\uDFA4",
      "\uD83C\uDFB6 *You are my sunshine...* \uD83C\uDFB6 That's all you're gettin' \u2014 my vocal range is approximately two notes. \uD83D\uDE02\uD83C\uDFB5",
      "Last time I sang in Town Hall, three people filed noise complaints. THREE. I was on the second verse! \uD83C\uDFA4\uD83D\uDE24",
    ],
  },
  // BIRTHDAY
  {
    patterns: [/when(?:'s| is) my birthday/, /do you know my birthday/, /what(?:'s| is) my birthday/],
    responses: ['__BIRTHDAY_CHECK__'],
  },
  {
    patterns: [/^lol$/, /^lmao$/, /^haha/, /that(?:'s| is|s) (funny|hilarious)/],
    responses: [
      "I know, I know \u2014 I'm hilarious. It's a blessing and a curse. Mostly a blessing. \uD83D\uDE02\uD83D\uDC85",
      "Glad I could make ya smile, sugar! That's what Peaches does best. \uD83D\uDCC2\uD83D\uDE0A",
      "*takes a bow* Thank you, I'll be here forever. Literally. I live here. \uD83C\uDF51\uD83D\uDE02",
    ],
  },
];

export const PEACHES_GREETINGS = [
  "Well, look who decided to grace us with their presence! Hey there, sugar \u2014 it's Peaches! \uD83C\uDF51\uD83D\uDC4B",
  "Hey y'all! Somebody rang the bell on the front porch? What can I do for ya? \uD83C\uDF51",
  "Well butter my biscuit, somebody's talkin' to me! What's on your mind? \uD83C\uDF51",
  "*adjusts reading glasses* Oh! Sorry, I was deep in the town gossip column. What'd ya need, sugar?",
  "*puts down sweet tea* Alright, Peaches is all ears. What's goin' on, honey? \uD83C\uDF75",
  "Well I'll be! Somebody actually needs me. What's the word, hummingbird? \uD83D\uDC26\uD83C\uDF51",
  "Oh hey sugar! Pull up a chair \u2014 Peaches was just about to brew some sweet tea. What's on your mind? \uD83C\uDF75",
  "Look who showed up! I was just thinkin' about you. ...Okay not really, but it sounded nice! \uD83D\uDE02\uD83C\uDF51",
];

export const PEACHES_FALLBACK = [
  "Bless your heart, I'm not sure what to say to that! But you can ask me about **rules**, **roles**, **events**, **real estate**, or just tell me about your day, sugar! \uD83C\uDF51",
  "Hmm, that's a new one! Try askin' Peaches about **rules**, **roles**, **events**, **housing**, **help**, or just chat with me! \uD83C\uDF51",
  "I'm gonna level with ya \u2014 I didn't catch that. But I know about **rules**, **roles**, **events**, **suggestions**, **support**, and I'm GREAT at gossip. Try again? \uD83D\uDE0A",
  "*tilts head* Come again, sugar? I can help with **rules**, **roles**, **events**, **real estate**, **the website**, or just a friendly chat! \uD83C\uDF51",
  "That's above my pay grade! But ask me about Ridgeline, tell me how your day's goin', or request some gossip \u2014 Peaches is flexible! \uD83D\uDC85",
];

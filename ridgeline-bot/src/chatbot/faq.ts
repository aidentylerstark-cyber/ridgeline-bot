import { CHANNELS } from '../config.js';

function compileTriggers(triggers: string[]): RegExp[] {
  return triggers.reduce<RegExp[]>((acc, t) => {
    try {
      acc.push(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
    } catch (err) {
      console.error(`[Peaches] Failed to compile FAQ trigger regex for "${t}":`, err);
    }
    return acc;
  }, []);
}

const RAW_FAQ: Array<{ triggers: string[]; response: string }> = [
  {
    triggers: ['rules', 'guidelines', 'community rules'],
    response: `Honey, the rules are posted right over in <#${CHANNELS.rules}>. Give 'em a read \u2014 Peaches doesn't make the rules, but she WILL enforce 'em. \uD83D\uDCDC`,
  },
  {
    triggers: ['get roles', 'how do i get a role', 'pick roles', 'assign role'],
    response: `Head on over to <#${CHANNELS.getRoles}> and pick yourself out some roles, sugar. It's like a buffet \u2014 take what suits ya! \uD83C\uDFAD`,
  },
  {
    triggers: ['events', 'event', 'whats happening', "what's happening", 'schedule'],
    response: `Check <#${CHANNELS.upcomingEvents}> for all the happenings in town! Peaches keeps that board updated herself. Well, mostly. \uD83D\uDCC5`,
  },
  {
    triggers: ['house', 'rent', 'real estate', 'property', 'move in', 'housing', 'apartment'],
    response: `Lookin' for a place to hang your hat? Browse the listings over in <#${CHANNELS.realEstate}>. We got everything from cozy cottages to... well, more cozy cottages. This *is* a small town. \uD83C\uDFE1`,
  },
  {
    triggers: ['help', 'support', 'problem', 'issue', 'ticket'],
    response: `If you need help, head to <#${CHANNELS.ticketPanel}> and click "Open a Ticket"! I'll set you up with a private channel where staff can help you out. \uD83C\uDFAB\uD83C\uDF51`,
  },
  {
    triggers: ['website', 'site', 'web'],
    response: `Our website is at **ridgelinesl.com** \u2014 property listings, community news, the works. It's fancier than a Sunday hat, and that's sayin' somethin'. \uD83C\uDF10`,
  },
  {
    triggers: ['character', 'intro', 'introduce myself'],
    response: `Tell us about yourself over in <#${CHANNELS.characterIntros}>! We love meetin' new faces. Don't be shy now \u2014 Peaches wasn't shy and look how that turned out! \uD83C\uDFAD`,
  },
  {
    triggers: ['roleplay', 'storyline', 'where do i rp'],
    response: `The roleplay happens over in <#${CHANNELS.roleplayChat}>! Jump in when you're ready \u2014 every good story starts with a single "howdy." \uD83D\uDCD6`,
  },
  {
    triggers: ['suggest', 'suggestion', 'idea', 'feedback'],
    response: `Got an idea? Drop it in <#${CHANNELS.suggestions}>. Peaches loves a good suggestion \u2014 even the wild ones. *Especially* the wild ones. \uD83D\uDCA1`,
  },
  {
    triggers: ['announce', 'announcement', 'news'],
    response: `Community updates go in <#${CHANNELS.communityAnnouncements}>. If it's important, it's there. If it's *real* important, Peaches will probably yell about it personally. \uD83D\uDCE2`,
  },
  {
    triggers: ['poll', 'vote'],
    response: `Wanna have your say? Keep an eye on <#${CHANNELS.communityPolls}> \u2014 your vote matters, darlin'. Democracy is alive and well in Ridgeline! \uD83D\uDDF3\uFE0F`,
  },
];

export const FAQ_RESPONSES = RAW_FAQ.map(faq => ({
  ...faq,
  compiledTriggers: compileTriggers(faq.triggers),
}));

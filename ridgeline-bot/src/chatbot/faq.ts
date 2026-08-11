import { CHANNELS } from '../config.js';

function compileTriggers(triggers: string[]): RegExp[] {
  return triggers.reduce<RegExp[]>((acc, t) => {
    try {
      acc.push(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
    } catch (err) {
      console.error(`[Avery] Failed to compile FAQ trigger regex for "${t}":`, err);
    }
    return acc;
  }, []);
}

const RAW_FAQ: Array<{ triggers: string[]; response: string }> = [
  {
    triggers: ['server rules', 'the rules', 'where are the rules', 'read the rules', 'community rules', 'guidelines'],
    response: `The rules are posted right over in <#${CHANNELS.rules}>. Give them a read when you get a chance \u2014 they keep Avelora a friendly place for everyone. \uD83D\uDCDC`,
  },
  {
    triggers: ['get roles', 'how do i get a role', 'pick roles', 'assign role'],
    response: `Head over to <#${CHANNELS.getRoles}> and pick out the roles that suit you. Take whatever fits! \uD83C\uDFAD`,
  },
  {
    triggers: ['upcoming events', 'any events', 'where are events', 'event schedule', 'what events', 'whats happening', "what's happening"],
    response: `Check <#${CHANNELS.upcomingEvents}> for everything happening around town \u2014 I keep that board updated for you. \uD83D\uDCC5`,
  },
  {
    triggers: ['house', 'rent', 'real estate', 'property', 'move in', 'housing', 'apartment'],
    response: `Looking for a place to settle in? Browse the listings over in <#${CHANNELS.realEstate}> \u2014 from downtown lofts to homes up in the hills. \uD83C\uDFE1`,
  },
  {
    triggers: ['need help', 'get help', 'how do i get help', 'where can i get help', 'need support', 'open a ticket', 'create a ticket', 'submit a ticket', 'need a ticket'],
    response: `If you need help, head to <#${CHANNELS.ticketPanel}> and click "Open a Ticket"! I'll set you up with a private channel where staff can help you out. \uD83C\uDFAB\uD83C\uDF32`,
  },
  {
    triggers: ['website', 'the website', 'avelora website', 'the site', 'your site', 'avelora site'],
    response: `We don't have a public website to share just yet \u2014 everything you need is right here in the server! Keep an eye on <#${CHANNELS.communityAnnouncements}> for news. \uD83C\uDF32`,
  },
  {
    triggers: ['character name', 'character intro', 'create a character', 'my character', 'introduce myself'],
    response: `Tell us about yourself over in <#${CHANNELS.characterIntros}>! We love meeting new faces \u2014 don't be shy. \uD83C\uDFAD`,
  },
  {
    triggers: ['roleplay', 'storyline', 'where do i rp'],
    response: `The roleplay happens over in <#${CHANNELS.roleplayChat}>! Jump in when you're ready \u2014 every good story starts somewhere. \uD83D\uDCD6`,
  },
  {
    triggers: ['suggest', 'suggestion', 'idea', 'feedback'],
    response: `Got an idea? Drop it in <#${CHANNELS.suggestions}>. We love a good suggestion \u2014 the community shapes Avelora. \uD83D\uDCA1`,
  },
  {
    triggers: ['announcement', 'announcements', 'latest news', 'any news', 'server news', 'community news'],
    response: `Community updates go in <#${CHANNELS.communityAnnouncements}>. If it's important, you'll find it there. \uD83D\uDCE2`,
  },
  {
    triggers: ['poll', 'vote'],
    response: `Want to have your say? Keep an eye on <#${CHANNELS.communityPolls}> \u2014 your vote matters here in Avelora. \uD83D\uDDF3\uFE0F`,
  },
];

export const FAQ_RESPONSES = RAW_FAQ.map(faq => ({
  ...faq,
  compiledTriggers: compileTriggers(faq.triggers),
}));

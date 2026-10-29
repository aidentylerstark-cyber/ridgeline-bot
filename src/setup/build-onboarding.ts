/**
 * THE FLOOR and the joining flow: Listener, Artist and genre roles; #the-lobby (#merch-shops is setup:merch);
 * Discord's welcome screen; and onboarding ("What do you listen to?" / "What brings you here?").
 * Every role here is created below GTA:W Staff, so only leadership can hand that one out.
 * Safe to re-run — reuses roles and rooms by name and refreshes their descriptions.
 *
 *   npm run setup:onboarding
 */
import { GuildOnboardingMode, GuildOnboardingPromptType, type Guild, type Role } from 'discord.js';
import { withGuild } from './connect.js';
import { ensureCategory, ensureRoom } from './channels.js';
import { brand } from '../config.js';
import { findRoom } from '../rooms.js';

// Named exactly as the site's shelves.
const GENRES = [
  'Hip-Hop', 'R&B & Soul', 'Gospel', 'Funk & Disco', 'Rock', 'Pop',
  'Electronic', 'Latin', 'Country', 'Jazz & Blues', 'Reggae & Dancehall', 'Classical & Score',
];
const GENRE_COLOR = 0x2f5f43;
const ARTIST_COLOR = 0x7fffb2;

const FLOOR = 'THE FLOOR';
// Rooms from earlier versions that should no longer exist.
// #check-in was replaced by the Artist request in #role-request.
const RETIRED_ROOMS = ['bookings-and-business', 'check-in'];
const ROOMS = {
  lobby: {
    name: 'the-lobby',
    topic:
      'The main hangout, in character: Los Santos talking music. Say hello, catch up, share a playlist, a sleeve, the record you ' +
      'can\'t stop playing, or your take on this week\'s Pulsify 10. Any pulsify.world link unfurls as its own card. Anything out of character goes in (( )). 5-second slow mode.',
    slowmode: 5,
  },
};

async function ensureRole(guild: Guild, name: string, options: { color?: number; hoist?: boolean }): Promise<Role> {
  const existing = guild.roles.cache.find((r) => r.name === name);
  if (existing) return existing;
  const role = await guild.roles.create({
    name,
    colors: options.color ? { primaryColor: options.color } : undefined,
    hoist: options.hoist ?? false,
    mentionable: false,
    permissions: [],
    reason: 'Pulsify joining flow',
  });
  console.log(`[Pulsify] Created role ${name}`);
  return role;
}

const room = (guild: Guild, name: string) => findRoom(guild, name);

await withGuild(async (guild) => {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);

  const listener = await ensureRole(guild, 'Listener', { hoist: true });
  const artist = await ensureRole(guild, 'Artist', { color: ARTIST_COLOR, hoist: true });
  // Member list reads Artists, then Listeners: Artist sits directly above Listener, both shown as their own group.
  if (!listener.hoist) await listener.setHoist(true);
  if (artist.position < listener.position) await artist.setPosition(listener.position);
  const genres: Role[] = [];
  for (const name of GENRES) genres.push(await ensureRole(guild, name, { color: GENRE_COLOR }));

  const floor = await ensureCategory(guild, FLOOR);
  const lobby = await ensureRoom(guild, floor, ROOMS.lobby);
  // #merch-shops is the artist storefront forum, built and kept up to date by setup:merch and the bot.
  const merch = room(guild, 'merch-shops');
  for (const name of RETIRED_ROOMS) {
    const old = findRoom(guild, name);
    if (old) {
      await old.delete('No longer needed');
      console.log(`[Pulsify] Removed #${name}`);
    }
  }
  await guild.channels.setPositions([lobby, merch].filter((c) => c !== undefined).map((c, i) => ({ channel: c.id, position: i })));

  const welcome = room(guild, 'welcome');
  const roleRequest = room(guild, 'role-request');
  const rules = room(guild, 'house-rules');

  // Welcome screen: up to five rooms, descriptions are short by Discord's limit.
  await guild.editWelcomeScreen({
    enabled: true,
    description: 'The records this city is making. Artists, listeners, custom merch. Read the rules, then say hello.',
    welcomeChannels: [
      welcome && { channel: welcome.id, description: 'Who we are and where everything is', emoji: '🎧' },
      rules && { channel: rules.id, description: 'The house rules. Read them once', emoji: '📜' },
      { channel: lobby.id, description: 'General chat and music talk', emoji: '💬' },
      roleRequest && { channel: roleRequest.id, description: 'Pick genres, request the Artist role', emoji: '🏷️' },
      merch && { channel: merch.id, description: 'Custom artist merch shops', emoji: '🛍️' },
    ].filter((c): c is NonNullable<typeof c> => Boolean(c)),
  });
  console.log('[Pulsify] Welcome screen on');

  const prompts = [
    {
      title: 'What do you listen to?',
      singleSelect: false,
      required: false,
      inOnboarding: true,
      type: GuildOnboardingPromptType.MultipleChoice,
      options: genres.map((role) => ({ title: role.name, description: `New ${role.name} records, drops and talk`, roles: [role.id], channels: [] })),
    },
    {
      title: 'What brings you here?',
      singleSelect: true,
      required: true,
      inOnboarding: true,
      type: GuildOnboardingPromptType.MultipleChoice,
      options: [
        {
          title: "I'm here to listen",
          description: 'Playlists, the Pulsify 10, what the city is putting out, and artist merch',
          emoji: '🎧',
          roles: [listener.id],
          channels: [lobby.id, merch?.id].filter((id): id is string => Boolean(id)),
        },
        {
          title: 'I put records out',
          description: 'Request the Artist role with your Pulsify page, then open a custom merch shop',
          emoji: '🎤',
          roles: [listener.id],
          channels: [roleRequest?.id, merch?.id, lobby.id].filter((id): id is string => Boolean(id)),
        },
        {
          title: "I'm here on business",
          description: `Book an artist, a placement, a stream ad or a merch shop: call ${brand.phone}`,
          emoji: '💼',
          roles: [listener.id],
          channels: [lobby.id, merch?.id].filter((id): id is string => Boolean(id)),
        },
      ],
    },
  ];
  const defaultChannels = [welcome?.id, rules?.id, room(guild, 'tuning-in')?.id, roleRequest?.id, lobby.id, merch?.id].filter(
    (id): id is string => Boolean(id),
  );

  try {
    await guild.editOnboarding({ prompts, defaultChannels, enabled: true, mode: GuildOnboardingMode.OnboardingDefault });
    console.log('[Pulsify] Onboarding on');
  } catch (err) {
    // Discord won't enable onboarding until there are enough default rooms open for chat.
    console.warn(`[Discord Bot] Onboarding can't go live yet (${(err as Error).message}); saving it switched off.`);
    await guild.editOnboarding({ prompts, defaultChannels, enabled: false, mode: GuildOnboardingMode.OnboardingDefault });
    console.log('[Pulsify] Onboarding saved (off)');
  }
});

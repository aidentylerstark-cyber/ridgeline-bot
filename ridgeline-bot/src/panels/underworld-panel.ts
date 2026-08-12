import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SeparatorSpacingSize,
  type Client,
  type TextChannel,
} from 'discord.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
} from '@discordjs/builders';
import {
  CHANNELS,
  GUILD_ID,
  UNDERWORLD_COLOR,
  UNDERWORLD_HUSTLES,
  UNDERWORLD_ROLE,
} from '../config.js';

/**
 * The Back Alley — entrance to the underworld.
 *
 * Posted to #get-roles rather than inside the underworld category itself: the whole
 * point is that people who do NOT yet have the gate role need to be able to find it.
 */
export async function postUnderworldPanel(client: Client) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.get(CHANNELS.getRoles) as TextChannel | undefined;
  if (!channel) {
    console.log('[Discord Bot] #get-roles channel not found — cannot post the Back Alley panel');
    return;
  }

  const container = new ContainerBuilder().setAccentColor(UNDERWORLD_COLOR);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## 🕶️ The Back Alley\n` +
      `Past the loading docks, down where the streetlight's been out for a month, ` +
      `there's a door with no sign on it.\n\n` +
      `Avelora has a side the chamber of commerce doesn't put in the brochure. ` +
      `Step through and you'll find the people who run it.`
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### Step inside\n` +
      `Takes the **${UNDERWORLD_ROLE}** tag and opens the category. ` +
      `Click again any time to walk back out — nothing here is permanent.\n` +
      `-# This is **in-character crime roleplay**. Read **the-code** before you post.`
    )
  );

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('underworld_join')
        .setLabel('Step Into the Alley')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🕶️'),
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `### Pick your hustle\n` +
      `What do people come to you for? Purely flavour — take as many as fit your character.\n` +
      UNDERWORLD_HUSTLES.map(h => `${h.emoji} **${h.name}** — ${h.blurb}`).join('\n')
    )
  );

  // Discord allows 5 buttons per row; chunk the hustles across rows.
  for (let i = 0; i < UNDERWORLD_HUSTLES.length; i += 4) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const hustle of UNDERWORLD_HUSTLES.slice(i, i + 4)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`underworld_hustle_${hustle.name.replace(/ /g, '_')}`)
          .setLabel(hustle.name)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(hustle.emoji),
      );
    }
    container.addActionRowComponents(row);
  }

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Anonymous board: \`/darkweb post\` · your handle: \`/darkweb handle\` · ` +
      `every post is logged and traceable by staff. Keep it in character.`
    )
  );

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  console.log('[Discord Bot] Back Alley (underworld) panel posted to #get-roles');
}

/**
 * The house rules pinned in #the-code. Kept separate from the entrance panel because
 * this one lives inside the category, where only members who already joined can see it.
 */
export async function postUnderworldCode(client: Client, channel: TextChannel) {
  const container = new ContainerBuilder().setAccentColor(UNDERWORLD_COLOR);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## 📜 The Code\n` +
      `Crime roleplay works right up until somebody forgets it's roleplay. ` +
      `These are the rules that keep it fun.`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**1 — It's a character, not you.** Everything down here is in-character. ` +
      `Never carry a grudge from the alley into general chat or DMs.\n\n` +
      `**2 — Consent runs the scene.** Nobody's character gets robbed, hurt, or ` +
      `killed without their player agreeing to it first. Ask in the open.\n\n` +
      `**3 — No metagaming.** What your character learns in-scene is all they know. ` +
      `Reading it on the board is not the same as your character hearing it.\n\n` +
      `**4 — Server rules still apply.** Everything in the city rules applies here ` +
      `too. In-character is not a shield for harassment, slurs, or targeting a real person.\n\n` +
      `**5 — The board is anonymous, not invisible.** Dark web handles hide you from ` +
      `other members. Staff can trace any post to an account, and every trace is logged.\n\n` +
      `**6 — Keep the crime fictional.** Nothing real: no actual illegal services, ` +
      `no real transactions, no real-world targets. It's a story about a city that doesn't exist.`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# Break the code and you lose the tag. Questions? Open a ticket in <#${CHANNELS.ticketPanel}>.`
    )
  );

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  console.log('[Discord Bot] The Code posted to the underworld category');
}

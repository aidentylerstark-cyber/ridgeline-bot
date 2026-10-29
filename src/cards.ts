import {
  ContainerBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  type APIEmbed,
  type AttachmentBuilder,
  type EmbedBuilder,
  type Guild,
  type MessageCreateOptions,
} from 'discord.js';
import { findRoom } from './rooms.js';

/**
 * Pulsify's one message style: a Components V2 container with an accent bar, a header line,
 * an optional thumbnail, body text, labelled details and a small footer. Everything the bot posts uses it.
 */
export interface CardField {
  name: string;
  value: string;
  /** Short values render on one line ("**Name:** value"); long ones get their own block. */
  inline?: boolean;
}

export interface Card {
  color: number;
  /** Small header line above the title, e.g. "Joined · aiden.zip". */
  eyebrow?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  fields?: CardField[];
  image?: string;
  footer?: string;
  /** Adds the time to the footer line. */
  timestamp?: boolean;
}

const TEXT_LIMIT = 3900;
const clip = (text: string) => (text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT - 1)}…` : text);

export function buildCard(card: Card): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(card.color);
  const head = [card.eyebrow && `-# ${card.eyebrow}`, card.title && `### ${card.title}`, card.description].filter(Boolean).join('\n');

  if (card.thumbnail && head) {
    container.addSectionComponents((s) => s.addTextDisplayComponents((t) => t.setContent(clip(head))).setThumbnailAccessory((th) => th.setURL(card.thumbnail!)));
  } else if (head) {
    container.addTextDisplayComponents((t) => t.setContent(clip(head)));
  }

  const fields = (card.fields ?? []).filter((f) => f.value);
  if (fields.length) {
    if (head) container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    // Consecutive inline fields share one block; each long field gets its own.
    let run: string[] = [];
    const flush = () => {
      if (run.length) container.addTextDisplayComponents((t) => t.setContent(clip(run.join('\n'))));
      run = [];
    };
    for (const f of fields) {
      if (f.inline) {
        run.push(`**${f.name}:** ${f.value}`);
      } else {
        flush();
        container.addTextDisplayComponents((t) => t.setContent(clip(`**${f.name}**\n${f.value}`)));
      }
    }
    flush();
  }

  if (card.image) container.addMediaGalleryComponents((g) => g.addItems((i) => i.setURL(card.image!)));

  const foot = [card.footer, card.timestamp && `<t:${Math.floor(Date.now() / 1000)}:f>`].filter(Boolean).join(' · ');
  if (foot) container.addTextDisplayComponents((t) => t.setContent(`-# ${foot}`));
  return container;
}

/** A ready-to-send message holding one card (plus any files it references). */
export function cardMessage(card: Card, files: AttachmentBuilder[] = []): MessageCreateOptions & { flags: MessageFlags.IsComponentsV2 } {
  const container = buildCard(card);
  // Files that aren't images in the card still need a slot to show up in a V2 message.
  for (const f of files) {
    if (f.name && card.image !== `attachment://${f.name}` && card.thumbnail !== `attachment://${f.name}`) {
      container.addFileComponents((file) => file.setURL(`attachment://${f.name}`));
    }
  }
  return { components: [container], files, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

/** Convert an embed (built with EmbedBuilder) into the card style. */
export function cardFromEmbed(embed: EmbedBuilder | APIEmbed, timestamp = true): Card {
  const data = 'data' in embed ? embed.data : embed;
  return {
    color: data.color ?? 0x00ff66,
    eyebrow: data.author?.name,
    title: data.title,
    description: data.description,
    thumbnail: data.thumbnail?.url,
    image: data.image?.url,
    fields: data.fields?.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
    footer: data.footer?.text,
    timestamp: timestamp || Boolean(data.timestamp),
  };
}

/** Turn `#room-slug` mentions in text into clickable room links when the room exists. */
export function linkRooms(text: string, guild: Guild | null | undefined): string {
  return text.replace(/#([a-z0-9][a-z0-9-]*[a-z0-9])/g, (match, slug: string) => {
    const room = findRoom(guild, slug);
    return room ? `<#${room.id}>` : match;
  });
}

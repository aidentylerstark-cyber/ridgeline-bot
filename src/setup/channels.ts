import {
  ChannelType,
  type CategoryChannel,
  type Guild,
  type OverwriteResolvable,
  type TextChannel,
} from 'discord.js';
import { categoryLabel, findCategory, findRoom, roomLabel } from '../rooms.js';

export interface RoomSpec {
  name: string;
  topic: string;
  /** Seconds between messages per member; 0 = off. */
  slowmode?: number;
  overwrites?: OverwriteResolvable[];
}

/** Find a category by its bare name (labelled or not), create it if missing, and give it its label. */
export async function ensureCategory(guild: Guild, name: string, overwrites?: OverwriteResolvable[]): Promise<CategoryChannel> {
  const label = categoryLabel(name);
  const existing = findCategory(guild, name);
  if (!existing) return guild.channels.create({ name: label, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
  if (existing.name !== label) {
    await existing.setName(label);
    console.log(`[Pulsify] Relabelled ${name} → ${label}`);
  }
  return existing;
}

/**
 * Create the room, or bring an existing one in line with the spec.
 * Discord allows only two name/topic edits per channel every 10 minutes, so fields are only sent when they changed.
 */
export async function ensureRoom(guild: Guild, parent: CategoryChannel, spec: RoomSpec): Promise<TextChannel> {
  const label = roomLabel(spec.name);
  const existing = findRoom(guild, spec.name) as TextChannel | undefined;
  if (!existing) {
    const created = await guild.channels.create({
      name: label,
      type: ChannelType.GuildText,
      parent: parent.id,
      topic: spec.topic,
      rateLimitPerUser: spec.slowmode ?? 0,
      permissionOverwrites: spec.overwrites,
    });
    console.log(`[Pulsify] Created #${label}`);
    return created;
  }

  // Name and topic go in one edit so a relabel costs one of the channel's two edits per 10 minutes.
  const changes: Parameters<TextChannel['edit']>[0] = {};
  if (existing.name !== label) changes.name = label;
  if (existing.topic !== spec.topic) changes.topic = spec.topic;
  if (existing.parentId !== parent.id) changes.parent = parent.id;
  if ((existing.rateLimitPerUser ?? 0) !== (spec.slowmode ?? 0)) changes.rateLimitPerUser = spec.slowmode ?? 0;
  if (Object.keys(changes).length) {
    await existing.edit(changes);
    console.log(`[Pulsify] Updated #${label}: ${Object.keys(changes).join(', ')}`);
  }
  if (spec.overwrites) await existing.permissionOverwrites.set(spec.overwrites);
  return existing;
}

import { PermissionFlagsBits, type PermissionResolvable } from 'discord.js';

const V = PermissionFlagsBits;

/**
 * What every member can do anywhere, unless a room says otherwise: read, talk, react, use voice and
 * apps, and change their nickname (they set their IC name with it). No @everyone pings, no private
 * threads, nothing that manages the server.
 */
export const EVERYONE_PERMISSIONS: PermissionResolvable[] = [
  V.ViewChannel,
  V.ReadMessageHistory,
  V.SendMessages,
  V.SendMessagesInThreads,
  V.CreatePublicThreads,
  V.EmbedLinks,
  V.AttachFiles,
  V.AddReactions,
  V.UseExternalEmojis,
  V.UseExternalStickers,
  V.UseApplicationCommands,
  V.SendVoiceMessages,
  V.SendPolls,
  V.ChangeNickname,
  V.CreateInstantInvite,
  V.Connect,
  V.Speak,
  V.Stream,
  V.UseVAD,
  V.UseSoundboard,
  V.UseEmbeddedActivities,
  V.RequestToSpeak,
];

/** Per the brief: kick, timeout, manage messages and threads, read the audit log. No Manage Roles, so the team roles stay leadership-only. */
export const MODERATOR_PERMISSIONS: PermissionResolvable[] = [
  V.KickMembers,
  V.ModerateMembers,
  V.ManageMessages,
  V.PinMessages,
  V.ManageThreads,
  V.ViewAuditLog,
];

/** CEO, COO and GTA:W Staff. */
export const ADMIN_PERMISSIONS: PermissionResolvable[] = [V.Administrator];

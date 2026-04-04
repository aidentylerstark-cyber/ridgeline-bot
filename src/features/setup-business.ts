import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type OverwriteResolvable,
} from 'discord.js';
import { GUILD_ID, GLOBAL_STAFF_ROLES } from '../config.js';

interface BusinessConfig {
  categoryName: string;
  channels: Array<{ name: string; type: ChannelType.GuildText | ChannelType.GuildVoice }>;
  roles: Array<{ name: string; color: number; hoist: boolean }>;
}

const BUSINESSES: BusinessConfig[] = [
  {
    categoryName: '🐾 PAWSOME VET CLINIC',
    channels: [
      { name: '💬︊vet-staff-chat', type: ChannelType.GuildText },
      { name: '📢︊announcements', type: ChannelType.GuildText },
      { name: '📇︊staff-roster', type: ChannelType.GuildText },
      { name: '📖︊hand-book', type: ChannelType.GuildText },
      { name: '⏰︊time-clock', type: ChannelType.GuildText },
      { name: '📋︊appointments', type: ChannelType.GuildText },
      { name: '🩺︊patient-records', type: ChannelType.GuildText },
      { name: '🚨︊emergency-cases', type: ChannelType.GuildText },
      { name: '📚︊resources', type: ChannelType.GuildText },
      { name: '🔊︊vet-meeting', type: ChannelType.GuildVoice },
    ],
    roles: [
      { name: 'Vet Clinic Director', color: 0x2ECC71, hoist: false },
      { name: 'Vet Clinic Staff', color: 0x3498DB, hoist: false },
    ],
  },
  {
    categoryName: '📮 RIDGELINE POST OFFICE',
    channels: [
      { name: '💬︊postal-staff-chat', type: ChannelType.GuildText },
      { name: '📢︊announcements', type: ChannelType.GuildText },
      { name: '📇︊staff-roster', type: ChannelType.GuildText },
      { name: '📖︊hand-book', type: ChannelType.GuildText },
      { name: '⏰︊time-clock', type: ChannelType.GuildText },
      { name: '📦︊package-tracking', type: ChannelType.GuildText },
      { name: '📬︊mailroom', type: ChannelType.GuildText },
      { name: '📋︊delivery-routes', type: ChannelType.GuildText },
      { name: '📚︊resources', type: ChannelType.GuildText },
      { name: '🔊︊postal-meeting', type: ChannelType.GuildVoice },
    ],
    roles: [
      { name: 'Postmaster', color: 0xE67E22, hoist: false },
      { name: 'Post Office Staff', color: 0xF39C12, hoist: false },
    ],
  },
];

async function createBusiness(guild: Guild, config: BusinessConfig, client: Client): Promise<string> {
  const log: string[] = [];

  // 1. Create roles
  const createdRoleIds: string[] = [];
  for (const roleDef of config.roles) {
    const existing = guild.roles.cache.find(r => r.name === roleDef.name);
    if (existing) {
      createdRoleIds.push(existing.id);
      log.push(`Role **${roleDef.name}** already exists, skipping`);
      continue;
    }
    const role = await guild.roles.create({
      name: roleDef.name,
      color: roleDef.color,
      hoist: roleDef.hoist,
      mentionable: true,
      reason: `Business setup: ${config.categoryName}`,
    });
    createdRoleIds.push(role.id);
    log.push(`Created role **${roleDef.name}**`);
    await new Promise(r => setTimeout(r, 1000));
  }

  // 2. Build permission overwrites for the category
  const overwrites: OverwriteResolvable[] = [
    // Deny everyone
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
  ];

  // Allow business roles
  for (const roleId of createdRoleIds) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    });
  }

  // Allow global staff roles
  for (const roleName of GLOBAL_STAFF_ROLES) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      });
    }
  }

  // Allow bot
  if (client.user) {
    overwrites.push({
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    });
  }

  // 3. Create category
  const category = await guild.channels.create({
    name: config.categoryName,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    reason: `Business setup: ${config.categoryName}`,
  });
  log.push(`Created category **${config.categoryName}**`);
  await new Promise(r => setTimeout(r, 2000));

  // 4. Create channels under the category
  for (const chDef of config.channels) {
    await guild.channels.create({
      name: chDef.name,
      type: chDef.type,
      parent: category.id,
      reason: `Business setup: ${config.categoryName}`,
      // Channels inherit category permissions by default
    });
    log.push(`Created channel **${chDef.name}**`);
    await new Promise(r => setTimeout(r, 1500));
  }

  return log.join('\n');
}

export async function handleSetupBusinesses(client: Client): Promise<string> {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) throw new Error('Guild not found');

  const results: string[] = [];

  for (const config of BUSINESSES) {
    results.push(`\n__${config.categoryName}__`);
    const log = await createBusiness(guild, config, client);
    results.push(log);
  }

  return results.join('\n');
}

import { Client, GatewayIntentBits } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Define role categories
const OWNERSHIP = ['Ridgeline Owner', 'First Lady'];
const MANAGEMENT = ['Community Manager', 'Ridgeline Management', 'Rental Manager', 'Community Moderator'];
const DEPT_HEADS = [
  'Events Director', 'Marketing Director', 'Education Coordinator',
  'Family Services Director', 'Welcome Comittee Chairperson',
  'Department of Public Works Director', 'Ridgeline Sheriff',
  'Ridgeline Fire Chief', 'Criminal Director', 'DOL Director',
  'Ridgeline Chief Justice', 'Ridgeline Medical Director',
  'Southern Safe Haven Director', 'Chief of City Council', 'Department Head',
];
const DEPT_COMMAND = ['Ridgeline Fire Command', 'Ridgeline Sheriff Command'];
const DEPARTMENTS = [
  'Rental Moderator', 'Events Team', 'Marketing Team', 'DOL Staff',
  'Little Dandelion Staff', 'RSCO Forensics', 'Ridgeline Deputy',
  'Ridgeline Fire', 'Department Of Public Works Staff', 'Medical Staff',
  'Superior Court Judge', 'Ridgeline Attorney', 'Superior Court Staff',
  'Council Member', 'Criminal', 'CFS Staff', 'City Council',
  'Welcome committee team', 'News Staff', 'RSCO Dispatcher',
  'Southern Safe Haven Staff', 'Family Services Staff', 'Chief Editor',
  'Weather Forecaster',
];
const COMMUNITY = [
  'Ridgeline Citizen', 'Business Owner', 'Adult', 'Ridgeline Kids',
  'Haven Kids', 'Little Dandelion Parent', 'Little Dandelion Student', 'roleplayers',
];
const NOTIFICATIONS = ['Event Notifications', 'IC Job Notifications', 'Sim Job Notifications'];
const PRONOUNS = ['Ask My Pronouns', 'She/Her', 'He/Him', 'They/Them'];
const SPECIAL = ['Server Booster', 'Birthday'];
const BOTS = ['Dyno', 'Ticket Tool', 'Roleplay Relay', 'Martha', 'Ridgeline Manager'];
const SEPARATORS_AND_BOTS = [
  '━━ ⚜️ Ownership ━━', '━━ 🔑 Management ━━', '━━ 📌 Department Heads ━━',
  '━━ 🚨 Department Command ━━', '━━ 🪪 Departments ━━', '━━ 🏡 Community ━━',
  '━━ 📬 Notifications ━━', '━━ 🏷️ Pronouns ━━', '━━ 🌟 Special ━━', '━━ 🖥️ Bots ━━',
  ...BOTS,
];

// Which department roles map to which head roles
const DEPT_TO_HEAD_MAP = {
  'Events Team': 'Events Director',
  'Marketing Team': 'Marketing Director',
  'DOL Staff': 'DOL Director',
  'Little Dandelion Staff': null, // education
  'RSCO Forensics': 'Ridgeline Sheriff',
  'Ridgeline Deputy': 'Ridgeline Sheriff',
  'RSCO Dispatcher': 'Ridgeline Sheriff',
  'Ridgeline Fire': 'Ridgeline Fire Chief',
  'Department Of Public Works Staff': 'Department of Public Works Director',
  'Medical Staff': 'Ridgeline Medical Director',
  'Superior Court Judge': 'Ridgeline Chief Justice',
  'Ridgeline Attorney': 'Ridgeline Chief Justice',
  'Superior Court Staff': 'Ridgeline Chief Justice',
  'Council Member': 'Chief of City Council',
  'Criminal': 'Criminal Director',
  'CFS Staff': 'Family Services Director',
  'City Council': 'Chief of City Council',
  'Welcome committee team': 'Welcome Comittee Chairperson',
  'News Staff': 'Marketing Director',
  'Southern Safe Haven Staff': 'Southern Safe Haven Director',
  'Family Services Staff': 'Family Services Director',
  'Rental Moderator': 'Rental Manager',
  'Chief Editor': 'Marketing Director',
  'Weather Forecaster': null,
};

const ALL_STAFF = [...OWNERSHIP, ...MANAGEMENT, ...DEPT_HEADS, ...DEPT_COMMAND, ...DEPARTMENTS];

client.once('ready', async () => {
  const guild = client.guilds.cache.first();
  const roles = await guild.roles.fetch();
  const members = await guild.members.fetch();

  const issues = [];

  console.log(`Auditing ${members.size} members...\n`);

  // Sort members: staff first, then by display name
  const sortedMembers = [...members.values()]
    .filter(m => !m.user.bot)
    .sort((a, b) => {
      const aStaff = a.roles.cache.some(r => ALL_STAFF.includes(r.name));
      const bStaff = b.roles.cache.some(r => ALL_STAFF.includes(r.name));
      if (aStaff && !bStaff) return -1;
      if (!aStaff && bStaff) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

  for (const member of sortedMembers) {
    const memberRoles = member.roles.cache
      .filter(r => r.name !== '@everyone' && !r.name.startsWith('━━'))
      .map(r => r.name);

    const hasOwnership = memberRoles.some(r => OWNERSHIP.includes(r));
    const hasManagement = memberRoles.some(r => MANAGEMENT.includes(r));
    const hasDeptHead = memberRoles.some(r => DEPT_HEADS.includes(r));
    const hasDeptCommand = memberRoles.some(r => DEPT_COMMAND.includes(r));
    const hasDepartment = memberRoles.some(r => DEPARTMENTS.includes(r));
    const hasCitizen = memberRoles.includes('Ridgeline Citizen');
    const hasAnyStaff = hasOwnership || hasManagement || hasDeptHead || hasDeptCommand || hasDepartment;

    const memberIssues = [];

    // Rule 1: Everyone (non-bot) should have Ridgeline Citizen
    if (!hasCitizen) {
      memberIssues.push('MISSING: Ridgeline Citizen');
    }

    // Rule 2: Department heads who lead a department should have Department Head tag
    const headRoles = memberRoles.filter(r => DEPT_HEADS.includes(r) && r !== 'Department Head');
    if (headRoles.length > 0 && !memberRoles.includes('Department Head')) {
      memberIssues.push('MISSING: Department Head (has director role but not general tag)');
    }

    // Rule 3: Fire Command should have Ridgeline Fire
    if (memberRoles.includes('Ridgeline Fire Command') && !memberRoles.includes('Ridgeline Fire')) {
      memberIssues.push('MISSING: Ridgeline Fire (has Fire Command)');
    }

    // Rule 4: Sheriff Command should have Ridgeline Deputy or Sheriff
    if (memberRoles.includes('Ridgeline Sheriff Command') &&
        !memberRoles.includes('Ridgeline Deputy') && !memberRoles.includes('Ridgeline Sheriff')) {
      memberIssues.push('MISSING: Ridgeline Deputy or Sheriff (has Sheriff Command)');
    }

    if (memberIssues.length > 0) {
      const roleList = memberRoles
        .filter(r => !SEPARATORS_AND_BOTS.includes(r))
        .join(', ');
      issues.push({
        name: member.displayName,
        id: member.id,
        roles: roleList,
        issues: memberIssues,
      });
    }
  }

  // Print all issues
  console.log('=== MEMBER ISSUES ===\n');

  if (issues.length === 0) {
    console.log('No issues found!');
  } else {
    // Group by issue type
    const missingCitizen = issues.filter(i => i.issues.some(x => x.includes('Ridgeline Citizen')));
    const missingDeptHead = issues.filter(i => i.issues.some(x => x.includes('Department Head')));
    const missingFire = issues.filter(i => i.issues.some(x => x.includes('Ridgeline Fire')));
    const missingSheriff = issues.filter(i => i.issues.some(x => x.includes('Ridgeline Deputy')));

    if (missingCitizen.length > 0) {
      console.log(`\n--- Missing "Ridgeline Citizen" (${missingCitizen.length} members) ---`);
      for (const m of missingCitizen) {
        console.log(`  ${m.name} (${m.id})`);
        console.log(`    Current: ${m.roles}`);
      }
    }

    if (missingDeptHead.length > 0) {
      console.log(`\n--- Missing "Department Head" tag (${missingDeptHead.length} members) ---`);
      for (const m of missingDeptHead) {
        const headRole = m.roles.split(', ').filter(r => DEPT_HEADS.includes(r) && r !== 'Department Head');
        console.log(`  ${m.name} (${m.id}) — has: ${headRole.join(', ')}`);
      }
    }

    if (missingFire.length > 0) {
      console.log(`\n--- Fire Command without Ridgeline Fire (${missingFire.length}) ---`);
      for (const m of missingFire) {
        console.log(`  ${m.name} (${m.id})`);
      }
    }

    if (missingSheriff.length > 0) {
      console.log(`\n--- Sheriff Command without Deputy/Sheriff (${missingSheriff.length}) ---`);
      for (const m of missingSheriff) {
        console.log(`  ${m.name} (${m.id})`);
      }
    }

    // Print JSON summary for the fix script
    console.log('\n\n=== FIX PLAN (JSON) ===');
    const fixPlan = [];
    for (const m of issues) {
      const fixes = [];
      for (const issue of m.issues) {
        if (issue.includes('Ridgeline Citizen')) fixes.push('Ridgeline Citizen');
        if (issue.includes('Department Head (has')) fixes.push('Department Head');
        if (issue.includes('Ridgeline Fire (has')) fixes.push('Ridgeline Fire');
        if (issue.includes('Ridgeline Deputy')) fixes.push('Ridgeline Deputy');
      }
      if (fixes.length > 0) {
        fixPlan.push({ id: m.id, name: m.name, add: fixes });
      }
    }
    console.log(JSON.stringify(fixPlan, null, 2));
  }

  console.log(`\n\nTotal members audited: ${sortedMembers.length}`);
  console.log(`Members with issues: ${issues.length}`);

  client.destroy();
});

client.login(TOKEN);

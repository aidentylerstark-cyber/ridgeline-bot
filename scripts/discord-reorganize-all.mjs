import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = '1096864059946709033';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// All 17 new categories with correct IDs
const CATEGORIES = {
  'events-team': {
    categoryId: '1384607251926614117',
    categoryName: '📅 EVENTS TEAM',
    renames: [
      { id: '1384607416921882776', name: '⏰┊time-card' },
      { id: '1384607734292549662', name: '📅┊event-schedule' },
      { id: '1387994200481599588', name: '💬┊events-chitchat' },
      { id: '1419183112751022210', name: '📋┊welcome-info' },
      { id: '1421164401888858304', name: '📢┊marketing-events' },
      { id: '1423079892118929561', name: '🎧┊djs' },
    ],
  },
  'department-head-center': {
    categoryId: '1383987811941879849',
    categoryName: '🏛️ DEPARTMENT HEAD CENTER',
    renames: [
      { id: '1383987999569743892', name: '💬┊department-head-chatter' },
      { id: '1387522665731850333', name: '🔊┊department-head-vc' },
      { id: '1384206318767837367', name: '📋┊roleplay-planning' },
      { id: '1387564876360061140', name: '📝┊meeting-minutes' },
      { id: '1389862874259652768', name: '📨┊application-channel' },
      { id: '1393819148127043664', name: '⏰┊timeclock-for-departments' },
      { id: '1406535048391426139', name: '📂┊employee-records' },
      { id: '1407387907395948638', name: '📣┊department-announcements' },
      { id: '1408108100992503901', name: '🚫┊terminations' },
      { id: '1420814154746564629', name: '📅┊department-head-events' },
      { id: '1422210468088512643', name: '📋┊leave-records' },
    ],
  },
  'city-council': {
    categoryId: '1424807630752448576',
    categoryName: '🏛️ CITY COUNCIL',
    renames: [
      { id: '1424807936659820664', name: '🔊┊staff-lobby' },
      { id: '1424807984151924776', name: '📂┊filing-cabinet' },
      { id: '1424808159373037709', name: '📅┊events' },
    ],
  },
  'court': {
    categoryId: '1378425880426057828',
    categoryName: '⚖️ WEST RIDGELINE SUPERIOR COURT',
    renames: [
      { id: '1378427782933123113', name: '🏛┊courthouse-lobby' },
      { id: '1378428022478340157', name: '💬┊leadership-chat' },
      { id: '1388293188187324586', name: '🚔┊court-crim-pd' },
      { id: '1378428139910467715', name: '📂┊filing-cabinet' },
      { id: '1378428184902500482', name: '📋┊court-docket' },
      { id: '1378428270755840100', name: '🔒┊jail-and-corrections' },
      { id: '1378428991337398394', name: '⚖┊private-attorneys' },
      { id: '1378430763925635092', name: '⏰┊timecards' },
      { id: '1378438756805251072', name: '📚┊resources' },
      { id: '1395130726726242344', name: '📅┊appointments' },
      { id: '1427856455171575868', name: '🔨┊judges-chambers' },
      { id: '1427856753101635635', name: '📋┊court-appointments' },
      { id: '1428207506378981469', name: '📄┊court-templates' },
      { id: '1436161176902959196', name: '📇┊staff-roster' },
    ],
  },
  'sheriff': {
    categoryId: '1378423521641762977',
    categoryName: '🚔 RIDGELINE COUNTY SHERIFF',
    renames: [
      { id: '1382371697390260356', name: '🔊┊rcsd-training' },
      { id: '1378424294476087317', name: '🔐┊evidence-locker' },
      { id: '1391924968673116232', name: '💬┊chit-chat' },
      { id: '1378423982843498669', name: '📂┊reports-and-records' },
      { id: '1378424625968713881', name: '🚨┊sheriff-dispatch-calls' },
      { id: '1378430815788208260', name: '⏰┊timecards' },
      { id: '1378425330108469421', name: '📋┊patrol-logs' },
      { id: '1378438715340230716', name: '📚┊resources' },
      { id: '1378517390865989652', name: '💬┊command-chat' },
      { id: '1436157176388518022', name: '📇┊staff-roster' },
    ],
  },
  'crime': {
    categoryId: '1382373329679421490',
    categoryName: '🔪 RIDGELINE CRIME',
    renames: [
      { id: '1382373394879746159', name: '💀┊criminals-united' },
      { id: '1382373622286389380', name: '🔊┊criminals-voice' },
    ],
  },
  'fire-department': {
    categoryId: '1378433422032375848',
    categoryName: '🚒 RIDGELINE FIRE DEPARTMENT',
    renames: [
      { id: '1378433491590582282', name: '🏠┊fire-station-lobby' },
      { id: '1443037438451650723', name: '🔊┊training' },
      { id: '1378433545709813810', name: '🚨┊fire-dispatch-calls' },
      { id: '1378433763943518370', name: '📋┊incident-reports' },
      { id: '1378437204770295889', name: '💬┊command-chat' },
      { id: '1378438888552398919', name: '📚┊resources' },
      { id: '1379057983824068718', name: '📂┊filing-cabinet' },
      { id: '1383268246303801386', name: '⏰┊time-cards' },
      { id: '1385064019508854916', name: '🔧┊fire-system-request' },
      { id: '1436135563546726422', name: '📇┊staff-roster' },
    ],
  },
  'medical-center': {
    categoryId: '1378429174825488524',
    categoryName: '🏥 RIDGELINE MEDICAL CENTER',
    renames: [
      { id: '1378430366859395122', name: '🏥┊hospital-lobby' },
      { id: '1410425013928067214', name: '🔊┊medical-voice' },
      { id: '1378430435947708577', name: '🚑┊ems-dispatch' },
      { id: '1379057071533723678', name: '📚┊resources' },
      { id: '1384887969248313466', name: '⏰┊time-clock' },
      { id: '1394414491185319966', name: '📅┊appointments' },
      { id: '1410740511333159003', name: '📇┊staff-roster' },
      { id: '1425295400331513896', name: '🚨┊medical-dispatch' },
      { id: '1442313942159589478', name: '📋┊patient-information' },
    ],
  },
  'emergency-services': {
    categoryId: '1403189150311518359',
    categoryName: '🚨 EMERGENCY SERVICES',
    renames: [
      { id: '1403191576561451059', name: '💬┊chat' },
      { id: '1403189747526139934', name: '🔊┊meeting' },
      { id: '1425297246718787645', name: '🚨┊dispatch-central' },
    ],
  },
  'child-family-services': {
    categoryId: '1378434170438549715',
    categoryName: '👨‍👩‍👧 CHILD & FAMILY SERVICES',
    renames: [
      { id: '1410239917220433950', name: '🔊┊meetings' },
      { id: '1378434274029600798', name: '💬┊chit-chat' },
      { id: '1378434336969195600', name: '🏠┊family-support-center' },
      { id: '1378434462202990713', name: '📋┊case-management' },
      { id: '1378434731405869256', name: '📂┊filing-cabinet' },
      { id: '1378437246880976896', name: '💬┊leadership-chat' },
      { id: '1378438938292912219', name: '📚┊resources' },
      { id: '1379056860556165222', name: '⏰┊time-cards' },
      { id: '1409921168433086534', name: '📋┊information' },
      { id: '1410763763837177916', name: '📝┊daycare-reports' },
      { id: '1423131216684519424', name: '📅┊availability-and-loa' },
      { id: '1423011032921804853', name: '🔊┊meetings-vc' },
      { id: '1436156747436789860', name: '📇┊staff-roster' },
    ],
  },
  'southern-safe-haven': {
    categoryId: '1398283039909347441',
    categoryName: '🏡 SOUTHERN SAFE HAVEN',
    renames: [
      { id: '1424110603793989642', name: '🔊┊storytime' },
      { id: '1424110234300973237', name: '🎉┊activities' },
      { id: '1398283855512862871', name: '🧸┊teddy-talk' },
      { id: '1399128436257325167', name: '📣┊announcements' },
      { id: '1398284037679742976', name: '💬┊staff-lobby' },
      { id: '1399127119120044052', name: '🎨┊creative-corner' },
      { id: '1399127904507400232', name: '📋┊house-rules' },
      { id: '1399128223144743013', name: '📥┊arrivals-departures' },
      { id: '1399128634563891279', name: '⏰┊timecards' },
      { id: '1399129314099986592', name: '🏥┊medical-needs' },
      { id: '1436156897404256397', name: '📇┊staff-roster' },
    ],
  },
  'little-dandelions': {
    categoryId: '1381889288429371525',
    categoryName: '🌼 LITTLE DANDELIONS ACADEMY',
    renames: [
      { id: '1383293730450182144', name: '💬┊staff-chat' },
      { id: '1410698979720564877', name: '🔊┊meeting' },
      { id: '1383293798876184596', name: '⏰┊time-clock' },
      { id: '1420837187959914566', name: '🔊┊class-time' },
      { id: '1409730196998717481', name: '📇┊staff-roster' },
      { id: '1408592740857544734', name: '👨‍👩‍👧┊dandelion-family-chat' },
      { id: '1467601420596412540', name: '📝┊enrollment-section' },
    ],
  },
  'public-works': {
    categoryId: '1382358046143021057',
    categoryName: '🔧 DEPARTMENT OF PUBLIC WORKS',
    renames: [
      { id: '1382369860436234340', name: '💬┊dpw-chat' },
      { id: '1382371240341143716', name: '🔊┊dpw-training' },
      { id: '1382370118906150992', name: '⏰┊timecards' },
      { id: '1382372409977602048', name: '🔧┊work-requests' },
      { id: '1382372809296187442', name: '📚┊resources' },
      { id: '1425296566650015865', name: '🚨┊dpw-radio' },
      { id: '1436157007605272627', name: '📇┊staff-roster' },
    ],
  },
  'licensing': {
    categoryId: '1384914916292563024',
    categoryName: '🏷️ DIVISION OF LICENSING',
    renames: [
      { id: '1384915196040183889', name: '🔊┊meetings' },
      { id: '1384915053047975946', name: '💬┊staff-chat' },
      { id: '1384915131229671465', name: '⏰┊time-clock' },
      { id: '1097030628102381588', name: '🚗┊dmv-business-requests' },
      { id: '1387632626445189150', name: '📋┊business-licensing' },
      { id: '1436162790636388515', name: '📇┊staff-roster' },
    ],
  },
  'staff': {
    categoryId: '1097020460098666516',
    categoryName: '🛡️ STAFF',
    renames: [
      { id: '1099205444603482133', name: '🔊┊staff-chitchat-vc' },
      { id: '1440374620061433897', name: '💬┊staff-chat' },
      { id: '1099200483345834044', name: '🗨️┊off-topic-chat' },
      { id: '1099205522416218133', name: '🔊┊staff-meetings' },
      { id: '1099200633883594772', name: '📅┊loa-and-time-off' },
      { id: '1099201267538071572', name: '📋┊staff-interactions' },
      { id: '1378899536461697104', name: '🖼┊staff-flyers' },
      { id: '1409509942058156032', name: '🔐┊access-interactions' },
    ],
  },
  'community-management': {
    categoryId: '1097020530298736733',
    categoryName: '👑 COMMUNITY MANAGEMENT',
    renames: [
      { id: '1099201850667966516', name: '🚫┊bans' },
      { id: '1099205764633083904', name: '🔊┊staff-interviews' },
      { id: '1097333720945524796', name: '💬┊manager-chitchat' },
      { id: '1099201769151664228', name: '📋┊manager-interactions' },
      { id: '1099205691853508609', name: '🔊┊manager-meeting' },
      { id: '1097025089792376842', name: '📨┊staff-applications' },
      { id: '1383034019247296532', name: '😤┊venting' },
      { id: '1383631647924027494', name: '📅┊appointment-scheduling' },
      { id: '1385402361903710329', name: '📝┊aidens-list' },
      { id: '1402757295326236772', name: '📝┊braelins-list' },
      { id: '1392883241782083604', name: '📌┊important-info' },
      { id: '1428454048272744508', name: '⚖┊braescourt-stuff' },
    ],
  },
  'admin-garbage': {
    categoryId: '1097016498255573062',
    categoryName: '🗑️ ADMINISTRATIVE GARBAGE',
    renames: [
      { id: '1097074531983695942', name: '📣┊archived-staff-announcements' },
      { id: '1378514253274808411', name: '📌┊archived-important-info' },
      { id: '1384608489132789982', name: '📝┊archived-blogger-corner' },
      { id: '1407727010809118790', name: '📸┊archived-holiday-photos' },
      { id: '1455989468812021811', name: '🤖┊archived-ai-photo-space' },
      { id: '1097016643617562654', name: '📋┊dyno-log' },
      { id: '1097058478398373978', name: '🎫┊ticket-logs' },
      { id: '1097053460530217020', name: '📋┊suggestion-logs' },
      { id: '1097016581915156480', name: '🔄┊dyno-updates' },
      { id: '1097039955366269018', name: '📢┊community-updates' },
      { id: '1097051267207008327', name: '🤖┊bot-commands' },
    ],
  },
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.log('Guild not found'); process.exit(1); }

  const channels = await guild.channels.fetch();

  for (const [key, config] of Object.entries(CATEGORIES)) {
    console.log(`=== Reorganizing: ${key} ===`);

    // Rename category if needed
    const category = channels.get(config.categoryId);
    if (category) {
      if (category.name !== config.categoryName) {
        await category.setName(config.categoryName);
        console.log(`[Bot] Category renamed → ${config.categoryName}`);
        await delay(2000);
      }
    } else {
      console.log(`[Bot] Category ${config.categoryId} not found, skipping`);
      continue;
    }

    // Rename channels
    for (const { id, name } of config.renames) {
      const channel = channels.get(id);
      if (!channel) {
        console.log(`[Bot] Channel ${id} not found, skipping`);
        continue;
      }
      if (channel.name !== name) {
        await channel.setName(name);
        console.log(`[Bot] Renamed: #${name}`);
        await delay(2000);
      } else {
        console.log(`[Bot] Already correct: #${name}`);
      }
    }

    console.log(`[Bot] ${key} reorganization complete ✅`);
  }

  console.log('=== ALL 17 CATEGORIES DONE ===');
  client.destroy();
});

client.login(TOKEN);

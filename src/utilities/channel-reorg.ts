import { type Client, type Guild } from 'discord.js';
import { GUILD_ID } from '../config.js';

async function reorganizeCategory(
  guild: Guild,
  label: string,
  categoryId: string | null,
  categoryName: string | null,
  renames: Array<{ id: string; name: string }>
) {
  if (categoryId && categoryName) {
    const category = guild.channels.cache.get(categoryId);
    if (category) {
      try {
        await category.setName(categoryName);
        console.log(`[Bot] Category renamed \u2192 ${categoryName}`);
      } catch (err) {
        console.error(`[Bot] Failed to rename category:`, err);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  for (let i = 0; i < renames.length; i++) {
    const { id, name } = renames[i];
    const channel = guild.channels.cache.get(id);
    if (!channel) {
      console.log(`[Bot] Channel ${id} not found, skipping`);
      continue;
    }
    try {
      const oldName = channel.name;
      await channel.setName(name);
      console.log(`[Bot] Renamed: #${oldName} \u2192 #${name}`);
    } catch (err) {
      console.error(`[Bot] Failed to rename ${id}:`, err);
    }
    if (i < renames.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`[Bot] ${label} reorganization complete \u2705`);
}

const CATEGORY_CONFIGS: Record<string, { categoryId: string | null; categoryName: string | null; renames: Array<{ id: string; name: string }> }> = {
  'in-character': {
    categoryId: '1097020039279956048',
    categoryName: '\uD83C\uDFAD IN CHARACTER',
    renames: [
      { id: '1097063953231794257', name: '\uD83D\uDCDD\u250A character-introductions' },
      { id: '1431078462537469992', name: '\uD83D\uDCDC\u250Abackstory-trails' },
      { id: '1407789493511131186', name: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u250Afind-a-family' },
      { id: '1383978576340324434', name: '\uD83D\uDCAC\u250Aroleplay-chat' },
      { id: '1430568405701885972', name: '\u2728\u250Aroleplay-prompts' },
      { id: '1099195852536426587', name: '\uD83D\uDCCB\u250Aroleplay-planning' },
      { id: '1097065873258324008', name: '\uD83D\uDCE7\u250Aemail-comms' },
      { id: '1427128841301786826', name: '\uD83D\uDCF1\u250Aphone-comms' },
      { id: '1385202533051400244', name: '\uD83D\uDD76\u250Adark-web' },
      { id: '1099196027556331591', name: '\uD83C\uDFEA\u250Abusiness-ads' },
      { id: '1397796734947823778', name: '\uD83C\uDF82\u250Abirthdays' },
      { id: '1400691265431015546', name: '\uD83D\uDCDA\u250Abook-club' },
    ],
  },
  'welcome-center': {
    categoryId: null,
    categoryName: null,
    renames: [
      { id: '1096864061200793662', name: '\uD83D\uDC4B\u250Awelcome' },
      { id: '1097039896209784863', name: '\uD83D\uDCDC\u250Arules' },
      { id: '1097041761999786015', name: '\uD83C\uDFAD\u250Aget-roles' },
      { id: '1388647632792064030', name: '\uD83D\uDCE3\u250Acommunity-announcements' },
      { id: '1383987811698348063', name: '\uD83C\uDFE2\u250Adepartment-announcements' },
      { id: '1097074925455560765', name: '\uD83D\uDCC5\u250Aupcoming-events' },
      { id: '1378183356885504000', name: '\uD83D\uDCA1\u250Asuggestions' },
      { id: '1466235361658404981', name: '\uD83D\uDCCA\u250Acommunity-polls' },
    ],
  },
  'breaking-news': {
    categoryId: '1378417767803523082',
    categoryName: '\uD83D\uDCE2 RIDGELINE NEWS',
    renames: [
      { id: '1378438241040203919', name: '\uD83D\uDCF0\u250Abreaking-news' },
      { id: '1436159073782595615', name: '\uD83D\uDEA8\u250Aridge-alerts' },
      { id: '1379909863382978610', name: '\u26C5\u250Aweather-news' },
      { id: '1387389204014698568', name: '\uD83C\uDFAD\u250Aevents' },
      { id: '1427854249857122337', name: '\u2696\u250Acourt-docket' },
      { id: '1431078026573254656', name: '\uD83D\uDCDC\u250Atown-lore' },
      { id: '1379054771197186099', name: '\uD83C\uDFE1\u250Areal-estate' },
    ],
  },
  'gaming-corner': {
    categoryId: '1420797075599130716',
    categoryName: '\uD83C\uDFAE GAMING CORNER',
    renames: [
      { id: '1420797788073103472', name: '\uD83D\uDCFA\u250Astreaming-1' },
      { id: '1420797925369319507', name: '\uD83C\uDFAE\u250Agaming-chat' },
      { id: '1420798273173585940', name: '\uD83D\uDCFA\u250Astreaming-2' },
      { id: '1420797861741727834', name: '\uD83C\uDF0D\u250Alife-in-sl' },
    ],
  },
  'community-hub': {
    categoryId: null,
    categoryName: null,
    renames: [
      { id: '1097067161882738728', name: '\uD83C\uDF99\u250Acommunity-voice' },
      { id: '1410765263099396246', name: '\uD83D\uDCAC\u250Ageneral-chat' },
      { id: '1397573063997919272', name: '\uD83C\uDF89\u250Acelebration-corner' },
      { id: '1396633643446702240', name: '\uD83D\uDED2\u250Ashopping-corner' },
      { id: '1383231594248015912', name: '\uD83D\uDCF8\u250Aridgeline-photos' },
      { id: '1392647522018918430', name: '\uD83C\uDF0E\u250Asl-photos' },
      { id: '1097067075060633671', name: '\uD83D\uDC3E\u250Apet-tax' },
      { id: '1380939549185675344', name: '\uD83C\uDF54\u250Afood-lovers' },
      { id: '1416803182981419089', name: '\uD83D\uDCD6\u250Aneighborhood-recipe-book' },
      { id: '1097066844621381682', name: '\uD83D\uDD1E\u250Ansfw-chat' },
      { id: '1097066797896843395', name: '\uD83D\uDE02\u250Amemes' },
      { id: '1386147022142312579', name: '\uD83C\uDFB5\u250Amusic' },
      { id: '1430575794635149404', name: '\uD83C\uDFAC\u250Amovies' },
    ],
  },
  'get-support': {
    categoryId: '1097019801685201018',
    categoryName: '\uD83D\uDEDF GET SUPPORT',
    renames: [
      { id: '1097052132949119067', name: '\uD83C\uDFAB\u250Aopen-a-ticket' },
      { id: '1420963602457825330', name: '\uD83D\uDCCA\u250Aridgeline-stats' },
      { id: '1378837861012475915', name: '\uD83D\uDCE6\u250Aobjects-returns' },
      { id: '1392115473792893030', name: '\uD83C\uDFF7\u250Arole-request' },
      { id: '1456373951721767005', name: '\uD83C\uDF10\u250Awebsite-notifications' },
    ],
  },
  'real-estate-team': {
    categoryId: '1378444810477633737',
    categoryName: '\uD83C\uDFE0 REAL ESTATE TEAM',
    renames: [
      { id: '1378444872867905628', name: '\uD83D\uDCD6\u250Ahand-book' },
      { id: '1378445177441620150', name: '\u23F0\u250Aoverdue-notices' },
      { id: '1378445327903883295', name: '\uD83D\uDCD0\u250Aoverprim-notices' },
      { id: '1381867813349752832', name: '\uD83D\uDCCB\u250Awaitlist-applications' },
      { id: '1382865617589108887', name: '\uD83D\uDCDA\u250Aresources' },
      { id: '1388488268085203074', name: '\uD83D\uDEAB\u250Aevictions' },
      { id: '1391508958891741329', name: '\uD83D\uDCAC\u250Achit-chat' },
      { id: '1428810193843654706', name: '\uD83D\uDCB0\u250Adiscount-tracking' },
      { id: '1441482032470429866', name: '\uD83D\uDCF8\u250Arental-photos' },
    ],
  },
  'kiddies-corner': {
    categoryId: '1420037474549371001',
    categoryName: '\uD83E\uDDD2 KIDDIES CORNER',
    renames: [
      { id: '1420038419446370344', name: '\uD83E\uDDF8\u250Akiddies-corner' },
      { id: '1420038947525890109', name: '\uD83C\uDFA8\u250Ashow-and-tell' },
      { id: '1420038572030820474', name: '\uD83C\uDF3C\u250Asuggestions' },
      { id: '1420039135346823238', name: '\uD83D\uDC7E\u250Agame-time' },
    ],
  },
  'welcome-committee': {
    categoryId: '1392578074318475284',
    categoryName: '\uD83D\uDC4B WELCOME COMMITTEE',
    renames: [
      { id: '1392580518146736219', name: '\uD83D\uDCAC\u250Achit-chat' },
      { id: '1392580572068450344', name: '\uD83C\uDD95\u250Anew-residents' },
      { id: '1392580624207974620', name: '\uD83D\uDCCB\u250Awelcome-info' },
      { id: '1436161837195595848', name: '\uD83D\uDCC7\u250Astaff-roster' },
    ],
  },
  'marketing': {
    categoryId: '1384366007451385876',
    categoryName: '\uD83D\uDCE2 MARKETING',
    renames: [
      { id: '1384366209511985254', name: '\uD83D\uDCAC\u250Amarketing-team' },
      { id: '1384366276050288750', name: '\uD83D\uDCDD\u250Amarketing-request' },
      { id: '1384366338209746944', name: '\uD83D\uDDBC\u250Aflyers' },
      { id: '1435729657327652864', name: '\uD83C\uDFAC\u250Avideos' },
      { id: '1435730310880034816', name: '\uD83D\uDCF8\u250Aphotos' },
      { id: '1436161948646506586', name: '\uD83D\uDCC7\u250Astaff-roster' },
      { id: '1470648985286086828', name: '\uD83D\uDCEE\u250Amarketing-resident-request' },
    ],
  },
  'events-team': {
    categoryId: '1384607251926614117',
    categoryName: '\uD83D\uDCC5 EVENTS TEAM',
    renames: [
      { id: '1384607416921882776', name: '\u23F0\u250Atime-card' },
      { id: '1384607734292549662', name: '\uD83D\uDCC5\u250Aevent-schedule' },
      { id: '1387994200481599588', name: '\uD83D\uDCAC\u250Aevents-chitchat' },
      { id: '1419183112751022210', name: '\uD83D\uDCCB\u250Awelcome-info' },
      { id: '1421164401888858304', name: '\uD83D\uDCE2\u250Amarketing-events' },
      { id: '1423079892118929561', name: '\uD83C\uDFA7\u250Adjs' },
    ],
  },
  'department-head-center': {
    categoryId: '1383987811941879849',
    categoryName: '\uD83C\uDFDB\uFE0F DEPARTMENT HEAD CENTER',
    renames: [
      { id: '1383987999569743892', name: '\uD83D\uDCAC\u250Adepartment-head-chatter' },
      { id: '1387522665731850333', name: '\uD83D\uDD0A\u250Adepartment-head-vc' },
      { id: '1384206318767837367', name: '\uD83D\uDCCB\u250Aroleplay-planning' },
      { id: '1387564876360061140', name: '\uD83D\uDCDD\u250Ameeting-minutes' },
      { id: '1389862874259652768', name: '\uD83D\uDCE8\u250Aapplication-channel' },
      { id: '1393819148127043664', name: '\u23F0\u250Atimeclock-for-departments' },
      { id: '1406535048391426139', name: '\uD83D\uDCC2\u250Aemployee-records' },
      { id: '1407387907395948638', name: '\uD83D\uDCE3\u250Adepartment-announcements' },
      { id: '1408108100992503901', name: '\uD83D\uDEAB\u250Aterminations' },
      { id: '1420814154746564629', name: '\uD83D\uDCC5\u250Adepartment-head-events' },
      { id: '1422210468088512643', name: '\uD83D\uDCCB\u250Aleave-records' },
    ],
  },
  'city-council': {
    categoryId: '1424807630752448576',
    categoryName: '\uD83C\uDFDB\uFE0F CITY COUNCIL',
    renames: [
      { id: '1424807936659820664', name: '\uD83D\uDD0A\u250Astaff-lobby' },
      { id: '1424807984151924776', name: '\uD83D\uDCC2\u250Afiling-cabinet' },
      { id: '1424808159373037709', name: '\uD83D\uDCC5\u250Aevents' },
    ],
  },
  'court': {
    categoryId: '1378425880426057828',
    categoryName: '\u2696\uFE0F WEST RIDGELINE SUPERIOR COURT',
    renames: [
      { id: '1378427782933123113', name: '\uD83C\uDFDB\u250Acourthouse-lobby' },
      { id: '1378428022478340157', name: '\uD83D\uDCAC\u250Aleadership-chat' },
      { id: '1388293188187324586', name: '\uD83D\uDE94\u250Acourt-crim-pd' },
      { id: '1378428139910467715', name: '\uD83D\uDCC2\u250Afiling-cabinet' },
      { id: '1378428184902500482', name: '\uD83D\uDCCB\u250Acourt-docket' },
      { id: '1378428270755840100', name: '\uD83D\uDD12\u250Ajail-and-corrections' },
      { id: '1378428991337398394', name: '\u2696\u250Aprivate-attorneys' },
      { id: '1378430763925635092', name: '\u23F0\u250Atimecards' },
      { id: '1378438756805251072', name: '\uD83D\uDCDA\u250Aresources' },
      { id: '1395130726726242344', name: '\uD83D\uDCC5\u250Aappointments' },
      { id: '1427856455171575868', name: '\uD83D\uDD28\u250Ajudges-chambers' },
      { id: '1427856753101635635', name: '\uD83D\uDCCB\u250Acourt-appointments' },
      { id: '1428207506378981469', name: '\uD83D\uDCC4\u250Acourt-templates' },
      { id: '1436161176902959196', name: '\uD83D\uDCC7\u250Astaff-roster' },
    ],
  },
  'sheriff': {
    categoryId: '1378423521641762977',
    categoryName: '\uD83D\uDE94 RIDGELINE COUNTY SHERIFF',
    renames: [
      { id: '1382371697390260356', name: '\uD83D\uDD0A\u250Arcsd-training' },
      { id: '1378424294476087317', name: '\uD83D\uDD10\u250Aevidence-locker' },
      { id: '1391924968673116232', name: '\uD83D\uDCAC\u250Achit-chat' },
      { id: '1378423982843498669', name: '\uD83D\uDCC2\u250Areports-and-records' },
      { id: '1378424625968713881', name: '\uD83D\uDEA8\u250Asheriff-dispatch-calls' },
      { id: '1378430815788208260', name: '\u23F0\u250Atimecards' },
      { id: '1378425330108469421', name: '\uD83D\uDCCB\u250Apatrol-logs' },
      { id: '1378438715340230716', name: '\uD83D\uDCDA\u250Aresources' },
      { id: '1378517390865989652', name: '\uD83D\uDCAC\u250Acommand-chat' },
      { id: '1436157176388518022', name: '\uD83D\uDCC7\u250Astaff-roster' },
    ],
  },
  'crime': {
    categoryId: '1382373329679421490',
    categoryName: '\uD83D\uDD2A RIDGELINE CRIME',
    renames: [
      { id: '1382373394879746159', name: '\uD83D\uDC80\u250Acriminals-united' },
      { id: '1382373622286389380', name: '\uD83D\uDD0A\u250Acriminals-voice' },
    ],
  },
  'fire-department': {
    categoryId: '1378433422032375848',
    categoryName: '\uD83D\uDE92 RIDGELINE FIRE DEPARTMENT',
    renames: [
      { id: '1378433491590582282', name: '\uD83C\uDFE0\u250Afire-station-lobby' },
      { id: '1443037438451650723', name: '\uD83D\uDD0A\u250Atraining' },
      { id: '1378433545709813810', name: '\uD83D\uDEA8\u250Afire-dispatch-calls' },
      { id: '1378433763943518370', name: '\uD83D\uDCCB\u250Aincident-reports' },
      { id: '1378437204770295889', name: '\uD83D\uDCAC\u250Acommand-chat' },
      { id: '1378438888552398919', name: '\uD83D\uDCDA\u250Aresources' },
      { id: '1379057983824068718', name: '\uD83D\uDCC2\u250Afiling-cabinet' },
      { id: '1383268246303801386', name: '\u23F0\u250Atime-cards' },
      { id: '1385064019508854916', name: '\uD83D\uDD27\u250Afire-system-request' },
      { id: '1436135563546726422', name: '\uD83D\uDCC7\u250Astaff-roster' },
    ],
  },
  'medical-center': {
    categoryId: '1378429174825488524',
    categoryName: '\uD83C\uDFE5 RIDGELINE MEDICAL CENTER',
    renames: [
      { id: '1378430366859395122', name: '\uD83C\uDFE5\u250Ahospital-lobby' },
      { id: '1410425013928067214', name: '\uD83D\uDD0A\u250Amedical-voice' },
      { id: '1378430435947708577', name: '\uD83D\uDE91\u250Aems-dispatch' },
      { id: '1379057071533723678', name: '\uD83D\uDCDA\u250Aresources' },
      { id: '1384887969248313466', name: '\u23F0\u250Atime-clock' },
      { id: '1394414491185319966', name: '\uD83D\uDCC5\u250Aappointments' },
      { id: '1410740511333159003', name: '\uD83D\uDCC7\u250Astaff-roster' },
      { id: '1425295400331513896', name: '\uD83D\uDEA8\u250Amedical-dispatch' },
      { id: '1442313942159589478', name: '\uD83D\uDCCB\u250Apatient-information' },
    ],
  },
  'emergency-services': {
    categoryId: '1403189150311518359',
    categoryName: '\uD83D\uDEA8 EMERGENCY SERVICES',
    renames: [
      { id: '1403191576561451059', name: '\uD83D\uDCAC\u250Achat' },
      { id: '1403189747526139934', name: '\uD83D\uDD0A\u250Ameeting' },
      { id: '1425297246718787645', name: '\uD83D\uDEA8\u250Adispatch-central' },
    ],
  },
  'child-family-services': {
    categoryId: '1378434170438549715',
    categoryName: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 CHILD & FAMILY SERVICES',
    renames: [
      { id: '1410239917220433950', name: '\uD83D\uDD0A\u250Ameetings' },
      { id: '1378434274029600798', name: '\uD83D\uDCAC\u250Achit-chat' },
      { id: '1378434336969195600', name: '\uD83C\uDFE0\u250Afamily-support-center' },
      { id: '1378434462202990713', name: '\uD83D\uDCCB\u250Acase-management' },
      { id: '1378434731405869256', name: '\uD83D\uDCC2\u250Afiling-cabinet' },
      { id: '1378437246880976896', name: '\uD83D\uDCAC\u250Aleadership-chat' },
      { id: '1378438938292912219', name: '\uD83D\uDCDA\u250Aresources' },
      { id: '1379056860556165222', name: '\u23F0\u250Atime-cards' },
      { id: '1409921168433086534', name: '\uD83D\uDCCB\u250Ainformation' },
      { id: '1410763763837177916', name: '\uD83D\uDCDD\u250Adaycare-reports' },
      { id: '1423131216684519424', name: '\uD83D\uDCC5\u250Aavailability-and-loa' },
      { id: '1423011032921804853', name: '\uD83D\uDD0A\u250Ameetings-vc' },
      { id: '1436156747436789860', name: '\uD83D\uDCC7\u250Astaff-roster' },
    ],
  },
  'southern-safe-haven': {
    categoryId: '1398283039909347441',
    categoryName: '\uD83C\uDFE1 SOUTHERN SAFE HAVEN',
    renames: [
      { id: '1424110603793989642', name: '\uD83D\uDD0A\u250Astorytime' },
      { id: '1424110234300973237', name: '\uD83C\uDF89\u250Aactivities' },
      { id: '1398283855512862871', name: '\uD83E\uDDF8\u250Ateddy-talk' },
      { id: '1399128436257325167', name: '\uD83D\uDCE3\u250Aannouncements' },
      { id: '1398284037679742976', name: '\uD83D\uDCAC\u250Astaff-lobby' },
      { id: '1399127119120044052', name: '\uD83C\uDFA8\u250Acreative-corner' },
      { id: '1399127904507400232', name: '\uD83D\uDCCB\u250Ahouse-rules' },
      { id: '1399128223144743013', name: '\uD83D\uDCE5\u250Aarrivals-departures' },
      { id: '1399128634563891279', name: '\u23F0\u250Atimecards' },
      { id: '1399129314099986592', name: '\uD83C\uDFE5\u250Amedical-needs' },
      { id: '1436156897404256397', name: '\uD83D\uDCC7\u250Astaff-roster' },
    ],
  },
  'little-dandelions': {
    categoryId: '1381889288429371525',
    categoryName: '\uD83C\uDF3C LITTLE DANDELIONS ACADEMY',
    renames: [
      { id: '1383293730450182144', name: '\uD83D\uDCAC\u250Astaff-chat' },
      { id: '1410698979720564877', name: '\uD83D\uDD0A\u250Ameeting' },
      { id: '1383293798876184596', name: '\u23F0\u250Atime-clock' },
      { id: '1420837187959914566', name: '\uD83D\uDD0A\u250Aclass-time' },
      { id: '1409730196998717481', name: '\uD83D\uDCC7\u250Astaff-roster' },
      { id: '1408592740857544734', name: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u250Adandelion-family-chat' },
      { id: '1467601420596412540', name: '\uD83D\uDCDD\u250Aenrollment-section' },
    ],
  },
  'public-works': {
    categoryId: '1382358046143021057',
    categoryName: '\uD83D\uDD27 DEPARTMENT OF PUBLIC WORKS',
    renames: [
      { id: '1382369860436234340', name: '\uD83D\uDCAC\u250Adpw-chat' },
      { id: '1382371240341143716', name: '\uD83D\uDD0A\u250Adpw-training' },
      { id: '1382370118906150992', name: '\u23F0\u250Atimecards' },
      { id: '1382372409977602048', name: '\uD83D\uDD27\u250Awork-requests' },
      { id: '1382372809296187442', name: '\uD83D\uDCDA\u250Aresources' },
      { id: '1425296566650015865', name: '\uD83D\uDEA8\u250Adpw-radio' },
      { id: '1436157007605272627', name: '\uD83D\uDCC7\u250Astaff-roster' },
    ],
  },
  'licensing': {
    categoryId: '1384914916292563024',
    categoryName: '\uD83C\uDFF7\uFE0F DIVISION OF LICENSING',
    renames: [
      { id: '1384915196040183889', name: '\uD83D\uDD0A\u250Ameetings' },
      { id: '1384915053047975946', name: '\uD83D\uDCAC\u250Astaff-chat' },
      { id: '1384915131229671465', name: '\u23F0\u250Atime-clock' },
      { id: '1097030628102381588', name: '\uD83D\uDE97\u250Admv-business-requests' },
      { id: '1387632626445189150', name: '\uD83D\uDCCB\u250Abusiness-licensing' },
      { id: '1436162790636388515', name: '\uD83D\uDCC7\u250Astaff-roster' },
    ],
  },
  'staff': {
    categoryId: '1097020460098666516',
    categoryName: '\uD83D\uDEE1\uFE0F STAFF',
    renames: [
      { id: '1099205444603482133', name: '\uD83D\uDD0A\u250Astaff-chitchat-vc' },
      { id: '1440374620061433897', name: '\uD83D\uDCAC\u250Astaff-chat' },
      { id: '1099200483345834044', name: '\uD83D\uDDE8\uFE0F\u250Aoff-topic-chat' },
      { id: '1099205522416218133', name: '\uD83D\uDD0A\u250Astaff-meetings' },
      { id: '1099200633883594772', name: '\uD83D\uDCC5\u250Aloa-and-time-off' },
      { id: '1099201267538071572', name: '\uD83D\uDCCB\u250Astaff-interactions' },
      { id: '1378899536461697104', name: '\uD83D\uDDBC\u250Astaff-flyers' },
      { id: '1409509942058156032', name: '\uD83D\uDD10\u250Aaccess-interactions' },
    ],
  },
  'community-management': {
    categoryId: '1097020530298736733',
    categoryName: '\uD83D\uDC51 COMMUNITY MANAGEMENT',
    renames: [
      { id: '1099201850667966516', name: '\uD83D\uDEAB\u250Abans' },
      { id: '1099205764633083904', name: '\uD83D\uDD0A\u250Astaff-interviews' },
      { id: '1097333720945524796', name: '\uD83D\uDCAC\u250Amanager-chitchat' },
      { id: '1099201769151664228', name: '\uD83D\uDCCB\u250Amanager-interactions' },
      { id: '1099205691853508609', name: '\uD83D\uDD0A\u250Amanager-meeting' },
      { id: '1097025089792376842', name: '\uD83D\uDCE8\u250Astaff-applications' },
      { id: '1383034019247296532', name: '\uD83D\uDE24\u250Aventing' },
      { id: '1383631647924027494', name: '\uD83D\uDCC5\u250Aappointment-scheduling' },
      { id: '1385402361903710329', name: '\uD83D\uDCDD\u250Aaidens-list' },
      { id: '1402757295326236772', name: '\uD83D\uDCDD\u250Abraelins-list' },
      { id: '1392883241782083604', name: '\uD83D\uDCCC\u250Aimportant-info' },
      { id: '1428454048272744508', name: '\u2696\u250Abraescourt-stuff' },
    ],
  },
  'admin-garbage': {
    categoryId: '1097016498255573062',
    categoryName: '\uD83D\uDDD1\uFE0F ADMINISTRATIVE GARBAGE',
    renames: [
      { id: '1097074531983695942', name: '\uD83D\uDCE3\u250Aarchived-staff-announcements' },
      { id: '1378514253274808411', name: '\uD83D\uDCCC\u250Aarchived-important-info' },
      { id: '1384608489132789982', name: '\uD83D\uDCDD\u250Aarchived-blogger-corner' },
      { id: '1407727010809118790', name: '\uD83D\uDCF8\u250Aarchived-holiday-photos' },
      { id: '1455989468812021811', name: '\uD83E\uDD16\u250Aarchived-ai-photo-space' },
      { id: '1097016643617562654', name: '\uD83D\uDCCB\u250Adyno-log' },
      { id: '1097058478398373978', name: '\uD83C\uDFAB\u250Aticket-logs' },
      { id: '1097053460530217020', name: '\uD83D\uDCCB\u250Asuggestion-logs' },
      { id: '1097016581915156480', name: '\uD83D\uDD04\u250Adyno-updates' },
      { id: '1097039955366269018', name: '\uD83D\uDCE2\u250Acommunity-updates' },
      { id: '1097051267207008327', name: '\uD83E\uDD16\u250Abot-commands' },
    ],
  },
};

export async function reorganizeCategoryByKey(client: Client, categoryKey: string) {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) { console.log('[Bot] Guild not found'); return; }

  const config = CATEGORY_CONFIGS[categoryKey];
  if (!config) {
    console.log(`[Bot] Unknown category key: ${categoryKey}`);
    return;
  }

  await reorganizeCategory(guild, categoryKey, config.categoryId, config.categoryName, config.renames);
}

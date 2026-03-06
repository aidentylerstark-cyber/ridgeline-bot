// ═══════════════════════════════════════════════════════════════════════
//  Gridtech — Parcel Media Manager v1.0
//
//  A powerful media stream controller for Second Life parcels.
//  Manage URL presets, access control, scheduled streaming,
//  volume sync, and now-playing display — all from touch menus
//  or chat commands.
//
//  Features:
//    - 24 named media presets across 3 categories
//    - Role-based access (Owner / Manager / DJ)
//    - Parcel-level media URL control
//    - Scheduled auto-switching (day + hour)
//    - Volume synchronization across parcel visitors
//    - Now-playing floating text display
//    - Stream history with quick-replay
//
//  Place in a prim on your parcel. Touch to open menus.
//  Chat commands on /8. Type /8 help for command list.
//
//  (c) 2026 Gridtech. All rights reserved.
// ═══════════════════════════════════════════════════════════════════════

// ─── Configuration ─────────────────────────────────────────────────
integer CHAT_CHANNEL    = 8;
integer SYNC_CHANNEL    = -4827391;
float   MENU_TIMEOUT    = 60.0;
string  VERSION         = "1.0";
string  DATA_PREFIX     = "gmm_";
integer MAX_PRESETS     = 8;
integer MAX_MANAGERS    = 8;
integer MAX_DJS         = 12;
integer MAX_HISTORY     = 5;

// ─── Role Constants ────────────────────────────────────────────────
integer ROLE_NONE    = 0;
integer ROLE_DJ      = 1;
integer ROLE_MANAGER = 2;
integer ROLE_OWNER   = 3;

// ─── Menu State Constants ──────────────────────────────────────────
integer MS_NONE      = 0;
integer MS_MAIN      = 1;
integer MS_PRESETS    = 2;
integer MS_PRESET_CAT = 3;
integer MS_PRESET_PICK = 4;
integer MS_PRESET_ADD = 5;
integer MS_PRESET_NAME = 6;
integer MS_PRESET_URL = 7;
integer MS_PRESET_DEL = 8;
integer MS_ACCESS     = 10;
integer MS_ADD_DJ     = 11;
integer MS_ADD_MGR    = 12;
integer MS_REMOVE_STAFF = 13;
integer MS_SCHEDULE   = 20;
integer MS_SCHED_DAY  = 21;
integer MS_SCHED_HOUR = 22;
integer MS_SCHED_PICK = 23;
integer MS_SCHED_VIEW = 24;
integer MS_VOLUME     = 30;
integer MS_SETTINGS   = 40;
integer MS_SET_URL    = 41;
integer MS_HISTORY    = 50;
integer MS_CONFIRM    = 60;

// ─── Preset Categories ────────────────────────────────────────────
string CAT_MUSIC   = "Music";
string CAT_TALK    = "Talk";
string CAT_AMBIENT = "Ambient";

// ─── Preset Storage ───────────────────────────────────────────────
// Each category stores pairs: [name, url, name, url, ...]
list gPresetsMusic   = [];
list gPresetsTalk    = [];
list gPresetsAmbient = [];

// ─── Access Control ───────────────────────────────────────────────
// Managers: [uuid, name, uuid, name, ...]
// DJs: [uuid, name, uuid, name, ...]
list gManagers = [];
list gDJs      = [];

// ─── Schedule Storage ─────────────────────────────────────────────
// Each entry: [dayOfWeek, hour, presetCategory, presetName]
// dayOfWeek: 0=Sun..6=Sat, 7=Daily
list gSchedule = [];

// ─── Current State ────────────────────────────────────────────────
string  gCurrentURL     = "";
string  gCurrentName    = "";
string  gSetBy          = "";
integer gShowNowPlaying = TRUE;
integer gAutoPlay       = TRUE;
integer gVolume         = 50;

// ─── History ──────────────────────────────────────────────────────
// Pairs: [name, url, ...]
list gHistory = [];

// ─── Menu / Listener State ────────────────────────────────────────
integer gMenuChannel;
integer gMenuHandle;
integer gChatHandle;
integer gMenuState;
key     gMenuUser;
integer gMenuPage;
string  gTempCategory;
string  gTempName;
string  gTempURL;
integer gTempDay;
integer gTempHour;
integer gConfirmAction;

// Confirm action constants
integer CONFIRM_CLEAR_PRESETS  = 1;
integer CONFIRM_CLEAR_SCHEDULE = 2;
integer CONFIRM_RESET_ALL      = 3;

// ═══════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

string truncate(string text, integer maxLen)
{
    if (llStringLength(text) > maxLen)
    {
        return llGetSubString(text, 0, maxLen - 4) + "...";
    }
    return text;
}

string getDisplayName(key avatarId)
{
    string name = llGetDisplayName(avatarId);
    if (name == "" || name == "???")
    {
        name = llKey2Name(avatarId);
    }
    if (name == "")
    {
        name = "Unknown";
    }
    return name;
}

string dayName(integer day)
{
    list days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Daily"];
    if (day >= 0 && day <= 7)
    {
        return llList2String(days, day);
    }
    return "???";
}

string hourLabel(integer hour)
{
    if (hour == 0)  return "12 AM";
    if (hour < 12)  return (string)hour + " AM";
    if (hour == 12) return "12 PM";
    return (string)(hour - 12) + " PM";
}

integer getCurrentDayOfWeek()
{
    // SL time is UTC/PST — llGetUnixTime gives Unix epoch
    // Unix epoch day 0 (Jan 1, 1970) was a Thursday (day 4)
    integer daysSinceEpoch = llGetUnixTime() / 86400;
    return (daysSinceEpoch + 4) % 7;
}

integer getCurrentHour()
{
    // Returns current SL hour (0-23) in SLT (Pacific)
    string timestamp = llGetTimestamp();
    return (integer)llGetSubString(timestamp, 11, 12);
}

// ═══════════════════════════════════════════════════════════════════════
//  ROLE / ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════

integer getUserRole(key userId)
{
    // Owner always has full access
    if (userId == llGetOwner())
    {
        return ROLE_OWNER;
    }

    // Check parcel ownership
    list parcelInfo = llGetParcelDetails(llGetPos(),
        [PARCEL_DETAILS_OWNER, PARCEL_DETAILS_GROUP]);
    if (userId == llList2Key(parcelInfo, 0))
    {
        return ROLE_OWNER;
    }

    // Check manager list
    string userStr = (string)userId;
    integer i;
    integer count = llGetListLength(gManagers);
    for (i = 0; i < count; i += 2)
    {
        if (llList2String(gManagers, i) == userStr)
        {
            return ROLE_MANAGER;
        }
    }

    // Check DJ list
    count = llGetListLength(gDJs);
    for (i = 0; i < count; i += 2)
    {
        if (llList2String(gDJs, i) == userStr)
        {
            return ROLE_DJ;
        }
    }

    return ROLE_NONE;
}

string roleName(integer role)
{
    if (role == ROLE_OWNER)   return "Owner";
    if (role == ROLE_MANAGER) return "Manager";
    if (role == ROLE_DJ)      return "DJ";
    return "None";
}

// ═══════════════════════════════════════════════════════════════════════
//  PRESET MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

list getPresetList(string category)
{
    if (category == CAT_MUSIC)   return gPresetsMusic;
    if (category == CAT_TALK)    return gPresetsTalk;
    if (category == CAT_AMBIENT) return gPresetsAmbient;
    return [];
}

setPresetList(string category, list presets)
{
    if (category == CAT_MUSIC)        gPresetsMusic   = presets;
    else if (category == CAT_TALK)    gPresetsTalk    = presets;
    else if (category == CAT_AMBIENT) gPresetsAmbient = presets;
}

integer addPreset(string category, string name, string url)
{
    list presets = getPresetList(category);
    if (llGetListLength(presets) / 2 >= MAX_PRESETS)
    {
        return FALSE;
    }
    // Check for duplicate name
    integer i;
    integer count = llGetListLength(presets);
    for (i = 0; i < count; i += 2)
    {
        if (llToLower(llList2String(presets, i)) == llToLower(name))
        {
            // Update existing
            presets = llListReplaceList(presets, [name, url], i, i + 1);
            setPresetList(category, presets);
            return TRUE;
        }
    }
    presets += [name, url];
    setPresetList(category, presets);
    return TRUE;
}

integer removePreset(string category, string name)
{
    list presets = getPresetList(category);
    integer i;
    integer count = llGetListLength(presets);
    for (i = 0; i < count; i += 2)
    {
        if (llList2String(presets, i) == name ||
            truncate(llList2String(presets, i), 24) == name)
        {
            presets = llDeleteSubList(presets, i, i + 1);
            setPresetList(category, presets);
            return TRUE;
        }
    }
    return FALSE;
}

string getPresetURL(string category, string name)
{
    list presets = getPresetList(category);
    integer i;
    integer count = llGetListLength(presets);
    for (i = 0; i < count; i += 2)
    {
        if (llList2String(presets, i) == name ||
            truncate(llList2String(presets, i), 24) == name)
        {
            return llList2String(presets, i + 1);
        }
    }
    return "";
}

// ═══════════════════════════════════════════════════════════════════════
//  PARCEL MEDIA CONTROL
// ═══════════════════════════════════════════════════════════════════════

setParcelMedia(string url, string name, key setById)
{
    if (url == "")
    {
        return;
    }

    // Add to history before changing
    if (gCurrentURL != "" && gCurrentURL != url)
    {
        addToHistory(gCurrentName, gCurrentURL);
    }

    gCurrentURL  = url;
    gCurrentName = name;
    gSetBy       = getDisplayName(setById);

    // Set the parcel media URL
    llSetParcelMusicURL(url);

    // Update floating text display
    updateNowPlaying();

    // Broadcast volume sync
    if (gAutoPlay)
    {
        syncVolume();
    }

    llRegionSayTo(setById, 0,
        "Stream set: " + name + "\n" + truncate(url, 60));
}

clearParcelMedia(key clearedById)
{
    if (gCurrentURL != "")
    {
        addToHistory(gCurrentName, gCurrentURL);
    }

    gCurrentURL  = "";
    gCurrentName = "";
    gSetBy       = getDisplayName(clearedById);

    llSetParcelMusicURL("");
    updateNowPlaying();

    llRegionSayTo(clearedById, 0, "Stream cleared.");
}

// ═══════════════════════════════════════════════════════════════════════
//  NOW PLAYING DISPLAY
// ═══════════════════════════════════════════════════════════════════════

updateNowPlaying()
{
    if (!gShowNowPlaying)
    {
        llSetText("", ZERO_VECTOR, 0.0);
        return;
    }

    if (gCurrentURL == "")
    {
        llSetText("[ No Stream Active ]\nTouch to manage",
            <0.5, 0.5, 0.5>, 0.7);
        return;
    }

    string display = "♪ NOW PLAYING ♪\n"
        + gCurrentName + "\n"
        + "Set by: " + gSetBy + "\n"
        + "Vol: " + (string)gVolume + "%";

    llSetText(display, <0.3, 0.8, 1.0>, 1.0);
}

// ═══════════════════════════════════════════════════════════════════════
//  VOLUME SYNCHRONIZATION
// ═══════════════════════════════════════════════════════════════════════

syncVolume()
{
    // Broadcast volume level to all listeners on the sync channel
    // Avatars with a companion HUD can pick this up
    llRegionSay(SYNC_CHANNEL,
        "GMMS_VOL|" + (string)gVolume + "|" + gCurrentName);
}

// ═══════════════════════════════════════════════════════════════════════
//  STREAM HISTORY
// ═══════════════════════════════════════════════════════════════════════

addToHistory(string name, string url)
{
    if (name == "" || url == "")
    {
        return;
    }

    // Remove if already in history
    integer i;
    integer count = llGetListLength(gHistory);
    for (i = 0; i < count; i += 2)
    {
        if (llList2String(gHistory, i + 1) == url)
        {
            gHistory = llDeleteSubList(gHistory, i, i + 1);
            count -= 2;
            break;
        }
    }

    // Add to front
    gHistory = [name, url] + gHistory;

    // Trim to max
    if (llGetListLength(gHistory) > MAX_HISTORY * 2)
    {
        gHistory = llList2List(gHistory, 0, MAX_HISTORY * 2 - 1);
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  SCHEDULE ENGINE
// ═══════════════════════════════════════════════════════════════════════

addScheduleEntry(integer day, integer hour, string category, string name)
{
    // Remove existing entry for same day+hour
    removeScheduleEntry(day, hour);

    gSchedule += [day, hour, category, name];
}

removeScheduleEntry(integer day, integer hour)
{
    integer i;
    integer count = llGetListLength(gSchedule);
    for (i = 0; i < count; i += 4)
    {
        if (llList2Integer(gSchedule, i) == day &&
            llList2Integer(gSchedule, i + 1) == hour)
        {
            gSchedule = llDeleteSubList(gSchedule, i, i + 3);
            return;
        }
    }
}

checkSchedule()
{
    integer currentDay  = getCurrentDayOfWeek();
    integer currentHour = getCurrentHour();

    integer i;
    integer count = llGetListLength(gSchedule);
    for (i = 0; i < count; i += 4)
    {
        integer schedDay  = llList2Integer(gSchedule, i);
        integer schedHour = llList2Integer(gSchedule, i + 1);

        // Match specific day or "Daily" (7)
        if ((schedDay == currentDay || schedDay == 7) &&
            schedHour == currentHour)
        {
            string cat  = llList2String(gSchedule, i + 2);
            string name = llList2String(gSchedule, i + 3);
            string url  = getPresetURL(cat, name);

            if (url != "" && url != gCurrentURL)
            {
                gCurrentURL  = url;
                gCurrentName = name;
                gSetBy       = "Schedule";

                llSetParcelMusicURL(url);
                updateNowPlaying();

                if (gAutoPlay)
                {
                    syncVolume();
                }

                llSay(0, "Scheduled stream: " + name);
            }
            return;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  PERSISTENCE — Linkset Data
// ═══════════════════════════════════════════════════════════════════════

savePresetCategory(string category, list presets)
{
    string key_prefix = DATA_PREFIX + llToLower(
        llGetSubString(category, 0, 2));
    integer count = llGetListLength(presets) / 2;
    llLinksetDataWrite(key_prefix + "_c", (string)count);

    integer i;
    for (i = 0; i < count; i++)
    {
        string entry = llList2String(presets, i * 2)
            + "|" + llList2String(presets, i * 2 + 1);
        llLinksetDataWrite(key_prefix + "_" + (string)i, entry);
    }
    // Clean up old entries
    for (i = count; i < count + 3; i++)
    {
        llLinksetDataDelete(key_prefix + "_" + (string)i);
    }
}

list loadPresetCategory(string category)
{
    string key_prefix = DATA_PREFIX + llToLower(
        llGetSubString(category, 0, 2));
    integer count = (integer)llLinksetDataRead(key_prefix + "_c");
    list result = [];

    integer i;
    for (i = 0; i < count; i++)
    {
        string entry = llLinksetDataRead(key_prefix + "_" + (string)i);
        integer sep = llSubStringIndex(entry, "|");
        if (sep > 0)
        {
            result += [llGetSubString(entry, 0, sep - 1),
                       llGetSubString(entry, sep + 1, -1)];
        }
    }
    return result;
}

saveStaffList(string listType, list staff)
{
    string key_prefix = DATA_PREFIX + listType;
    integer count = llGetListLength(staff) / 2;
    llLinksetDataWrite(key_prefix + "_c", (string)count);

    integer i;
    for (i = 0; i < count; i++)
    {
        string entry = llList2String(staff, i * 2)
            + "|" + llList2String(staff, i * 2 + 1);
        llLinksetDataWrite(key_prefix + "_" + (string)i, entry);
    }
    for (i = count; i < count + 3; i++)
    {
        llLinksetDataDelete(key_prefix + "_" + (string)i);
    }
}

list loadStaffList(string listType)
{
    string key_prefix = DATA_PREFIX + listType;
    integer count = (integer)llLinksetDataRead(key_prefix + "_c");
    list result = [];

    integer i;
    for (i = 0; i < count; i++)
    {
        string entry = llLinksetDataRead(key_prefix + "_" + (string)i);
        integer sep = llSubStringIndex(entry, "|");
        if (sep > 0)
        {
            result += [llGetSubString(entry, 0, sep - 1),
                       llGetSubString(entry, sep + 1, -1)];
        }
    }
    return result;
}

saveSchedule()
{
    integer count = llGetListLength(gSchedule) / 4;
    llLinksetDataWrite(DATA_PREFIX + "sch_c", (string)count);

    integer i;
    for (i = 0; i < count; i++)
    {
        string entry = (string)llList2Integer(gSchedule, i * 4)
            + "|" + (string)llList2Integer(gSchedule, i * 4 + 1)
            + "|" + llList2String(gSchedule, i * 4 + 2)
            + "|" + llList2String(gSchedule, i * 4 + 3);
        llLinksetDataWrite(DATA_PREFIX + "sch_" + (string)i, entry);
    }
    for (i = count; i < count + 3; i++)
    {
        llLinksetDataDelete(DATA_PREFIX + "sch_" + (string)i);
    }
}

loadSchedule()
{
    gSchedule = [];
    integer count = (integer)llLinksetDataRead(DATA_PREFIX + "sch_c");

    integer i;
    for (i = 0; i < count; i++)
    {
        string entry = llLinksetDataRead(DATA_PREFIX + "sch_" + (string)i);
        list parts = llParseString2List(entry, ["|"], []);
        if (llGetListLength(parts) >= 4)
        {
            gSchedule += [
                (integer)llList2String(parts, 0),
                (integer)llList2String(parts, 1),
                llList2String(parts, 2),
                llList2String(parts, 3)
            ];
        }
    }
}

saveSettings()
{
    llLinksetDataWrite(DATA_PREFIX + "saved", "1");
    llLinksetDataWrite(DATA_PREFIX + "show_np",
        (string)gShowNowPlaying);
    llLinksetDataWrite(DATA_PREFIX + "auto_play",
        (string)gAutoPlay);
    llLinksetDataWrite(DATA_PREFIX + "volume",
        (string)gVolume);

    savePresetCategory(CAT_MUSIC,   gPresetsMusic);
    savePresetCategory(CAT_TALK,    gPresetsTalk);
    savePresetCategory(CAT_AMBIENT, gPresetsAmbient);
    saveStaffList("mgr", gManagers);
    saveStaffList("dj",  gDJs);
    saveSchedule();
}

loadSettings()
{
    string saved = llLinksetDataRead(DATA_PREFIX + "saved");
    if (saved != "1")
    {
        // First run — use defaults
        return;
    }

    string val;

    val = llLinksetDataRead(DATA_PREFIX + "show_np");
    if (val != "") gShowNowPlaying = (integer)val;

    val = llLinksetDataRead(DATA_PREFIX + "auto_play");
    if (val != "") gAutoPlay = (integer)val;

    val = llLinksetDataRead(DATA_PREFIX + "volume");
    if (val != "") gVolume = (integer)val;

    gPresetsMusic   = loadPresetCategory(CAT_MUSIC);
    gPresetsTalk    = loadPresetCategory(CAT_TALK);
    gPresetsAmbient = loadPresetCategory(CAT_AMBIENT);
    gManagers       = loadStaffList("mgr");
    gDJs            = loadStaffList("dj");
    loadSchedule();
}

// ═══════════════════════════════════════════════════════════════════════
//  MENU SYSTEM
// ═══════════════════════════════════════════════════════════════════════

openListener()
{
    if (gMenuHandle != 0)
    {
        llListenRemove(gMenuHandle);
    }
    gMenuHandle = llListen(gMenuChannel, "", gMenuUser, "");
    llSetTimerEvent(MENU_TIMEOUT);
}

closeMenu()
{
    if (gMenuHandle != 0)
    {
        llListenRemove(gMenuHandle);
        gMenuHandle = 0;
    }
    gMenuState = MS_NONE;
    // Keep schedule timer running — restart at 60s intervals
    llSetTimerEvent(60.0);
}

sendMsg(key userId, string message)
{
    llRegionSayTo(userId, 0, message);
}

// ═══════════════════════════════════════════════════════════════════════
//  DIALOG MENUS
// ═══════════════════════════════════════════════════════════════════════

showMainMenu()
{
    gMenuState = MS_MAIN;
    openListener();

    string info = "\n── Gridtech Media Manager v" + VERSION + " ──\n";
    if (gCurrentURL != "")
    {
        info += "Now: " + truncate(gCurrentName, 30) + "\n";
    }
    else
    {
        info += "No stream active\n";
    }

    integer role = getUserRole(gMenuUser);
    list buttons;

    if (role >= ROLE_OWNER)
    {
        buttons = ["Settings", "Schedule", "Access",
                   "History",  "Clear",    "Volume",
                   "Presets",  "Set URL",  "Quick Play"];
    }
    else if (role >= ROLE_MANAGER)
    {
        buttons = ["History",  "Clear",    "Volume",
                   "Presets",  "Set URL",  "Quick Play"];
    }
    else if (role >= ROLE_DJ)
    {
        buttons = ["History", "Presets", "Quick Play"];
    }
    else
    {
        sendMsg(gMenuUser, "You don't have permission to manage media.");
        closeMenu();
        return;
    }

    llDialog(gMenuUser, info, buttons, gMenuChannel);
}

showPresetCategoryMenu()
{
    gMenuState = MS_PRESET_CAT;
    openListener();

    integer mCount = llGetListLength(gPresetsMusic) / 2;
    integer tCount = llGetListLength(gPresetsTalk) / 2;
    integer aCount = llGetListLength(gPresetsAmbient) / 2;

    string info = "\n── Preset Categories ──\n"
        + "Music: " + (string)mCount + "/" + (string)MAX_PRESETS + "\n"
        + "Talk: " + (string)tCount + "/" + (string)MAX_PRESETS + "\n"
        + "Ambient: " + (string)aCount + "/" + (string)MAX_PRESETS;

    llDialog(gMenuUser, info,
        ["<< Back", "Ambient", "Talk", "Music"],
        gMenuChannel);
}

showPresetListMenu(string category)
{
    gTempCategory = category;
    gMenuState = MS_PRESET_PICK;
    openListener();

    list presets = getPresetList(category);
    integer count = llGetListLength(presets) / 2;

    if (count == 0)
    {
        sendMsg(gMenuUser, "No " + category + " presets saved yet.");
        showPresetCategoryMenu();
        return;
    }

    string info = "\n── " + category + " Presets ──\n"
        + "Select a stream to play:";

    list buttons = ["<< Back"];
    integer role = getUserRole(gMenuUser);
    if (role >= ROLE_MANAGER)
    {
        buttons += ["Add New", "Delete"];
    }

    integer i;
    for (i = 0; i < count && i < 9; i++)
    {
        buttons += [truncate(llList2String(presets, i * 2), 24)];
    }

    llDialog(gMenuUser, info, buttons, gMenuChannel);
}

showAccessMenu()
{
    gMenuState = MS_ACCESS;
    openListener();

    integer mgrCount = llGetListLength(gManagers) / 2;
    integer djCount  = llGetListLength(gDJs) / 2;

    string info = "\n── Access Control ──\n"
        + "Managers: " + (string)mgrCount + "\n"
        + "DJs: " + (string)djCount + "\n\n"
        + "Managers can set streams & manage presets.\n"
        + "DJs can play from presets.";

    llDialog(gMenuUser, info,
        ["<< Back", "Remove", "Add DJ", "Add Mgr"],
        gMenuChannel);
}

showScheduleMenu()
{
    gMenuState = MS_SCHEDULE;
    openListener();

    integer count = llGetListLength(gSchedule) / 4;
    string info = "\n── Schedule ──\n"
        + (string)count + " scheduled entries\n\n"
        + "Auto-switch streams at set times.";

    llDialog(gMenuUser, info,
        ["<< Back", "Clear All", "View", "Add"],
        gMenuChannel);
}

showScheduleDayMenu()
{
    gMenuState = MS_SCHED_DAY;
    openListener();

    llDialog(gMenuUser,
        "\n── Schedule Day ──\nSelect day of week:",
        ["<< Back", "Daily", "Sat",
         "Wed",     "Thu",   "Fri",
         "Sun",     "Mon",   "Tue"],
        gMenuChannel);
}

showScheduleHourMenu()
{
    gMenuState = MS_SCHED_HOUR;
    openListener();

    llDialog(gMenuUser,
        "\n── Schedule Hour ──\n"
        + "Day: " + dayName(gTempDay) + "\n"
        + "Select hour (SLT):\n"
        + "Page " + (string)(gMenuPage + 1) + "/2",
        llList2List(
            ["<< Back", "Next >>", "11 PM",
             "8 PM",    "9 PM",    "10 PM",
             "5 PM",    "6 PM",    "7 PM",
             "2 PM",    "3 PM",    "4 PM",
             "<< Back", "Next >>", "11 AM",
             "8 AM",    "9 AM",    "10 AM",
             "5 AM",    "6 AM",    "7 AM",
             "2 AM",    "3 AM",    "4 AM",
             "12 AM",   "1 AM",    "12 PM"],
            gMenuPage * 12, gMenuPage * 12 + 11),
        gMenuChannel);
}

showSchedulePresetMenu()
{
    gMenuState = MS_SCHED_PICK;
    openListener();

    // Show all presets from all categories
    list buttons = ["<< Back"];
    list allPresets = gPresetsMusic + gPresetsTalk + gPresetsAmbient;

    integer i;
    integer count = llGetListLength(allPresets) / 2;
    for (i = 0; i < count && i < 11; i++)
    {
        buttons += [truncate(llList2String(allPresets, i * 2), 24)];
    }

    if (count == 0)
    {
        sendMsg(gMenuUser, "No presets available. Add presets first.");
        showScheduleMenu();
        return;
    }

    llDialog(gMenuUser,
        "\n── Pick Stream ──\n"
        + dayName(gTempDay) + " at " + hourLabel(gTempHour)
        + "\nSelect preset to schedule:",
        buttons, gMenuChannel);
}

showVolumeMenu()
{
    gMenuState = MS_VOLUME;
    openListener();

    llDialog(gMenuUser,
        "\n── Volume Control ──\n"
        + "Current: " + (string)gVolume + "%\n\n"
        + "Adjust volume level.\n"
        + "Sync broadcasts to parcel visitors.",
        ["<< Back", "Sync Now", "100%",
         "60%",     "70%",      "80%",
         "20%",     "30%",      "50%",
         "Mute",    "10%",      "40%"],
        gMenuChannel);
}

showSettingsMenu()
{
    gMenuState = MS_SETTINGS;
    openListener();

    string npStatus   = llList2String(["OFF", "ON"], gShowNowPlaying);
    string autoStatus = llList2String(["OFF", "ON"], gAutoPlay);

    llDialog(gMenuUser,
        "\n── Settings ──\n\n"
        + "Now Playing text: " + npStatus + "\n"
        + "Auto-play: " + autoStatus + "\n"
        + "Volume: " + (string)gVolume + "%",
        ["<< Back",     "Reset All",    "Clear Presets",
         "Now Playing", "Auto-play"],
        gMenuChannel);
}

showHistoryMenu()
{
    gMenuState = MS_HISTORY;
    openListener();

    integer count = llGetListLength(gHistory) / 2;
    if (count == 0)
    {
        sendMsg(gMenuUser, "No stream history yet.");
        showMainMenu();
        return;
    }

    string info = "\n── Recent Streams ──\nSelect to replay:";
    list buttons = ["<< Back"];

    integer i;
    for (i = 0; i < count; i++)
    {
        buttons += [truncate(llList2String(gHistory, i * 2), 24)];
    }

    llDialog(gMenuUser, info, buttons, gMenuChannel);
}

showRemoveStaffMenu()
{
    gMenuState = MS_REMOVE_STAFF;
    openListener();

    list buttons = ["<< Back"];
    integer i;
    integer count;

    // Add managers
    count = llGetListLength(gManagers);
    for (i = 0; i < count; i += 2)
    {
        buttons += ["M:" + truncate(llList2String(gManagers, i + 1), 21)];
    }

    // Add DJs
    count = llGetListLength(gDJs);
    for (i = 0; i < count; i += 2)
    {
        buttons += ["D:" + truncate(llList2String(gDJs, i + 1), 21)];
    }

    if (llGetListLength(buttons) <= 1)
    {
        sendMsg(gMenuUser, "No staff members to remove.");
        showAccessMenu();
        return;
    }

    llDialog(gMenuUser,
        "\n── Remove Staff ──\n"
        + "M: = Manager, D: = DJ\n"
        + "Select to remove:",
        buttons, gMenuChannel);
}

showConfirmMenu(string action, integer confirmId)
{
    gMenuState = MS_CONFIRM;
    gConfirmAction = confirmId;
    openListener();

    llDialog(gMenuUser,
        "\n── Confirm ──\n\n" + action + "\n\nAre you sure?",
        ["Cancel", "Confirm"],
        gMenuChannel);
}

// ═══════════════════════════════════════════════════════════════════════
//  HOUR PARSING
// ═══════════════════════════════════════════════════════════════════════

integer parseHourButton(string button)
{
    if (button == "12 AM") return 0;
    if (button == "12 PM") return 12;
    if (button == "Mute")  return -1;

    list parts = llParseString2List(button, [" "], []);
    integer hour = (integer)llList2String(parts, 0);
    string ampm  = llList2String(parts, 1);

    if (ampm == "PM" && hour != 12) hour += 12;
    if (ampm == "AM" && hour == 12) hour = 0;

    return hour;
}

// ═══════════════════════════════════════════════════════════════════════
//  FIND PRESET ACROSS ALL CATEGORIES
// ═══════════════════════════════════════════════════════════════════════

string findPresetCategory(string name)
{
    list presets;
    integer i;
    integer count;

    presets = gPresetsMusic;
    count = llGetListLength(presets);
    for (i = 0; i < count; i += 2)
    {
        if (llList2String(presets, i) == name ||
            truncate(llList2String(presets, i), 24) == name)
        {
            return CAT_MUSIC;
        }
    }

    presets = gPresetsTalk;
    count = llGetListLength(presets);
    for (i = 0; i < count; i += 2)
    {
        if (llList2String(presets, i) == name ||
            truncate(llList2String(presets, i), 24) == name)
        {
            return CAT_TALK;
        }
    }

    presets = gPresetsAmbient;
    count = llGetListLength(presets);
    for (i = 0; i < count; i += 2)
    {
        if (llList2String(presets, i) == name ||
            truncate(llList2String(presets, i), 24) == name)
        {
            return CAT_AMBIENT;
        }
    }

    return "";
}

string findPresetFullName(string partialName)
{
    list allPresets = gPresetsMusic + gPresetsTalk + gPresetsAmbient;
    integer i;
    integer count = llGetListLength(allPresets);
    for (i = 0; i < count; i += 2)
    {
        string fullName = llList2String(allPresets, i);
        if (fullName == partialName ||
            truncate(fullName, 24) == partialName)
        {
            return fullName;
        }
    }
    return partialName;
}

// ═══════════════════════════════════════════════════════════════════════
//  QUICK PLAY — List all presets for one-tap play
// ═══════════════════════════════════════════════════════════════════════

showQuickPlayMenu()
{
    gMenuState = MS_PRESET_PICK;
    gTempCategory = "";
    openListener();

    list buttons = ["<< Back"];
    list allPresets = gPresetsMusic + gPresetsTalk + gPresetsAmbient;

    integer i;
    integer count = llGetListLength(allPresets) / 2;
    for (i = 0; i < count && i < 11; i++)
    {
        buttons += [truncate(llList2String(allPresets, i * 2), 24)];
    }

    if (count == 0)
    {
        sendMsg(gMenuUser, "No presets saved. Add presets first.");
        showMainMenu();
        return;
    }

    llDialog(gMenuUser,
        "\n── Quick Play ──\nAll presets — tap to play:",
        buttons, gMenuChannel);
}

// ═══════════════════════════════════════════════════════════════════════
//  CHAT COMMAND PROCESSOR
// ═══════════════════════════════════════════════════════════════════════

processChatCommand(key userId, string message)
{
    message = llStringTrim(message, STRING_TRIM);
    string lower = llToLower(message);
    integer role = getUserRole(userId);

    if (lower == "help")
    {
        showChatHelp(userId);
        return;
    }

    if (lower == "status" || lower == "info")
    {
        showStatus(userId);
        return;
    }

    if (lower == "stop" || lower == "clear")
    {
        if (role < ROLE_MANAGER)
        {
            sendMsg(userId, "Permission denied.");
            return;
        }
        clearParcelMedia(userId);
        saveSettings();
        return;
    }

    if (lower == "list")
    {
        listPresets(userId);
        return;
    }

    if (lower == "history")
    {
        showHistoryChat(userId);
        return;
    }

    if (lower == "sync")
    {
        if (role < ROLE_DJ)
        {
            sendMsg(userId, "Permission denied.");
            return;
        }
        syncVolume();
        sendMsg(userId, "Volume synced: " + (string)gVolume + "%");
        return;
    }

    // Multi-word commands
    integer spaceIdx = llSubStringIndex(lower, " ");
    if (spaceIdx < 0)
    {
        sendMsg(userId, "Unknown command. Type /8 help for a list.");
        return;
    }

    string cmd = llGetSubString(lower, 0, spaceIdx - 1);
    string arg = llStringTrim(
        llGetSubString(message, spaceIdx + 1, -1), STRING_TRIM);

    if (cmd == "play")
    {
        if (role < ROLE_DJ)
        {
            sendMsg(userId, "Permission denied.");
            return;
        }
        string cat = findPresetCategory(arg);
        if (cat != "")
        {
            string url = getPresetURL(cat, arg);
            if (url != "")
            {
                setParcelMedia(url, arg, userId);
                saveSettings();
                return;
            }
        }
        sendMsg(userId, "Preset not found: " + arg);
        return;
    }

    if (cmd == "url")
    {
        if (role < ROLE_MANAGER)
        {
            sendMsg(userId, "Permission denied.");
            return;
        }
        setParcelMedia(arg, "Custom URL", userId);
        saveSettings();
        return;
    }

    if (cmd == "vol" || cmd == "volume")
    {
        if (role < ROLE_MANAGER)
        {
            sendMsg(userId, "Permission denied.");
            return;
        }
        integer newVol = (integer)arg;
        if (newVol < 0)  newVol = 0;
        if (newVol > 100) newVol = 100;
        gVolume = newVol;
        syncVolume();
        updateNowPlaying();
        saveSettings();
        sendMsg(userId, "Volume: " + (string)gVolume + "%");
        return;
    }

    if (cmd == "add")
    {
        if (role < ROLE_MANAGER)
        {
            sendMsg(userId, "Permission denied.");
            return;
        }
        // Format: add <category> <name> <url>
        processAddCommand(userId, arg);
        return;
    }

    if (cmd == "remove" || cmd == "del")
    {
        if (role < ROLE_MANAGER)
        {
            sendMsg(userId, "Permission denied.");
            return;
        }
        processRemoveCommand(userId, arg);
        return;
    }

    sendMsg(userId, "Unknown command: " + cmd + ". Type /8 help.");
}

processAddCommand(key userId, string args)
{
    // Parse: <category> <name> <url>
    integer sp1 = llSubStringIndex(args, " ");
    if (sp1 < 0)
    {
        sendMsg(userId, "Usage: /8 add <music|talk|ambient> <name> <url>");
        return;
    }

    string catArg = llGetSubString(args, 0, sp1 - 1);
    string rest   = llStringTrim(
        llGetSubString(args, sp1 + 1, -1), STRING_TRIM);

    integer sp2 = llSubStringIndex(rest, " ");
    if (sp2 < 0)
    {
        sendMsg(userId, "Usage: /8 add <music|talk|ambient> <name> <url>");
        return;
    }

    string name = llGetSubString(rest, 0, sp2 - 1);
    string url  = llStringTrim(
        llGetSubString(rest, sp2 + 1, -1), STRING_TRIM);

    string category;
    string catLower = llToLower(catArg);
    if (catLower == "music")        category = CAT_MUSIC;
    else if (catLower == "talk")    category = CAT_TALK;
    else if (catLower == "ambient") category = CAT_AMBIENT;
    else
    {
        sendMsg(userId,
            "Invalid category. Use: music, talk, or ambient");
        return;
    }

    if (addPreset(category, name, url))
    {
        saveSettings();
        sendMsg(userId,
            "Preset added to " + category + ": " + name);
    }
    else
    {
        sendMsg(userId,
            category + " category is full (" + (string)MAX_PRESETS
            + " max).");
    }
}

processRemoveCommand(key userId, string presetName)
{
    string cat = findPresetCategory(presetName);
    if (cat == "")
    {
        sendMsg(userId, "Preset not found: " + presetName);
        return;
    }

    if (removePreset(cat, presetName))
    {
        saveSettings();
        sendMsg(userId,
            "Removed from " + cat + ": " + presetName);
    }
    else
    {
        sendMsg(userId, "Failed to remove preset.");
    }
}

showChatHelp(key userId)
{
    sendMsg(userId,
        "\n── Media Manager Commands (/8) ──\n"
        + "/8 help             — Show this help\n"
        + "/8 status           — Current stream info\n"
        + "/8 list             — List all presets\n"
        + "/8 play <name>      — Play a preset\n"
        + "/8 url <url>        — Play a custom URL\n"
        + "/8 stop             — Stop streaming\n"
        + "/8 vol <0-100>      — Set volume\n"
        + "/8 sync             — Broadcast volume sync\n"
        + "/8 history          — Recent streams\n"
        + "/8 add <cat> <name> <url> — Add preset\n"
        + "/8 remove <name>    — Remove preset\n"
        + "Categories: music, talk, ambient"
    );
}

showStatus(key userId)
{
    string info = "\n── Stream Status ──\n";
    if (gCurrentURL != "")
    {
        info += "Playing: " + gCurrentName + "\n"
            + "URL: " + truncate(gCurrentURL, 50) + "\n"
            + "Set by: " + gSetBy + "\n";
    }
    else
    {
        info += "No stream active\n";
    }
    info += "Volume: " + (string)gVolume + "%\n"
        + "Your role: " + roleName(getUserRole(userId));

    sendMsg(userId, info);
}

listPresets(key userId)
{
    string info = "\n── All Presets ──\n";

    list cats = [CAT_MUSIC, CAT_TALK, CAT_AMBIENT];
    integer c;
    for (c = 0; c < 3; c++)
    {
        string cat = llList2String(cats, c);
        list presets = getPresetList(cat);
        integer count = llGetListLength(presets) / 2;
        info += "\n" + cat + " (" + (string)count + "):";

        integer i;
        for (i = 0; i < count; i++)
        {
            info += "\n  " + llList2String(presets, i * 2);
        }
        if (count == 0)
        {
            info += "\n  (empty)";
        }
    }

    sendMsg(userId, info);
}

showHistoryChat(key userId)
{
    integer count = llGetListLength(gHistory) / 2;
    if (count == 0)
    {
        sendMsg(userId, "No stream history.");
        return;
    }

    string info = "\n── Recent Streams ──";
    integer i;
    for (i = 0; i < count; i++)
    {
        info += "\n" + (string)(i + 1) + ". "
            + llList2String(gHistory, i * 2);
    }

    sendMsg(userId, info);
}

// ═══════════════════════════════════════════════════════════════════════
//  MENU RESPONSE PROCESSOR
// ═══════════════════════════════════════════════════════════════════════

processMenuResponse(string message)
{
    // ─── Main Menu ────────────────────────────────────────────
    if (gMenuState == MS_MAIN)
    {
        if (message == "Presets")
        {
            showPresetCategoryMenu();
        }
        else if (message == "Quick Play")
        {
            showQuickPlayMenu();
        }
        else if (message == "Set URL")
        {
            gMenuState = MS_SET_URL;
            openListener();
            llTextBox(gMenuUser,
                "\nEnter stream URL:\n(e.g. http://stream.example.com:8000/live)",
                gMenuChannel);
        }
        else if (message == "Clear")
        {
            clearParcelMedia(gMenuUser);
            saveSettings();
            showMainMenu();
        }
        else if (message == "Volume")
        {
            showVolumeMenu();
        }
        else if (message == "History")
        {
            showHistoryMenu();
        }
        else if (message == "Access")
        {
            showAccessMenu();
        }
        else if (message == "Schedule")
        {
            showScheduleMenu();
        }
        else if (message == "Settings")
        {
            showSettingsMenu();
        }
        else
        {
            closeMenu();
        }
        return;
    }

    // ─── Set URL Input ────────────────────────────────────────
    if (gMenuState == MS_SET_URL)
    {
        string url = llStringTrim(message, STRING_TRIM);
        if (url != "")
        {
            setParcelMedia(url, "Custom URL", gMenuUser);
            saveSettings();
        }
        showMainMenu();
        return;
    }

    // ─── Preset Category Menu ─────────────────────────────────
    if (gMenuState == MS_PRESET_CAT)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == CAT_MUSIC || message == CAT_TALK ||
            message == CAT_AMBIENT)
        {
            showPresetListMenu(message);
        }
        else
        {
            showMainMenu();
        }
        return;
    }

    // ─── Preset List / Quick Play ─────────────────────────────
    if (gMenuState == MS_PRESET_PICK)
    {
        if (message == "<< Back")
        {
            if (gTempCategory == "")
            {
                showMainMenu();
            }
            else
            {
                showPresetCategoryMenu();
            }
            return;
        }
        if (message == "Add New")
        {
            gMenuState = MS_PRESET_NAME;
            openListener();
            llTextBox(gMenuUser,
                "\nEnter preset name for " + gTempCategory + ":",
                gMenuChannel);
            return;
        }
        if (message == "Delete")
        {
            gMenuState = MS_PRESET_DEL;
            openListener();

            list presets = getPresetList(gTempCategory);
            list buttons = ["<< Back"];
            integer i;
            integer count = llGetListLength(presets) / 2;
            for (i = 0; i < count && i < 11; i++)
            {
                buttons += [truncate(
                    llList2String(presets, i * 2), 24)];
            }

            llDialog(gMenuUser,
                "\n── Delete Preset ──\nSelect to delete:",
                buttons, gMenuChannel);
            return;
        }

        // Playing a preset
        string fullName = findPresetFullName(message);
        string cat;
        if (gTempCategory != "")
        {
            cat = gTempCategory;
        }
        else
        {
            cat = findPresetCategory(fullName);
        }

        if (cat != "")
        {
            string url = getPresetURL(cat, fullName);
            if (url != "")
            {
                setParcelMedia(url, fullName, gMenuUser);
                saveSettings();
            }
        }
        showMainMenu();
        return;
    }

    // ─── Preset Name Input ────────────────────────────────────
    if (gMenuState == MS_PRESET_NAME)
    {
        gTempName = llStringTrim(message, STRING_TRIM);
        if (gTempName == "")
        {
            showPresetListMenu(gTempCategory);
            return;
        }
        gMenuState = MS_PRESET_URL;
        openListener();
        llTextBox(gMenuUser,
            "\nEnter stream URL for \"" + gTempName + "\":",
            gMenuChannel);
        return;
    }

    // ─── Preset URL Input ─────────────────────────────────────
    if (gMenuState == MS_PRESET_URL)
    {
        gTempURL = llStringTrim(message, STRING_TRIM);
        if (gTempURL != "")
        {
            if (addPreset(gTempCategory, gTempName, gTempURL))
            {
                saveSettings();
                sendMsg(gMenuUser,
                    "Added to " + gTempCategory + ": " + gTempName);
            }
            else
            {
                sendMsg(gMenuUser,
                    gTempCategory + " is full (" + (string)MAX_PRESETS
                    + " max).");
            }
        }
        showPresetListMenu(gTempCategory);
        return;
    }

    // ─── Preset Delete ────────────────────────────────────────
    if (gMenuState == MS_PRESET_DEL)
    {
        if (message == "<< Back")
        {
            showPresetListMenu(gTempCategory);
            return;
        }
        string fullName = findPresetFullName(message);
        if (removePreset(gTempCategory, fullName))
        {
            saveSettings();
            sendMsg(gMenuUser, "Deleted: " + fullName);
        }
        showPresetListMenu(gTempCategory);
        return;
    }

    // ─── Access Menu ──────────────────────────────────────────
    if (gMenuState == MS_ACCESS)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "Add Mgr")
        {
            if (llGetListLength(gManagers) / 2 >= MAX_MANAGERS)
            {
                sendMsg(gMenuUser,
                    "Manager list full (" + (string)MAX_MANAGERS
                    + " max).");
                showAccessMenu();
                return;
            }
            gMenuState = MS_ADD_MGR;
            openListener();
            llTextBox(gMenuUser,
                "\nEnter the exact display name of the new manager:",
                gMenuChannel);
        }
        else if (message == "Add DJ")
        {
            if (llGetListLength(gDJs) / 2 >= MAX_DJS)
            {
                sendMsg(gMenuUser,
                    "DJ list full (" + (string)MAX_DJS + " max).");
                showAccessMenu();
                return;
            }
            gMenuState = MS_ADD_DJ;
            openListener();
            llTextBox(gMenuUser,
                "\nEnter the exact display name of the new DJ:",
                gMenuChannel);
        }
        else if (message == "Remove")
        {
            showRemoveStaffMenu();
        }
        else
        {
            showMainMenu();
        }
        return;
    }

    // ─── Add Manager ─────────────────────────────────────────
    if (gMenuState == MS_ADD_MGR)
    {
        string name = llStringTrim(message, STRING_TRIM);
        if (name != "")
        {
            // Use llRequestAgentData or sensor to find UUID
            // For now, store by name and resolve on access check
            // We'll use a sensor to find nearby avatars
            gTempName = name;
            llSensor(name, NULL_KEY, AGENT, 96.0, PI);
        }
        else
        {
            showAccessMenu();
        }
        return;
    }

    // ─── Add DJ ──────────────────────────────────────────────
    if (gMenuState == MS_ADD_DJ)
    {
        string name = llStringTrim(message, STRING_TRIM);
        if (name != "")
        {
            gTempName = name;
            llSensor(name, NULL_KEY, AGENT, 96.0, PI);
        }
        else
        {
            showAccessMenu();
        }
        return;
    }

    // ─── Remove Staff ────────────────────────────────────────
    if (gMenuState == MS_REMOVE_STAFF)
    {
        if (message == "<< Back")
        {
            showAccessMenu();
            return;
        }

        string prefix = llGetSubString(message, 0, 1);
        string staffName = llGetSubString(message, 2, -1);

        if (prefix == "M:")
        {
            // Remove manager by name
            integer i;
            integer count = llGetListLength(gManagers);
            for (i = 0; i < count; i += 2)
            {
                string mName = llList2String(gManagers, i + 1);
                if (mName == staffName ||
                    truncate(mName, 21) == staffName)
                {
                    gManagers = llDeleteSubList(gManagers, i, i + 1);
                    saveSettings();
                    sendMsg(gMenuUser,
                        "Manager removed: " + mName);
                    break;
                }
            }
        }
        else if (prefix == "D:")
        {
            integer i;
            integer count = llGetListLength(gDJs);
            for (i = 0; i < count; i += 2)
            {
                string dName = llList2String(gDJs, i + 1);
                if (dName == staffName ||
                    truncate(dName, 21) == staffName)
                {
                    gDJs = llDeleteSubList(gDJs, i, i + 1);
                    saveSettings();
                    sendMsg(gMenuUser, "DJ removed: " + dName);
                    break;
                }
            }
        }
        showRemoveStaffMenu();
        return;
    }

    // ─── Schedule Menu ───────────────────────────────────────
    if (gMenuState == MS_SCHEDULE)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "Add")
        {
            showScheduleDayMenu();
        }
        else if (message == "View")
        {
            // Show schedule in chat
            integer count = llGetListLength(gSchedule) / 4;
            if (count == 0)
            {
                sendMsg(gMenuUser, "No scheduled entries.");
                showScheduleMenu();
                return;
            }

            string info = "\n── Schedule ──";
            integer i;
            for (i = 0; i < count; i++)
            {
                info += "\n" + dayName(
                        llList2Integer(gSchedule, i * 4))
                    + " " + hourLabel(
                        llList2Integer(gSchedule, i * 4 + 1))
                    + " -> " + llList2String(gSchedule, i * 4 + 3);
            }
            sendMsg(gMenuUser, info);
            showScheduleMenu();
        }
        else if (message == "Clear All")
        {
            showConfirmMenu("Clear ALL schedule entries?",
                CONFIRM_CLEAR_SCHEDULE);
        }
        else
        {
            showMainMenu();
        }
        return;
    }

    // ─── Schedule Day ────────────────────────────────────────
    if (gMenuState == MS_SCHED_DAY)
    {
        if (message == "<< Back")
        {
            showScheduleMenu();
            return;
        }

        if (message == "Sun")       gTempDay = 0;
        else if (message == "Mon")  gTempDay = 1;
        else if (message == "Tue")  gTempDay = 2;
        else if (message == "Wed")  gTempDay = 3;
        else if (message == "Thu")  gTempDay = 4;
        else if (message == "Fri")  gTempDay = 5;
        else if (message == "Sat")  gTempDay = 6;
        else if (message == "Daily") gTempDay = 7;
        else
        {
            showScheduleMenu();
            return;
        }

        gMenuPage = 0;
        showScheduleHourMenu();
        return;
    }

    // ─── Schedule Hour ───────────────────────────────────────
    if (gMenuState == MS_SCHED_HOUR)
    {
        if (message == "<< Back")
        {
            showScheduleDayMenu();
            return;
        }
        if (message == "Next >>")
        {
            gMenuPage = 1 - gMenuPage;
            showScheduleHourMenu();
            return;
        }

        gTempHour = parseHourButton(message);
        if (gTempHour >= 0)
        {
            showSchedulePresetMenu();
        }
        else
        {
            showScheduleDayMenu();
        }
        return;
    }

    // ─── Schedule Preset Pick ────────────────────────────────
    if (gMenuState == MS_SCHED_PICK)
    {
        if (message == "<< Back")
        {
            gMenuPage = 0;
            showScheduleHourMenu();
            return;
        }

        string fullName = findPresetFullName(message);
        string cat = findPresetCategory(fullName);

        if (cat != "")
        {
            addScheduleEntry(gTempDay, gTempHour, cat, fullName);
            saveSettings();
            sendMsg(gMenuUser,
                "Scheduled: " + dayName(gTempDay)
                + " " + hourLabel(gTempHour) + " -> " + fullName);
        }
        showScheduleMenu();
        return;
    }

    // ─── Volume Menu ─────────────────────────────────────────
    if (gMenuState == MS_VOLUME)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "Sync Now")
        {
            syncVolume();
            sendMsg(gMenuUser,
                "Volume synced: " + (string)gVolume + "%");
            showVolumeMenu();
            return;
        }
        if (message == "Mute")
        {
            gVolume = 0;
        }
        else
        {
            // Parse "XX%" button
            string numStr = llGetSubString(message, 0, -2);
            gVolume = (integer)numStr;
        }

        syncVolume();
        updateNowPlaying();
        saveSettings();
        sendMsg(gMenuUser, "Volume: " + (string)gVolume + "%");
        showVolumeMenu();
        return;
    }

    // ─── History Menu ────────────────────────────────────────
    if (gMenuState == MS_HISTORY)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }

        // Find the history entry by truncated name
        integer i;
        integer count = llGetListLength(gHistory) / 2;
        for (i = 0; i < count; i++)
        {
            string hName = llList2String(gHistory, i * 2);
            if (hName == message || truncate(hName, 24) == message)
            {
                string url = llList2String(gHistory, i * 2 + 1);
                setParcelMedia(url, hName, gMenuUser);
                saveSettings();
                break;
            }
        }
        showMainMenu();
        return;
    }

    // ─── Settings Menu ───────────────────────────────────────
    if (gMenuState == MS_SETTINGS)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "Now Playing")
        {
            gShowNowPlaying = !gShowNowPlaying;
            updateNowPlaying();
            saveSettings();
            string status = llList2String(["OFF", "ON"],
                gShowNowPlaying);
            sendMsg(gMenuUser, "Now Playing display: " + status);
            showSettingsMenu();
        }
        else if (message == "Auto-play")
        {
            gAutoPlay = !gAutoPlay;
            saveSettings();
            string status = llList2String(["OFF", "ON"], gAutoPlay);
            sendMsg(gMenuUser, "Auto-play: " + status);
            showSettingsMenu();
        }
        else if (message == "Clear Presets")
        {
            showConfirmMenu("Delete ALL presets from ALL categories?",
                CONFIRM_CLEAR_PRESETS);
        }
        else if (message == "Reset All")
        {
            showConfirmMenu(
                "Reset ALL settings, presets, staff, and schedule?",
                CONFIRM_RESET_ALL);
        }
        else
        {
            showMainMenu();
        }
        return;
    }

    // ─── Confirm Menu ────────────────────────────────────────
    if (gMenuState == MS_CONFIRM)
    {
        if (message == "Confirm")
        {
            if (gConfirmAction == CONFIRM_CLEAR_PRESETS)
            {
                gPresetsMusic   = [];
                gPresetsTalk    = [];
                gPresetsAmbient = [];
                saveSettings();
                sendMsg(gMenuUser, "All presets cleared.");
            }
            else if (gConfirmAction == CONFIRM_CLEAR_SCHEDULE)
            {
                gSchedule = [];
                saveSettings();
                sendMsg(gMenuUser, "Schedule cleared.");
            }
            else if (gConfirmAction == CONFIRM_RESET_ALL)
            {
                resetAll();
                sendMsg(gMenuUser, "All settings reset to defaults.");
            }
        }
        showMainMenu();
        return;
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  RESET ALL
// ═══════════════════════════════════════════════════════════════════════

resetAll()
{
    gPresetsMusic   = [];
    gPresetsTalk    = [];
    gPresetsAmbient = [];
    gManagers       = [];
    gDJs            = [];
    gSchedule       = [];
    gHistory        = [];
    gCurrentURL     = "";
    gCurrentName    = "";
    gSetBy          = "";
    gShowNowPlaying = TRUE;
    gAutoPlay       = TRUE;
    gVolume         = 50;

    llSetParcelMusicURL("");
    saveSettings();
    updateNowPlaying();
}

// ═══════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

init()
{
    // Clean up listeners
    if (gChatHandle != 0)
    {
        llListenRemove(gChatHandle);
        gChatHandle = 0;
    }
    if (gMenuHandle != 0)
    {
        llListenRemove(gMenuHandle);
        gMenuHandle = 0;
    }
    gMenuState = MS_NONE;

    // Generate unique menu channel
    gMenuChannel = -1 - (integer)llFrand(999999.0);

    // Load saved data
    loadSettings();
    updateNowPlaying();

    // Start chat listener
    gChatHandle = llListen(CHAT_CHANNEL, "", NULL_KEY, "");

    // Start schedule check timer (every 60 seconds)
    llSetTimerEvent(60.0);

    llOwnerSay("Gridtech Media Manager v" + VERSION + " active.\n"
        + "Touch to open menus or use /8 help for commands.");
}

// ═══════════════════════════════════════════════════════════════════════
//  DEFAULT STATE
// ═══════════════════════════════════════════════════════════════════════

default
{
    state_entry()
    {
        init();
    }

    on_rez(integer start_param)
    {
        init();
    }

    touch_start(integer num_detected)
    {
        key toucher = llDetectedKey(0);
        integer role = getUserRole(toucher);

        if (role == ROLE_NONE)
        {
            llRegionSayTo(toucher, 0,
                "You don't have permission to manage media.");
            return;
        }

        gMenuUser = toucher;
        showMainMenu();
    }

    listen(integer channel, string name, key id, string message)
    {
        // Chat commands — open to all (role checked inside)
        if (channel == CHAT_CHANNEL)
        {
            processChatCommand(id, message);
            return;
        }

        // Menu responses — only from active menu user
        if (channel == gMenuChannel && id == gMenuUser)
        {
            processMenuResponse(message);
            return;
        }

        // Volume sync listener (for companion HUDs)
        if (channel == SYNC_CHANNEL)
        {
            // Companion HUDs handle this — nothing to do here
            return;
        }
    }

    sensor(integer num_detected)
    {
        // Found avatar for staff add
        key foundId = llDetectedKey(0);
        string foundName = getDisplayName(foundId);

        if (gMenuState == MS_ADD_MGR)
        {
            gManagers += [(string)foundId, foundName];
            saveSettings();
            sendMsg(gMenuUser, "Manager added: " + foundName);
        }
        else if (gMenuState == MS_ADD_DJ)
        {
            gDJs += [(string)foundId, foundName];
            saveSettings();
            sendMsg(gMenuUser, "DJ added: " + foundName);
        }

        showAccessMenu();
    }

    no_sensor()
    {
        sendMsg(gMenuUser,
            "Avatar not found nearby: " + gTempName
            + "\nThey must be within 96m.");
        showAccessMenu();
    }

    timer()
    {
        // If a menu is open, this is the menu timeout
        if (gMenuState != MS_NONE)
        {
            closeMenu();
            sendMsg(gMenuUser, "Menu timed out.");
            return;
        }

        // Otherwise, this is the schedule check
        checkSchedule();
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  Gridtech — Advanced RP Titler v1.0
//
//  A full-featured roleplay titler for Second Life.
//  Displays configurable floating text above your avatar with
//  name, title, RP status, age, mood, and two custom lines.
//
//  Configure via touch dialog menus or /7 chat commands.
//  Settings persist across detach/reattach via linkset data.
//
//  (c) 2026 Gridtech. All rights reserved.
// ═══════════════════════════════════════════════════════════════════════

// ─── Configuration ───────────────────────────────────────────────────
integer CHAT_CHANNEL = 7;
float   MENU_TIMEOUT = 60.0;
string  VERSION      = "1.0";

// ─── Menu State Constants ────────────────────────────────────────────
integer MS_NONE         = 0;
integer MS_MAIN         = 1;
integer MS_STATUS       = 2;
integer MS_MOOD_MENU    = 3;
integer MS_LINES_MENU   = 4;
integer MS_COLORS_MENU  = 5;
integer MS_THEMES       = 6;
integer MS_TOGGLE       = 7;
integer MS_RESET        = 8;
integer MS_IN_NAME      = 10;
integer MS_IN_TITLE     = 11;
integer MS_IN_AGE       = 12;
integer MS_IN_MOOD      = 13;
integer MS_IN_LINE1     = 14;
integer MS_IN_LINE2     = 15;
integer MS_COLOR_FIELD  = 16;
integer MS_COLOR_PICK   = 17;

// ─── Display Fields ──────────────────────────────────────────────────
string gName   = "";
string gTitle  = "";
string gStatus = "IC";
string gAge    = "";
string gMood   = "";
string gLine1  = "";
string gLine2  = "";

// ─── Visibility Flags ────────────────────────────────────────────────
integer gShowName   = TRUE;
integer gShowTitle  = TRUE;
integer gShowStatus = TRUE;
integer gShowAge    = TRUE;
integer gShowMood   = TRUE;
integer gShowLine1  = TRUE;
integer gShowLine2  = TRUE;

// ─── Per-Line Colors ─────────────────────────────────────────────────
vector gColorName   = <1.0, 1.0, 1.0>;
vector gColorTitle  = <0.85, 0.85, 0.85>;
vector gColorStatus = <0.7, 0.9, 0.7>;
vector gColorAge    = <0.85, 0.85, 0.85>;
vector gColorMood   = <0.85, 0.85, 0.85>;
vector gColorLine1  = <0.7, 0.7, 0.7>;
vector gColorLine2  = <0.7, 0.7, 0.7>;

string gTheme = "Classic";

// ─── Menu / Listener State ───────────────────────────────────────────
integer gMenuChannel;
integer gMenuHandle;
integer gChatHandle;
integer gMenuState;
integer gColorTarget;

// ═══════════════════════════════════════════════════════════════════════
//  THEME DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

setThemeColors(string theme)
{
    if (theme == "Classic")
    {
        gColorName   = <1.0, 1.0, 1.0>;
        gColorTitle  = <0.85, 0.85, 0.85>;
        gColorStatus = <0.7, 0.9, 0.7>;
        gColorAge    = <0.85, 0.85, 0.85>;
        gColorMood   = <0.85, 0.85, 0.85>;
        gColorLine1  = <0.7, 0.7, 0.7>;
        gColorLine2  = <0.7, 0.7, 0.7>;
    }
    else if (theme == "Warm")
    {
        gColorName   = <1.0, 0.84, 0.0>;
        gColorTitle  = <1.0, 0.7, 0.4>;
        gColorStatus = <1.0, 0.6, 0.3>;
        gColorAge    = <1.0, 0.75, 0.5>;
        gColorMood   = <1.0, 0.8, 0.5>;
        gColorLine1  = <0.9, 0.7, 0.4>;
        gColorLine2  = <0.9, 0.7, 0.4>;
    }
    else if (theme == "Cool")
    {
        gColorName   = <0.6, 0.85, 1.0>;
        gColorTitle  = <0.5, 0.7, 0.9>;
        gColorStatus = <0.4, 0.8, 0.8>;
        gColorAge    = <0.5, 0.7, 0.9>;
        gColorMood   = <0.5, 0.75, 0.9>;
        gColorLine1  = <0.4, 0.6, 0.8>;
        gColorLine2  = <0.4, 0.6, 0.8>;
    }
    else if (theme == "Neon")
    {
        gColorName   = <0.0, 1.0, 0.0>;
        gColorTitle  = <1.0, 0.0, 1.0>;
        gColorStatus = <0.0, 1.0, 1.0>;
        gColorAge    = <1.0, 1.0, 0.0>;
        gColorMood   = <1.0, 0.5, 0.0>;
        gColorLine1  = <0.5, 1.0, 0.5>;
        gColorLine2  = <0.5, 1.0, 0.5>;
    }
    else if (theme == "Dark")
    {
        gColorName   = <0.6, 0.6, 0.6>;
        gColorTitle  = <0.5, 0.5, 0.5>;
        gColorStatus = <0.45, 0.55, 0.45>;
        gColorAge    = <0.5, 0.5, 0.5>;
        gColorMood   = <0.5, 0.5, 0.5>;
        gColorLine1  = <0.4, 0.4, 0.4>;
        gColorLine2  = <0.4, 0.4, 0.4>;
    }
    else if (theme == "Rose")
    {
        gColorName   = <1.0, 0.6, 0.7>;
        gColorTitle  = <1.0, 0.5, 0.6>;
        gColorStatus = <0.9, 0.5, 0.6>;
        gColorAge    = <1.0, 0.55, 0.65>;
        gColorMood   = <1.0, 0.6, 0.7>;
        gColorLine1  = <0.85, 0.5, 0.6>;
        gColorLine2  = <0.85, 0.5, 0.6>;
    }
    gTheme = theme;
}

// ═══════════════════════════════════════════════════════════════════════
//  COLOR NAME LOOKUP
// ═══════════════════════════════════════════════════════════════════════

vector nameToColor(string name)
{
    if (name == "Red")    return <1.0, 0.2, 0.2>;
    if (name == "Blue")   return <0.3, 0.5, 1.0>;
    if (name == "Green")  return <0.2, 0.9, 0.2>;
    if (name == "Yellow") return <1.0, 1.0, 0.3>;
    if (name == "White")  return <1.0, 1.0, 1.0>;
    if (name == "Pink")   return <1.0, 0.6, 0.7>;
    if (name == "Purple") return <0.7, 0.3, 1.0>;
    if (name == "Orange") return <1.0, 0.6, 0.1>;
    if (name == "Cyan")   return <0.0, 1.0, 1.0>;
    if (name == "Gold")   return <1.0, 0.84, 0.0>;
    if (name == "Silver") return <0.75, 0.75, 0.75>;
    if (name == "Lime")   return <0.5, 1.0, 0.0>;
    return <1.0, 1.0, 1.0>;
}

// ═══════════════════════════════════════════════════════════════════════
//  DISPLAY UPDATE
// ═══════════════════════════════════════════════════════════════════════

updateDisplay()
{
    string text = "";
    string sep  = "";

    if (gShowName && gName != "")
    {
        text = gName;
        sep  = "\n";
    }
    if (gShowTitle && gTitle != "")
    {
        text += sep + gTitle;
        sep   = "\n";
    }
    if (gShowStatus && gStatus != "")
    {
        string sl;
        if (gStatus == "IC")        sl = "In Character";
        else if (gStatus == "OOC") sl = "Out of Character";
        else if (gStatus == "AFK") sl = "Away";
        else if (gStatus == "Open") sl = "Open to RP";
        else if (gStatus == "DND") sl = "Do Not Disturb";
        else                        sl = gStatus;
        text += sep + "[ " + sl + " ]";
        sep   = "\n";
    }
    if (gShowAge && gAge != "")
    {
        text += sep + gAge;
        sep   = "\n";
    }
    if (gShowMood && gMood != "")
    {
        text += sep + "Mood: " + gMood;
        sep   = "\n";
    }
    if (gShowLine1 && gLine1 != "")
    {
        text += sep + gLine1;
        sep   = "\n";
    }
    if (gShowLine2 && gLine2 != "")
    {
        text += sep + gLine2;
    }

    if (text == "")
    {
        llSetText("", ZERO_VECTOR, 0.0);
    }
    else
    {
        llSetText(text, gColorName, 1.0);
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  PERSISTENCE — Linkset Data
// ═══════════════════════════════════════════════════════════════════════

saveSettings()
{
    llLinksetDataWrite("rpt_saved",  "1");
    llLinksetDataWrite("rpt_name",   gName);
    llLinksetDataWrite("rpt_title",  gTitle);
    llLinksetDataWrite("rpt_status", gStatus);
    llLinksetDataWrite("rpt_age",    gAge);
    llLinksetDataWrite("rpt_mood",   gMood);
    llLinksetDataWrite("rpt_line1",  gLine1);
    llLinksetDataWrite("rpt_line2",  gLine2);

    // Visibility as 7-char string of 0s and 1s
    string vis = (string)gShowName  + (string)gShowTitle  + (string)gShowStatus
               + (string)gShowAge   + (string)gShowMood   + (string)gShowLine1
               + (string)gShowLine2;
    llLinksetDataWrite("rpt_vis", vis);

    llLinksetDataWrite("rpt_theme", gTheme);

    // Colors as pipe-delimited vector strings
    string colors = (string)gColorName   + "|" + (string)gColorTitle  + "|"
                  + (string)gColorStatus + "|" + (string)gColorAge    + "|"
                  + (string)gColorMood   + "|" + (string)gColorLine1  + "|"
                  + (string)gColorLine2;
    llLinksetDataWrite("rpt_colors", colors);

    // Brief summary in object description for quick identification
    string desc = gName;
    if (gStatus != "")
    {
        desc += " | " + gStatus;
    }
    if (llStringLength(desc) > 127)
    {
        desc = llGetSubString(desc, 0, 126);
    }
    llSetObjectDesc(desc);
}

loadSettings()
{
    string saved = llLinksetDataRead("rpt_saved");
    if (saved != "1")
    {
        // No saved data — initialize with defaults
        gName = llGetDisplayName(llGetOwner());
        if (gName == "" || gName == "???")
        {
            gName = llKey2Name(llGetOwner());
        }
        if (gName == "")
        {
            gName = "Resident";
        }
        gTitle  = "";
        gStatus = "IC";
        gAge    = "";
        gMood   = "";
        gLine1  = "";
        gLine2  = "";
        gShowName   = TRUE;
        gShowTitle  = TRUE;
        gShowStatus = TRUE;
        gShowAge    = TRUE;
        gShowMood   = TRUE;
        gShowLine1  = TRUE;
        gShowLine2  = TRUE;
        setThemeColors("Classic");
        return;
    }

    // Load text fields
    gName   = llLinksetDataRead("rpt_name");
    gTitle  = llLinksetDataRead("rpt_title");
    gStatus = llLinksetDataRead("rpt_status");
    gAge    = llLinksetDataRead("rpt_age");
    gMood   = llLinksetDataRead("rpt_mood");
    gLine1  = llLinksetDataRead("rpt_line1");
    gLine2  = llLinksetDataRead("rpt_line2");

    // Load visibility flags
    string vis = llLinksetDataRead("rpt_vis");
    if (llStringLength(vis) >= 7)
    {
        gShowName   = (integer)llGetSubString(vis, 0, 0);
        gShowTitle  = (integer)llGetSubString(vis, 1, 1);
        gShowStatus = (integer)llGetSubString(vis, 2, 2);
        gShowAge    = (integer)llGetSubString(vis, 3, 3);
        gShowMood   = (integer)llGetSubString(vis, 4, 4);
        gShowLine1  = (integer)llGetSubString(vis, 5, 5);
        gShowLine2  = (integer)llGetSubString(vis, 6, 6);
    }

    // Load theme name
    gTheme = llLinksetDataRead("rpt_theme");
    if (gTheme == "")
    {
        gTheme = "Classic";
    }

    // Load colors
    string colors = llLinksetDataRead("rpt_colors");
    if (colors != "")
    {
        list parts = llParseString2List(colors, ["|"], []);
        if (llGetListLength(parts) >= 7)
        {
            gColorName   = (vector)llList2String(parts, 0);
            gColorTitle  = (vector)llList2String(parts, 1);
            gColorStatus = (vector)llList2String(parts, 2);
            gColorAge    = (vector)llList2String(parts, 3);
            gColorMood   = (vector)llList2String(parts, 4);
            gColorLine1  = (vector)llList2String(parts, 5);
            gColorLine2  = (vector)llList2String(parts, 6);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
//  RESET TO DEFAULTS
// ═══════════════════════════════════════════════════════════════════════

resetDefaults()
{
    gName = llGetDisplayName(llGetOwner());
    if (gName == "" || gName == "???")
    {
        gName = llKey2Name(llGetOwner());
    }
    if (gName == "")
    {
        gName = "Resident";
    }
    gTitle  = "";
    gStatus = "IC";
    gAge    = "";
    gMood   = "";
    gLine1  = "";
    gLine2  = "";
    gShowName   = TRUE;
    gShowTitle  = TRUE;
    gShowStatus = TRUE;
    gShowAge    = TRUE;
    gShowMood   = TRUE;
    gShowLine1  = TRUE;
    gShowLine2  = TRUE;
    setThemeColors("Classic");
    saveSettings();
    updateDisplay();
}

// ═══════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

init()
{
    // Clean up any existing listeners
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
    llSetTimerEvent(0.0);

    // Generate unique negative menu channel from owner key
    gMenuChannel = -1 - (integer)llFrand(999999.0);

    // Load saved settings or defaults
    loadSettings();
    updateDisplay();

    // Start listening for chat commands
    gChatHandle = llListen(CHAT_CHANNEL, "", llGetOwner(), "");

    llOwnerSay("Gridtech RP Titler v" + VERSION + " active. Touch to configure or use /7 help.");
}

// ═══════════════════════════════════════════════════════════════════════
//  MENU LISTENER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

openListener()
{
    if (gMenuHandle != 0)
    {
        llListenRemove(gMenuHandle);
    }
    gMenuHandle = llListen(gMenuChannel, "", llGetOwner(), "");
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
    llSetTimerEvent(0.0);
}

// ═══════════════════════════════════════════════════════════════════════
//  DIALOG MENUS
// ═══════════════════════════════════════════════════════════════════════

showMainMenu()
{
    gMenuState = MS_MAIN;
    openListener();
    llDialog(llGetOwner(),
        "\n---- Gridtech RP Titler ----\n\nConfigure your titler display.\nChat commands: /7 help",
        ["Colors", "Toggle", "Reset",
         "Age",    "Mood",   "Lines",
         "Name",   "Title",  "Status"],
        gMenuChannel);
}

showStatusMenu()
{
    gMenuState = MS_STATUS;
    openListener();
    llDialog(llGetOwner(),
        "\n---- RP Status ----\n\nCurrent: " + gStatus + "\nSelect your RP status:",
        ["<< Back",    "DND",  "Open to RP",
         "AFK",        "OOC",  "IC"],
        gMenuChannel);
}

showMoodMenu()
{
    gMenuState = MS_MOOD_MENU;
    openListener();
    llDialog(llGetOwner(),
        "\n---- Mood ----\n\nCurrent: " + gMood + "\nSelect a mood or choose Custom:",
        ["<< Back",  "Custom",   "Clear",
         "Calm",     "Anxious",  "Excited",
         "Happy",    "Sad",      "Tired",
         "Angry",    "Cheerful", "Flirty"],
        gMenuChannel);
}

showLinesMenu()
{
    gMenuState = MS_LINES_MENU;
    openListener();
    llDialog(llGetOwner(),
        "\n---- Custom Lines ----\n\nLine 1: " + gLine1 + "\nLine 2: " + gLine2,
        ["<< Back",     "Clear L1",    "Clear L2",
         "Set Line 1",  "Set Line 2"],
        gMenuChannel);
}

showColorsMenu()
{
    gMenuState = MS_COLORS_MENU;
    openListener();
    llDialog(llGetOwner(),
        "\n---- Colors ----\n\nCurrent theme: " + gTheme
        + "\n\nThemes apply preset color schemes.\nPer-Line lets you set individual line colors.",
        ["<< Back", "Per-Line", "Themes"],
        gMenuChannel);
}

showThemesMenu()
{
    gMenuState = MS_THEMES;
    openListener();
    llDialog(llGetOwner(),
        "\n---- Color Themes ----\n\nCurrent: " + gTheme + "\nSelect a theme:",
        ["<< Back", "Rose",  "Dark",
         "Neon",    "Cool",  "Warm",
         "Classic"],
        gMenuChannel);
}

showColorFieldMenu()
{
    gMenuState = MS_COLOR_FIELD;
    openListener();
    llDialog(llGetOwner(),
        "\n---- Per-Line Color ----\n\nSelect which line to color:",
        ["<< Back", "Line 1", "Line 2",
         "Age",     "Mood",   "Status",
         "Name",    "Title"],
        gMenuChannel);
}

showColorPickMenu()
{
    gMenuState = MS_COLOR_PICK;
    openListener();
    llDialog(llGetOwner(),
        "\n---- Pick Color ----\n\nChoose a color:",
        ["<< Back", "Lime",   "Silver",
         "Gold",    "Cyan",   "Orange",
         "Purple",  "Pink",   "White",
         "Yellow",  "Green",  "Blue",
         "Red"],
        gMenuChannel);
}

showToggleMenu()
{
    gMenuState = MS_TOGGLE;
    openListener();
    string info = "\n---- Toggle Lines ----\n\n"
        + "Name: "   + llList2String(["OFF", "ON"], gShowName)   + "\n"
        + "Title: "  + llList2String(["OFF", "ON"], gShowTitle)  + "\n"
        + "Status: " + llList2String(["OFF", "ON"], gShowStatus) + "\n"
        + "Age: "    + llList2String(["OFF", "ON"], gShowAge)    + "\n"
        + "Mood: "   + llList2String(["OFF", "ON"], gShowMood)   + "\n"
        + "Line 1: " + llList2String(["OFF", "ON"], gShowLine1)  + "\n"
        + "Line 2: " + llList2String(["OFF", "ON"], gShowLine2);
    llDialog(llGetOwner(), info,
        ["<< Back", "Line 1", "Line 2",
         "Age",     "Mood",   "Status",
         "Name",    "Title"],
        gMenuChannel);
}

showResetConfirm()
{
    gMenuState = MS_RESET;
    openListener();
    llDialog(llGetOwner(),
        "\n---- Reset All ----\n\nThis will reset ALL settings to defaults.\nAre you sure?",
        ["Cancel", "Confirm"],
        gMenuChannel);
}

// ═══════════════════════════════════════════════════════════════════════
//  COLOR TARGET SETTER
// ═══════════════════════════════════════════════════════════════════════

setColorForTarget(vector col)
{
    if (gColorTarget == 0)      gColorName   = col;
    else if (gColorTarget == 1) gColorTitle  = col;
    else if (gColorTarget == 2) gColorStatus = col;
    else if (gColorTarget == 3) gColorAge    = col;
    else if (gColorTarget == 4) gColorMood   = col;
    else if (gColorTarget == 5) gColorLine1  = col;
    else if (gColorTarget == 6) gColorLine2  = col;
    gTheme = "Custom";
}

// ═══════════════════════════════════════════════════════════════════════
//  FIELD NAME HELPERS
// ═══════════════════════════════════════════════════════════════════════

string fieldLabel(string field)
{
    field = llToLower(field);
    if (field == "name")   return "Name";
    if (field == "title")  return "Title";
    if (field == "status") return "Status";
    if (field == "age")    return "Age";
    if (field == "mood")   return "Mood";
    if (field == "line1")  return "Line 1";
    if (field == "line2")  return "Line 2";
    return "";
}

integer fieldIndex(string field)
{
    field = llToLower(field);
    if (field == "name")   return 0;
    if (field == "title")  return 1;
    if (field == "status") return 2;
    if (field == "age")    return 3;
    if (field == "mood")   return 4;
    if (field == "line1")  return 5;
    if (field == "line2")  return 6;
    return -1;
}

// ═══════════════════════════════════════════════════════════════════════
//  CHAT COMMAND HELPERS
// ═══════════════════════════════════════════════════════════════════════

setFieldVisible(string field, integer show)
{
    integer idx = fieldIndex(field);
    if (idx == 0)      gShowName   = show;
    else if (idx == 1) gShowTitle  = show;
    else if (idx == 2) gShowStatus = show;
    else if (idx == 3) gShowAge    = show;
    else if (idx == 4) gShowMood   = show;
    else if (idx == 5) gShowLine1  = show;
    else if (idx == 6) gShowLine2  = show;
    else
    {
        llOwnerSay("Unknown field: " + field + ". Use: name, title, status, age, mood, line1, line2");
        return;
    }
    string label = llList2String(["hidden", "shown"], show);
    llOwnerSay(fieldLabel(field) + " is now " + label + ".");
    saveSettings();
    updateDisplay();
}

setFieldColor(string field, string colorName)
{
    integer idx = fieldIndex(field);
    if (idx < 0)
    {
        llOwnerSay("Unknown field: " + field + ". Use: name, title, status, age, mood, line1, line2");
        return;
    }
    vector col = nameToColor(colorName);
    gColorTarget = idx;
    setColorForTarget(col);
    llOwnerSay(fieldLabel(field) + " color set to " + colorName + ".");
    saveSettings();
    updateDisplay();
}

showChatHelp()
{
    llOwnerSay(
        "\n---- RP Titler Chat Commands (/7) ----\n"
        + "/7 name <text>    - Set display name\n"
        + "/7 title <text>   - Set title/rank\n"
        + "/7 ic             - Status: In Character\n"
        + "/7 ooc            - Status: Out of Character\n"
        + "/7 afk            - Status: Away\n"
        + "/7 open           - Status: Open to RP\n"
        + "/7 dnd            - Status: Do Not Disturb\n"
        + "/7 age <text>     - Set character age\n"
        + "/7 mood <text>    - Set mood\n"
        + "/7 line1 <text>   - Set custom line 1\n"
        + "/7 line2 <text>   - Set custom line 2\n"
        + "/7 show <field>   - Show a field\n"
        + "/7 hide <field>   - Hide a field\n"
        + "/7 theme <name>   - Apply theme (Classic/Warm/Cool/Neon/Dark/Rose)\n"
        + "/7 color <field> <color> - Set line color\n"
        + "/7 reset          - Reset all to defaults\n"
        + "/7 help           - Show this help"
    );
}

// ═══════════════════════════════════════════════════════════════════════
//  CHAT COMMAND PROCESSOR
// ═══════════════════════════════════════════════════════════════════════

processChatCommand(string message)
{
    message = llStringTrim(message, STRING_TRIM);
    string lower = llToLower(message);

    // ─── Single-word commands ─────────────────────────────────
    if (lower == "help")
    {
        showChatHelp();
        return;
    }
    if (lower == "ic")
    {
        gStatus = "IC";
        llOwnerSay("Status: In Character");
        saveSettings();
        updateDisplay();
        return;
    }
    if (lower == "ooc")
    {
        gStatus = "OOC";
        llOwnerSay("Status: Out of Character");
        saveSettings();
        updateDisplay();
        return;
    }
    if (lower == "afk")
    {
        gStatus = "AFK";
        llOwnerSay("Status: Away");
        saveSettings();
        updateDisplay();
        return;
    }
    if (lower == "open")
    {
        gStatus = "Open";
        llOwnerSay("Status: Open to RP");
        saveSettings();
        updateDisplay();
        return;
    }
    if (lower == "dnd")
    {
        gStatus = "DND";
        llOwnerSay("Status: Do Not Disturb");
        saveSettings();
        updateDisplay();
        return;
    }
    if (lower == "reset")
    {
        resetDefaults();
        llOwnerSay("All settings reset to defaults.");
        return;
    }

    // ─── Multi-word commands ──────────────────────────────────
    integer spaceIdx = llSubStringIndex(lower, " ");
    if (spaceIdx < 0)
    {
        llOwnerSay("Unknown command. Type /7 help for a list.");
        return;
    }

    string cmd = llGetSubString(lower, 0, spaceIdx - 1);
    string arg = llStringTrim(llGetSubString(message, spaceIdx + 1, -1), STRING_TRIM);

    if (cmd == "name")
    {
        gName = arg;
        llOwnerSay("Name set to: " + arg);
        saveSettings();
        updateDisplay();
        return;
    }
    if (cmd == "title")
    {
        gTitle = arg;
        llOwnerSay("Title set to: " + arg);
        saveSettings();
        updateDisplay();
        return;
    }
    if (cmd == "age")
    {
        gAge = arg;
        llOwnerSay("Age set to: " + arg);
        saveSettings();
        updateDisplay();
        return;
    }
    if (cmd == "mood")
    {
        gMood = arg;
        llOwnerSay("Mood set to: " + arg);
        saveSettings();
        updateDisplay();
        return;
    }
    if (cmd == "line1")
    {
        gLine1 = arg;
        llOwnerSay("Line 1 set to: " + arg);
        saveSettings();
        updateDisplay();
        return;
    }
    if (cmd == "line2")
    {
        gLine2 = arg;
        llOwnerSay("Line 2 set to: " + arg);
        saveSettings();
        updateDisplay();
        return;
    }
    if (cmd == "show")
    {
        setFieldVisible(arg, TRUE);
        return;
    }
    if (cmd == "hide")
    {
        setFieldVisible(arg, FALSE);
        return;
    }
    if (cmd == "theme")
    {
        // Capitalize first letter
        string thm = llToUpper(llGetSubString(arg, 0, 0))
                    + llToLower(llGetSubString(arg, 1, -1));
        list valid = ["Classic", "Warm", "Cool", "Neon", "Dark", "Rose"];
        if (llListFindList(valid, [thm]) >= 0)
        {
            setThemeColors(thm);
            llOwnerSay("Theme applied: " + thm);
            saveSettings();
            updateDisplay();
        }
        else
        {
            llOwnerSay("Unknown theme. Options: Classic, Warm, Cool, Neon, Dark, Rose");
        }
        return;
    }
    if (cmd == "color")
    {
        // Parse: color <field> <color>
        integer sp2 = llSubStringIndex(arg, " ");
        if (sp2 < 0)
        {
            llOwnerSay("Usage: /7 color <field> <color>");
            return;
        }
        string cField = llGetSubString(arg, 0, sp2 - 1);
        string cColor = llStringTrim(llGetSubString(arg, sp2 + 1, -1), STRING_TRIM);
        cColor = llToUpper(llGetSubString(cColor, 0, 0))
               + llToLower(llGetSubString(cColor, 1, -1));
        setFieldColor(cField, cColor);
        return;
    }

    llOwnerSay("Unknown command: " + cmd + ". Type /7 help for a list.");
}

// ═══════════════════════════════════════════════════════════════════════
//  MENU RESPONSE PROCESSOR
// ═══════════════════════════════════════════════════════════════════════

processMenuResponse(string message)
{
    // ─── Main Menu ────────────────────────────────────────────
    if (gMenuState == MS_MAIN)
    {
        if (message == "Name")
        {
            gMenuState = MS_IN_NAME;
            openListener();
            llTextBox(llGetOwner(),
                "\nEnter display name:\n(Current: " + gName + ")",
                gMenuChannel);
        }
        else if (message == "Title")
        {
            gMenuState = MS_IN_TITLE;
            openListener();
            llTextBox(llGetOwner(),
                "\nEnter title/rank:\n(Current: " + gTitle + ")\n\nLeave blank to clear.",
                gMenuChannel);
        }
        else if (message == "Status")
        {
            showStatusMenu();
        }
        else if (message == "Age")
        {
            gMenuState = MS_IN_AGE;
            openListener();
            llTextBox(llGetOwner(),
                "\nEnter character age:\n(Current: " + gAge + ")\n\nLeave blank to clear.",
                gMenuChannel);
        }
        else if (message == "Mood")
        {
            showMoodMenu();
        }
        else if (message == "Lines")
        {
            showLinesMenu();
        }
        else if (message == "Colors")
        {
            showColorsMenu();
        }
        else if (message == "Toggle")
        {
            showToggleMenu();
        }
        else if (message == "Reset")
        {
            showResetConfirm();
        }
        else
        {
            closeMenu();
        }
        return;
    }

    // ─── Status Menu ──────────────────────────────────────────
    if (gMenuState == MS_STATUS)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "IC")             gStatus = "IC";
        else if (message == "OOC")       gStatus = "OOC";
        else if (message == "AFK")       gStatus = "AFK";
        else if (message == "Open to RP") gStatus = "Open";
        else if (message == "DND")       gStatus = "DND";
        else
        {
            showMainMenu();
            return;
        }
        llOwnerSay("Status: " + message);
        saveSettings();
        updateDisplay();
        showMainMenu();
        return;
    }

    // ─── Mood Menu ────────────────────────────────────────────
    if (gMenuState == MS_MOOD_MENU)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "Custom")
        {
            gMenuState = MS_IN_MOOD;
            openListener();
            llTextBox(llGetOwner(), "\nEnter custom mood:", gMenuChannel);
            return;
        }
        if (message == "Clear")
        {
            gMood = "";
            llOwnerSay("Mood cleared.");
        }
        else
        {
            gMood = message;
            llOwnerSay("Mood: " + message);
        }
        saveSettings();
        updateDisplay();
        showMainMenu();
        return;
    }

    // ─── Lines Menu ───────────────────────────────────────────
    if (gMenuState == MS_LINES_MENU)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "Set Line 1")
        {
            gMenuState = MS_IN_LINE1;
            openListener();
            llTextBox(llGetOwner(),
                "\nEnter custom line 1:\n(Current: " + gLine1 + ")",
                gMenuChannel);
        }
        else if (message == "Set Line 2")
        {
            gMenuState = MS_IN_LINE2;
            openListener();
            llTextBox(llGetOwner(),
                "\nEnter custom line 2:\n(Current: " + gLine2 + ")",
                gMenuChannel);
        }
        else if (message == "Clear L1")
        {
            gLine1 = "";
            llOwnerSay("Line 1 cleared.");
            saveSettings();
            updateDisplay();
            showLinesMenu();
        }
        else if (message == "Clear L2")
        {
            gLine2 = "";
            llOwnerSay("Line 2 cleared.");
            saveSettings();
            updateDisplay();
            showLinesMenu();
        }
        else
        {
            showMainMenu();
        }
        return;
    }

    // ─── Colors Menu ──────────────────────────────────────────
    if (gMenuState == MS_COLORS_MENU)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "Themes")
        {
            showThemesMenu();
        }
        else if (message == "Per-Line")
        {
            showColorFieldMenu();
        }
        else
        {
            showMainMenu();
        }
        return;
    }

    // ─── Themes Menu ──────────────────────────────────────────
    if (gMenuState == MS_THEMES)
    {
        if (message == "<< Back")
        {
            showColorsMenu();
            return;
        }
        list valid = ["Classic", "Warm", "Cool", "Neon", "Dark", "Rose"];
        if (llListFindList(valid, [message]) >= 0)
        {
            setThemeColors(message);
            llOwnerSay("Theme applied: " + message);
            saveSettings();
            updateDisplay();
        }
        showColorsMenu();
        return;
    }

    // ─── Color Field Select ───────────────────────────────────
    if (gMenuState == MS_COLOR_FIELD)
    {
        if (message == "<< Back")
        {
            showColorsMenu();
            return;
        }
        integer idx = -1;
        if (message == "Name")        idx = 0;
        else if (message == "Title")  idx = 1;
        else if (message == "Status") idx = 2;
        else if (message == "Age")    idx = 3;
        else if (message == "Mood")   idx = 4;
        else if (message == "Line 1") idx = 5;
        else if (message == "Line 2") idx = 6;
        if (idx >= 0)
        {
            gColorTarget = idx;
            showColorPickMenu();
        }
        else
        {
            showColorsMenu();
        }
        return;
    }

    // ─── Color Pick ───────────────────────────────────────────
    if (gMenuState == MS_COLOR_PICK)
    {
        if (message == "<< Back")
        {
            showColorFieldMenu();
            return;
        }
        vector col = nameToColor(message);
        setColorForTarget(col);
        list fieldNames = ["Name", "Title", "Status", "Age", "Mood", "Line 1", "Line 2"];
        llOwnerSay(llList2String(fieldNames, gColorTarget) + " color set to " + message + ".");
        saveSettings();
        updateDisplay();
        showColorFieldMenu();
        return;
    }

    // ─── Toggle Menu ──────────────────────────────────────────
    if (gMenuState == MS_TOGGLE)
    {
        if (message == "<< Back")
        {
            showMainMenu();
            return;
        }
        if (message == "Name")        gShowName   = !gShowName;
        else if (message == "Title")  gShowTitle  = !gShowTitle;
        else if (message == "Status") gShowStatus = !gShowStatus;
        else if (message == "Age")    gShowAge    = !gShowAge;
        else if (message == "Mood")   gShowMood   = !gShowMood;
        else if (message == "Line 1") gShowLine1  = !gShowLine1;
        else if (message == "Line 2") gShowLine2  = !gShowLine2;
        else
        {
            showMainMenu();
            return;
        }
        saveSettings();
        updateDisplay();
        showToggleMenu();
        return;
    }

    // ─── Reset Confirm ────────────────────────────────────────
    if (gMenuState == MS_RESET)
    {
        if (message == "Confirm")
        {
            resetDefaults();
            llOwnerSay("All settings reset to defaults.");
        }
        showMainMenu();
        return;
    }

    // ─── Text Input: Name ─────────────────────────────────────
    if (gMenuState == MS_IN_NAME)
    {
        gName = llStringTrim(message, STRING_TRIM);
        if (gName == "")
        {
            gName = llGetDisplayName(llGetOwner());
            if (gName == "" || gName == "???")
            {
                gName = llKey2Name(llGetOwner());
            }
            if (gName == "")
            {
                gName = "Resident";
            }
        }
        llOwnerSay("Name set to: " + gName);
        saveSettings();
        updateDisplay();
        showMainMenu();
        return;
    }

    // ─── Text Input: Title ────────────────────────────────────
    if (gMenuState == MS_IN_TITLE)
    {
        gTitle = llStringTrim(message, STRING_TRIM);
        if (gTitle != "")
        {
            llOwnerSay("Title set to: " + gTitle);
        }
        else
        {
            llOwnerSay("Title cleared.");
        }
        saveSettings();
        updateDisplay();
        showMainMenu();
        return;
    }

    // ─── Text Input: Age ──────────────────────────────────────
    if (gMenuState == MS_IN_AGE)
    {
        gAge = llStringTrim(message, STRING_TRIM);
        if (gAge != "")
        {
            llOwnerSay("Age set to: " + gAge);
        }
        else
        {
            llOwnerSay("Age cleared.");
        }
        saveSettings();
        updateDisplay();
        showMainMenu();
        return;
    }

    // ─── Text Input: Mood ─────────────────────────────────────
    if (gMenuState == MS_IN_MOOD)
    {
        gMood = llStringTrim(message, STRING_TRIM);
        if (gMood != "")
        {
            llOwnerSay("Mood set to: " + gMood);
        }
        else
        {
            llOwnerSay("Mood cleared.");
        }
        saveSettings();
        updateDisplay();
        showMainMenu();
        return;
    }

    // ─── Text Input: Line 1 ───────────────────────────────────
    if (gMenuState == MS_IN_LINE1)
    {
        gLine1 = llStringTrim(message, STRING_TRIM);
        if (gLine1 != "")
        {
            llOwnerSay("Line 1 set to: " + gLine1);
        }
        else
        {
            llOwnerSay("Line 1 cleared.");
        }
        saveSettings();
        updateDisplay();
        showLinesMenu();
        return;
    }

    // ─── Text Input: Line 2 ───────────────────────────────────
    if (gMenuState == MS_IN_LINE2)
    {
        gLine2 = llStringTrim(message, STRING_TRIM);
        if (gLine2 != "")
        {
            llOwnerSay("Line 2 set to: " + gLine2);
        }
        else
        {
            llOwnerSay("Line 2 cleared.");
        }
        saveSettings();
        updateDisplay();
        showLinesMenu();
        return;
    }
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

    attach(key id)
    {
        if (id)
        {
            // Attached to avatar — refresh display
            updateDisplay();
        }
        else
        {
            // Detached — clear floating text
            llSetText("", ZERO_VECTOR, 0.0);
        }
    }

    touch_start(integer num_detected)
    {
        if (llDetectedKey(0) != llGetOwner())
        {
            return;
        }
        showMainMenu();
    }

    timer()
    {
        closeMenu();
        llOwnerSay("Menu timed out.");
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != llGetOwner())
        {
            return;
        }

        // Chat commands on channel 7
        if (channel == CHAT_CHANNEL)
        {
            processChatCommand(message);
            return;
        }

        // Menu/textbox responses on menu channel
        if (channel == gMenuChannel)
        {
            processMenuResponse(message);
            return;
        }
    }
}

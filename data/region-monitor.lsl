// ============================================
// Ridgeline Region Monitor — LSL Script
// Drop this into a prim in each SL region.
// Configure the 3 values below, then Save.
// ============================================

string WEBHOOK_URL = "https://ridgeline-bot-production.up.railway.app/api/region-status";
string SECRET       = "YOUR_REGION_MONITORING_SECRET";
string REGION_NAME  = "Ridgeline North"; // Must match config: Cherokee Rose / Oakley Springs / Crescent Creek / MeadowView Heights

float TIMER_INTERVAL = 900.0; // 15 minutes
integer MAX_AGENTS   = 100;

key g_httpRequest;

// ── Escape quotes for JSON safety ──

string jsonSafe(string s)
{
    list parts = llParseString2List(s, ["\""], []);
    s = llDumpList2String(parts, "'");
    parts = llParseString2List(s, ["\\"], []);
    s = llDumpList2String(parts, "");
    return s;
}

// ── Build JSON payload and POST ──

sendUpdate(string eventType)
{
    integer agentCount = (integer)llGetRegionAgentCount();
    list agentList = llGetAgentList(AGENT_LIST_REGION, []);
    integer count = llGetListLength(agentList);
    if (count > MAX_AGENTS)
    {
        count = MAX_AGENTS;
    }

    // Build agent array with full details
    string agentsJson = "[";
    integer i;
    for (i = 0; i < count; i++)
    {
        key agentKey = (key)llList2String(agentList, i);
        string name = llGetDisplayName(agentKey);
        if (name == "")
        {
            name = llKey2Name(agentKey);
        }

        // Get agent details in one call
        list details = llGetObjectDetails(agentKey, [
            OBJECT_POS,
            OBJECT_RUNNING_SCRIPT_COUNT,
            OBJECT_SCRIPT_MEMORY,
            OBJECT_SCRIPT_TIME,
            OBJECT_BODY_SHAPE_TYPE,
            OBJECT_GROUP_TAG
        ]);

        vector pos = llList2Vector(details, 0);
        integer scripts = llList2Integer(details, 1);
        integer memory = llList2Integer(details, 2);
        float scriptTime = llList2Float(details, 3);
        float bodyShape = llList2Float(details, 4);
        string groupTag = llList2String(details, 5);

        // Get parcel name at agent's position
        list parcelInfo = llGetParcelDetails(pos, [PARCEL_DETAILS_NAME]);
        string parcelName = llList2String(parcelInfo, 0);

        string gender = "F";
        if (bodyShape > 0.5)
        {
            gender = "M";
        }

        if (i > 0)
        {
            agentsJson += ",";
        }
        agentsJson += "{\"key\":\"" + (string)agentKey
            + "\",\"name\":\"" + jsonSafe(name)
            + "\",\"scripts\":" + (string)scripts
            + ",\"memory\":" + (string)memory
            + ",\"time\":" + (string)scriptTime
            + ",\"gender\":\"" + gender
            + "\",\"tag\":\"" + jsonSafe(groupTag)
            + "\",\"parcel\":\"" + jsonSafe(parcelName) + "\"}";
    }
    agentsJson += "]";

    float fps = llGetRegionFPS();
    float dilation = llGetRegionTimeDilation();

    string body = "{";
    body += "\"region\":\"" + REGION_NAME + "\",";
    body += "\"agentCount\":" + (string)agentCount + ",";
    body += "\"agents\":" + agentsJson + ",";
    body += "\"fps\":" + (string)fps + ",";
    body += "\"dilation\":" + (string)dilation + ",";
    body += "\"eventType\":\"" + eventType + "\"";
    body += "}";

    g_httpRequest = llHTTPRequest(WEBHOOK_URL,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json",
            HTTP_CUSTOM_HEADER, "Authorization", "Bearer " + SECRET,
            HTTP_BODY_MAXLENGTH, 16384
        ],
        body
    );
}

default
{
    state_entry()
    {
        llOwnerSay("Region monitor starting for: " + REGION_NAME);
        llSetTimerEvent(TIMER_INTERVAL);
        // Send initial update after a short delay
        llSetTimerEvent(5.0);
    }

    timer()
    {
        // Reset to normal interval after initial 5s fire
        if (llGetTime() < 10.0)
        {
            llSetTimerEvent(TIMER_INTERVAL);
        }
        sendUpdate("status");
    }

    changed(integer change)
    {
        if (change & CHANGED_REGION_START)
        {
            llOwnerSay("Region restart detected — sending update in 30s...");
            llSleep(30.0);
            sendUpdate("restart");
        }
    }

    http_response(key requestId, integer status, list metadata, string body)
    {
        if (requestId == g_httpRequest)
        {
            if (status != 200)
            {
                llOwnerSay("Region monitor HTTP error " + (string)status + ": " + body);
            }
        }
    }
}

// ============================================
// Ridgeline Region Monitor — LSL Script
// Drop this into a prim in each SL region.
// Configure the 3 values below, then Save.
// ============================================

string WEBHOOK_URL = "https://ridgeline-bot-production.up.railway.app/api/region-status";
string SECRET       = "YOUR_REGION_MONITORING_SECRET";
string REGION_NAME  = "Ridgeline North"; // Must match config: North / South / East / West

float TIMER_INTERVAL = 900.0; // 15 minutes
integer MAX_AGENTS   = 100;

key g_httpRequest;

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

    // Build agent name array
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
        if (i > 0)
        {
            agentsJson += ",";
        }
        agentsJson += "\"" + name + "\"";
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

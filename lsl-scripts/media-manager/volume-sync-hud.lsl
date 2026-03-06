// ═══════════════════════════════════════════════════════════════════════
//  Gridtech — Volume Sync HUD v1.0
//
//  Companion HUD for the Gridtech Parcel Media Manager.
//  Wear this HUD to receive volume synchronization broadcasts
//  from the parcel media controller.
//
//  Touch to toggle sync on/off.
//
//  (c) 2026 Gridtech. All rights reserved.
// ═══════════════════════════════════════════════════════════════════════

integer SYNC_CHANNEL = -4827391;
integer gSyncEnabled = TRUE;
integer gListenHandle;

init()
{
    if (gListenHandle != 0)
    {
        llListenRemove(gListenHandle);
    }
    gListenHandle = llListen(SYNC_CHANNEL, "", NULL_KEY, "");
    gSyncEnabled = TRUE;
    updateDisplay();
    llOwnerSay("Volume Sync HUD active. Touch to toggle.");
}

updateDisplay()
{
    if (gSyncEnabled)
    {
        llSetColor(<0.3, 0.8, 1.0>, ALL_SIDES);
        llSetText("Vol Sync: ON", <0.3, 0.8, 1.0>, 0.7);
    }
    else
    {
        llSetColor(<0.5, 0.5, 0.5>, ALL_SIDES);
        llSetText("Vol Sync: OFF", <0.5, 0.5, 0.5>, 0.5);
    }
}

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
            init();
        }
        else
        {
            llSetText("", ZERO_VECTOR, 0.0);
        }
    }

    touch_start(integer num_detected)
    {
        if (llDetectedKey(0) != llGetOwner())
        {
            return;
        }

        gSyncEnabled = !gSyncEnabled;
        updateDisplay();

        if (gSyncEnabled)
        {
            llOwnerSay("Volume sync enabled.");
        }
        else
        {
            llOwnerSay("Volume sync disabled.");
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        if (!gSyncEnabled)
        {
            return;
        }

        if (channel != SYNC_CHANNEL)
        {
            return;
        }

        // Parse: GMMS_VOL|<volume>|<streamName>
        list parts = llParseString2List(message, ["|"], []);
        if (llGetListLength(parts) < 2)
        {
            return;
        }

        string cmd = llList2String(parts, 0);
        if (cmd != "GMMS_VOL")
        {
            return;
        }

        integer vol = (integer)llList2String(parts, 1);
        string streamName = "";
        if (llGetListLength(parts) >= 3)
        {
            streamName = llList2String(parts, 2);
        }

        // Adjust the user's media volume via parcel media command
        llParcelMediaCommandList([
            PARCEL_MEDIA_COMMAND_VOLUME, (float)vol / 100.0
        ]);

        if (streamName != "")
        {
            llOwnerSay("Stream: " + streamName
                + " | Volume: " + (string)vol + "%");
        }
    }
}

// Gridtech Stream Changer v2.0

string  V  = "2.0";
float   MT = 30.0;
integer MX_DJ = 20;
integer MX_RA = 20;
integer MX_MG = 12;
integer PG = 9;
string  DP = "scm_";
integer MX_RC = 3;

integer R_NONE = 0;
integer R_DJ   = 1;
integer R_MGR  = 2;
integer R_OWN  = 3;

integer S_NONE = 0;
integer S_OWN  = 1;
integer S_MGR  = 2;
integer S_DJ   = 3;
integer S_DJL  = 10;
integer S_DJAN = 11;
integer S_DJAU = 12;
integer S_DJRP = 13;
integer S_DJRC = 14;
integer S_DJPP = 15;
integer S_RAL  = 20;
integer S_RAAN = 21;
integer S_RAAU = 22;
integer S_RARP = 23;
integer S_RARC = 24;
integer S_RAPP = 25;
integer S_MGL  = 30;
integer S_MGAU = 31;
integer S_MGRP = 32;
integer S_MGRC = 33;
integer S_SET  = 40;
integer S_RSET = 41;
integer S_STOP = 42;
integer S_NP   = 50;
integer S_EDP  = 55;
integer S_EDC  = 56;
integer S_EDI  = 57;
integer S_RCL  = 60;
integer S_ROT  = 65;
integer S_ROTI = 66;

list gDJ = [];
list gRA = [];
list gMG = [];
key gAdm = NULL_KEY;
string gAN = "";
string gAU = "";
string gAB = "";
integer gCh;
integer gH;
integer gSt;
key gUs;
integer gPg;
string gTN = "";
string gTU = "";
integer gTI = -1;
integer gEM = 0;
integer gED = TRUE;
integer gAP = TRUE;
list gRC = [];
integer gRot = FALSE;
integer gRI = 0;
float gRF = 3600.0;
integer gCH2 = 0;

string tr(string s, integer n)
{
    if (llStringLength(s) > n)
    {
        return llGetSubString(s, 0, n - 4) + "...";
    }
    return s;
}

string dn(key id)
{
    string n = llGetDisplayName(id);
    if (n == "" || n == "???")
    {
        n = llKey2Name(id);
    }
    if (n == "")
    {
        n = "Unknown";
    }
    return n;
}

pm(string m)
{
    llRegionSayTo(gUs, 0, m);
}

integer getRole(key id)
{
    if (gAdm != NULL_KEY && id == gAdm)
    {
        return R_OWN;
    }
    list pd = llGetParcelDetails(llGetPos(), [PARCEL_DETAILS_OWNER, PARCEL_DETAILS_GROUP]);
    if (id == llList2Key(pd, 0) || id == llGetOwner())
    {
        return R_OWN;
    }
    string sid = (string)id;
    integer i;
    integer c = llGetListLength(gMG);
    for (i = 0; i < c; i += 2)
    {
        if (llList2String(gMG, i) == sid)
        {
            return R_MGR;
        }
    }
    string lo = llToLower(dn(id));
    c = llGetListLength(gDJ);
    for (i = 0; i < c; i += 2)
    {
        if (llToLower(llList2String(gDJ, i)) == lo)
        {
            return R_DJ;
        }
    }
    return R_NONE;
}

integer getDJI(key id)
{
    string lo = llToLower(dn(id));
    integer i;
    integer c = llGetListLength(gDJ);
    for (i = 0; i < c; i += 2)
    {
        if (llToLower(llList2String(gDJ, i)) == lo)
        {
            return i;
        }
    }
    return -1;
}

integer findE(list d, integer st, integer no, string pk)
{
    integer i;
    integer c = llGetListLength(d);
    for (i = no; i < c; i += st)
    {
        string n = llList2String(d, i);
        if (n == pk || tr(n, 24) == pk)
        {
            return i - no;
        }
    }
    return -1;
}

svL(string p, list d)
{
    integer ct = llGetListLength(d) / 2;
    llLinksetDataWrite(DP + p + "_c", (string)ct);
    integer i;
    for (i = 0; i < ct; i++)
    {
        llLinksetDataWrite(DP + p + "_" + (string)i,
            llList2String(d, i * 2) + "|" + llList2String(d, i * 2 + 1));
    }
    for (i = ct; i < ct + 5; i++)
    {
        llLinksetDataDelete(DP + p + "_" + (string)i);
    }
}

list ldL(string p)
{
    list o = [];
    integer ct = (integer)llLinksetDataRead(DP + p + "_c");
    integer i;
    for (i = 0; i < ct; i++)
    {
        string r = llLinksetDataRead(DP + p + "_" + (string)i);
        integer s = llSubStringIndex(r, "|");
        if (s > 0)
        {
            o += [llGetSubString(r, 0, s - 1), llGetSubString(r, s + 1, -1)];
        }
    }
    return o;
}

svDJ()
{
    svL("dj", gDJ);
}

svRA()
{
    svL("ra", gRA);
}

svMG()
{
    svL("mg", gMG);
}

svAct()
{
    llLinksetDataWrite(DP + "a_n", gAN);
    llLinksetDataWrite(DP + "a_u", gAU);
    llLinksetDataWrite(DP + "a_b", gAB);
    llLinksetDataWrite(DP + "ap", (string)gAP);
    llLinksetDataWrite(DP + "ro", (string)gRot);
    llLinksetDataWrite(DP + "ri", (string)gRF);
    llLinksetDataWrite(DP + "rx", (string)gRI);
}

ldAll()
{
    gDJ = ldL("dj");
    gRA = ldL("ra");
    gMG = ldL("mg");
    gRC = ldL("rc");
    gAN = llLinksetDataRead(DP + "a_n");
    gAU = llLinksetDataRead(DP + "a_u");
    gAB = llLinksetDataRead(DP + "a_b");
    string v = llLinksetDataRead(DP + "ap");
    if (v != "")
    {
        gAP = (integer)v;
    }
    v = llLinksetDataRead(DP + "ro");
    if (v != "")
    {
        gRot = (integer)v;
    }
    v = llLinksetDataRead(DP + "ri");
    if (v != "")
    {
        gRF = (float)v;
    }
    v = llLinksetDataRead(DP + "rx");
    if (v != "")
    {
        gRI = (integer)v;
    }
}

rstAll()
{
    integer i;
    integer c = llGetListLength(gDJ) / 2;
    for (i = 0; i < c; i++)
    {
        llLinksetDataDelete(DP + "dj_" + (string)i);
    }
    llLinksetDataDelete(DP + "dj_c");
    c = llGetListLength(gRA) / 2;
    for (i = 0; i < c; i++)
    {
        llLinksetDataDelete(DP + "ra_" + (string)i);
    }
    llLinksetDataDelete(DP + "ra_c");
    c = llGetListLength(gMG) / 2;
    for (i = 0; i < c; i++)
    {
        llLinksetDataDelete(DP + "mg_" + (string)i);
    }
    llLinksetDataDelete(DP + "mg_c");
    c = llGetListLength(gRC) / 2;
    for (i = 0; i < c; i++)
    {
        llLinksetDataDelete(DP + "rc_" + (string)i);
    }
    llLinksetDataDelete(DP + "rc_c");
    llLinksetDataDelete(DP + "a_n");
    llLinksetDataDelete(DP + "a_u");
    llLinksetDataDelete(DP + "a_b");
    llLinksetDataDelete(DP + "ap");
    llLinksetDataDelete(DP + "ro");
    llLinksetDataDelete(DP + "ri");
    llLinksetDataDelete(DP + "rx");
    gDJ = [];
    gRA = [];
    gMG = [];
    gRC = [];
    gAN = "";
    gAU = "";
    gAB = "";
    gAP = TRUE;
    gRot = FALSE;
    gRI = 0;
    gRF = 3600.0;
}

integer ckPerm()
{
    list pd = llGetParcelDetails(llGetPos(), [PARCEL_DETAILS_OWNER, PARCEL_DETAILS_GROUP]);
    key po = llList2Key(pd, 0);
    key oo = llGetOwner();
    if (oo == po)
    {
        return TRUE;
    }
    if (po == llList2Key(pd, 1) && oo == llList2Key(pd, 1))
    {
        return TRUE;
    }
    return FALSE;
}

string permErr()
{
    list pd = llGetParcelDetails(llGetPos(), [PARCEL_DETAILS_OWNER, PARCEL_DETAILS_GROUP]);
    if (llList2Key(pd, 0) == llList2Key(pd, 1))
    {
        return "Group-owned land. Deed object to land group.";
    }
    return "Object owner must match parcel owner.";
}

upDisp()
{
    if (gAN != "")
    {
        llSetText("Now Playing\n" + gAN + "\nBy: " + gAB, <0.0, 0.8, 1.0>, 1.0);
    }
    else
    {
        llSetText("Stream Manager\nNo stream active", <0.6, 0.6, 0.6>, 0.7);
    }
}

addRC(string nm, string url)
{
    integer i;
    integer c = llGetListLength(gRC);
    for (i = 0; i < c; i += 2)
    {
        if (llList2String(gRC, i) == nm)
        {
            gRC = llDeleteSubList(gRC, i, i + 1);
            jump rcDone;
        }
    }
    @rcDone;
    gRC = [nm, url] + gRC;
    if (llGetListLength(gRC) > MX_RC * 2)
    {
        gRC = llList2List(gRC, 0, MX_RC * 2 - 1);
    }
    svL("rc", gRC);
}

rotNext()
{
    integer c = llGetListLength(gDJ) / 2;
    if (c == 0)
    {
        gRot = FALSE;
        return;
    }
    if (gRI >= c)
    {
        gRI = 0;
    }
    string nm = llList2String(gDJ, gRI * 2);
    string url = llList2String(gDJ, gRI * 2 + 1);
    gRI++;
    if (gRI >= c)
    {
        gRI = 0;
    }
    llLinksetDataWrite(DP + "rx", (string)gRI);
    if (ckPerm())
    {
        llSetParcelMusicURL(url);
        gAN = nm;
        gAU = url;
        gAB = "Rotation";
        svAct();
        upDisp();
        addRC(nm, url);
        llSay(0, "Rotation: " + nm);
    }
}

setStr(string nm, string url, string by)
{
    if (!ckPerm())
    {
        llSay(0, "No permission. " + permErr());
        return;
    }
    llSetParcelMusicURL(url);
    gAN = nm;
    gAU = url;
    gAB = by;
    svAct();
    upDisp();
    addRC(nm, url);
    llSay(0, "Now playing: " + nm + " (" + by + ")");
}

stopStr()
{
    if (!ckPerm())
    {
        llSay(0, "No permission. " + permErr());
        return;
    }
    llSetParcelMusicURL("");
    gAN = "";
    gAU = "";
    gAB = "";
    if (gRot)
    {
        gRot = FALSE;
        llLinksetDataWrite(DP + "ro", "0");
    }
    svAct();
    upDisp();
    llSay(0, "Stream stopped.");
}

opLis()
{
    if (gH)
    {
        llListenRemove(gH);
    }
    gH = llListen(gCh, "", gUs, "");
    llSetTimerEvent(MT);
}

clMenu()
{
    if (gH)
    {
        llListenRemove(gH);
        gH = 0;
    }
    gSt = S_NONE;
    gUs = NULL_KEY;
    if (gRot && llGetListLength(gDJ) > 0)
    {
        llSetTimerEvent(gRF);
    }
    else
    {
        llSetTimerEvent(0.0);
    }
}

list pgBtns(list d, integer no, integer p)
{
    integer tot = llGetListLength(d) / 2;
    integer pgs = (tot + PG - 1) / PG;
    if (pgs < 1)
    {
        pgs = 1;
    }
    if (p >= pgs)
    {
        p = pgs - 1;
    }
    if (p < 0)
    {
        p = 0;
    }
    gPg = p;
    integer s = p * PG;
    integer e = s + PG;
    if (e > tot)
    {
        e = tot;
    }
    list b = [];
    integer i;
    for (i = s; i < e; i++)
    {
        b += [tr(llList2String(d, i * 2 + no), 24)];
    }
    list nav = ["Back"];
    if (p > 0)
    {
        nav += ["<< Prev"];
    }
    if (p < pgs - 1)
    {
        nav += ["Next >>"];
    }
    return nav + b;
}

shInp(integer st, string pr)
{
    gSt = st;
    opLis();
    llTextBox(gUs, "\n" + pr, gCh);
}

shConf(integer st, string q)
{
    gSt = st;
    opLis();
    llDialog(gUs, "\n" + q, ["Cancel", "Confirm"], gCh);
}

string npL()
{
    if (gAN != "")
    {
        return "\nNow: " + tr(gAN, 28);
    }
    return "";
}

shOwn()
{
    gSt = S_OWN;
    opLis();
    llDialog(gUs, "\nOwner Menu" + npL(),
        ["Settings", "Stop", "Managers",
         "Radios", "DJs", "Rotation",
         "Recent", "Play DJ", "Play Radio"], gCh);
}

shMgr()
{
    gSt = S_MGR;
    opLis();
    llDialog(gUs, "\nManager Menu" + npL(),
        ["Stop", "Radios", "DJs",
         "Recent", "Play DJ", "Play Radio"], gCh);
}

shDJM()
{
    gSt = S_DJ;
    opLis();
    llDialog(gUs, "\nDJ Menu" + npL(),
        ["Now Playing", "Recent", "Play Radio", "Go Live"], gCh);
}

shDJL()
{
    gSt = S_DJL;
    opLis();
    integer c = llGetListLength(gDJ) / 2;
    list b = ["Back"];
    integer r = getRole(gUs);
    if (r >= R_MGR && c < MX_DJ)
    {
        b += ["Add DJ"];
    }
    if (r >= R_MGR && c > 0)
    {
        b += ["Remove DJ"];
    }
    if (r >= R_MGR && c > 0)
    {
        b += ["Edit DJ"];
    }
    llDialog(gUs, "\nDJs (" + (string)c + "/" + (string)MX_DJ + ")", b, gCh);
}

shDJR(integer p)
{
    gSt = S_DJRP;
    opLis();
    llDialog(gUs, "\nRemove DJ:", pgBtns(gDJ, 0, p), gCh);
}

shDJP(integer p)
{
    gSt = S_DJPP;
    opLis();
    llDialog(gUs, "\nPlay DJ:", pgBtns(gDJ, 0, p), gCh);
}

shRAL()
{
    gSt = S_RAL;
    opLis();
    integer c = llGetListLength(gRA) / 2;
    list b = ["Back"];
    integer r = getRole(gUs);
    if (r >= R_MGR && c < MX_RA)
    {
        b += ["Add Radio"];
    }
    if (r >= R_MGR && c > 0)
    {
        b += ["Remove Radio"];
    }
    if (r >= R_MGR && c > 0)
    {
        b += ["Edit Radio"];
    }
    llDialog(gUs, "\nRadios (" + (string)c + "/" + (string)MX_RA + ")", b, gCh);
}

shRAR(integer p)
{
    gSt = S_RARP;
    opLis();
    llDialog(gUs, "\nRemove station:", pgBtns(gRA, 0, p), gCh);
}

shRAP(integer p)
{
    gSt = S_RAPP;
    opLis();
    llDialog(gUs, "\nPlay station:", pgBtns(gRA, 0, p), gCh);
}

shMGL()
{
    gSt = S_MGL;
    opLis();
    integer c = llGetListLength(gMG) / 2;
    list b = ["Back"];
    if (c < MX_MG)
    {
        b += ["Add Mgr"];
    }
    if (c > 0)
    {
        b += ["Remove Mgr"];
    }
    llDialog(gUs, "\nManagers (" + (string)c + "/" + (string)MX_MG + ")", b, gCh);
}

shMGR(integer p)
{
    gSt = S_MGRP;
    opLis();
    llDialog(gUs, "\nRemove manager:", pgBtns(gMG, 1, p), gCh);
}

shSet()
{
    gSt = S_SET;
    opLis();
    string ap;
    if (gAP)
    {
        ap = "ON";
    }
    else
    {
        ap = "OFF";
    }
    llDialog(gUs, "\nSettings v" + V
        + "\nAuto-Play: " + ap,
        ["Back", "Full Reset", "Auto-Play"], gCh);
}

shStopC()
{
    string q = "Stop the stream?";
    if (gAN != "")
    {
        q += "\nPlaying: " + tr(gAN, 30);
    }
    shConf(S_STOP, q);
}

shNP()
{
    gSt = S_NP;
    opLis();
    string m = "\nNow Playing\n";
    if (gAN != "")
    {
        m += gAN + "\n" + tr(gAU, 38) + "\nBy: " + gAB;
    }
    else
    {
        m += "No stream active.";
    }
    llDialog(gUs, m, ["Back"], gCh);
}

shRotM()
{
    gSt = S_ROT;
    opLis();
    string st;
    if (gRot)
    {
        st = "ON";
    }
    else
    {
        st = "OFF";
    }
    llDialog(gUs, "\nRotation: " + st
        + "\n" + (string)((integer)(gRF / 60.0)) + " min"
        + " | DJs: " + (string)(llGetListLength(gDJ)/2),
        ["Back", "Toggle", "Set Time", "Skip"], gCh);
}

shRotI()
{
    gSt = S_ROTI;
    opLis();
    llDialog(gUs, "\nInterval:",
        ["Back", "15 min", "30 min", "45 min", "1 hour", "2 hours", "3 hours"], gCh);
}

shEDP(integer p)
{
    gSt = S_EDP;
    opLis();
    if (gED)
    {
        llDialog(gUs, "\nEdit DJ:", pgBtns(gDJ, 0, p), gCh);
    }
    else
    {
        llDialog(gUs, "\nEdit Radio:", pgBtns(gRA, 0, p), gCh);
    }
}

shEDC()
{
    gSt = S_EDC;
    opLis();
    string nm;
    if (gED)
    {
        nm = llList2String(gDJ, gTI);
    }
    else
    {
        nm = llList2String(gRA, gTI);
    }
    llDialog(gUs, "\nEdit: " + nm, ["Back", "Edit Name", "Edit URL"], gCh);
}

shEDI()
{
    gSt = S_EDI;
    opLis();
    string cur;
    if (gEM == 0)
    {
        if (gED)
        {
            cur = llList2String(gDJ, gTI);
        }
        else
        {
            cur = llList2String(gRA, gTI);
        }
        llTextBox(gUs, "\nCurrent: " + cur + "\nNew name:", gCh);
    }
    else
    {
        if (gED)
        {
            cur = llList2String(gDJ, gTI + 1);
        }
        else
        {
            cur = llList2String(gRA, gTI + 1);
        }
        llTextBox(gUs, "\nCurrent: " + tr(cur, 30) + "\nNew URL:", gCh);
    }
}

shRole()
{
    integer r = getRole(gUs);
    if (r == R_OWN)
    {
        shOwn();
    }
    else if (r == R_MGR)
    {
        shMgr();
    }
    else if (r == R_DJ)
    {
        shDJM();
    }
    else
    {
        clMenu();
    }
}

shRCL()
{
    gSt = S_RCL;
    opLis();
    integer c = llGetListLength(gRC) / 2;
    if (c == 0)
    {
        pm("No recent streams.");
        shRole();
        return;
    }
    list b = ["Back"];
    integer i;
    for (i = 0; i < c && i < PG; i++)
    {
        b += [tr(llList2String(gRC, i * 2), 24)];
    }
    llDialog(gUs, "\nRecent (" + (string)c + ")", b, gCh);
}

hMain(string m)
{
    if (gSt == S_OWN)
    {
        if (m == "DJs")
        {
            shDJL();
        }
        else if (m == "Play Radio")
        {
            if (llGetListLength(gRA) == 0)
            {
                pm("No stations.");
                shOwn();
            }
            else
            {
                shRAP(0);
            }
        }
        else if (m == "Radios")
        {
            shRAL();
        }
        else if (m == "Managers")
        {
            shMGL();
        }
        else if (m == "Stop")
        {
            shStopC();
        }
        else if (m == "Settings")
        {
            shSet();
        }
        else if (m == "Rotation")
        {
            shRotM();
        }
        else if (m == "Recent")
        {
            shRCL();
        }
        else if (m == "Play DJ")
        {
            if (llGetListLength(gDJ) == 0)
            {
                pm("No DJs.");
                shOwn();
            }
            else
            {
                shDJP(0);
            }
        }
        else
        {
            clMenu();
        }
        return;
    }
    if (gSt == S_MGR)
    {
        if (m == "DJs")
        {
            shDJL();
        }
        else if (m == "Play Radio")
        {
            if (llGetListLength(gRA) == 0)
            {
                pm("No stations.");
                shMgr();
            }
            else
            {
                shRAP(0);
            }
        }
        else if (m == "Radios")
        {
            shRAL();
        }
        else if (m == "Stop")
        {
            shStopC();
        }
        else if (m == "Recent")
        {
            shRCL();
        }
        else if (m == "Play DJ")
        {
            if (llGetListLength(gDJ) == 0)
            {
                pm("No DJs.");
                shMgr();
            }
            else
            {
                shDJP(0);
            }
        }
        else
        {
            clMenu();
        }
        return;
    }
    if (gSt == S_DJ)
    {
        if (m == "Go Live")
        {
            integer di = getDJI(gUs);
            if (di >= 0)
            {
                setStr(llList2String(gDJ, di), llList2String(gDJ, di + 1), dn(gUs));
            }
            else
            {
                pm("DJ not found.");
            }
            clMenu();
        }
        else if (m == "Play Radio")
        {
            if (llGetListLength(gRA) == 0)
            {
                pm("No stations.");
                shDJM();
            }
            else
            {
                shRAP(0);
            }
        }
        else if (m == "Now Playing")
        {
            shNP();
        }
        else if (m == "Recent")
        {
            shRCL();
        }
        else
        {
            clMenu();
        }
        return;
    }
}

hDJ(string m)
{
    integer r = getRole(gUs);
    if (gSt == S_DJL)
    {
        if (m == "Back")
        {
            shRole();
        }
        else if (m == "Add DJ" && r >= R_MGR)
        {
            shInp(S_DJAN, "DJ name:");
        }
        else if (m == "Remove DJ" && r >= R_MGR)
        {
            shDJR(0);
        }
        else if (m == "Edit DJ" && r >= R_MGR)
        {
            if (llGetListLength(gDJ) == 0)
            {
                pm("No DJs.");
                shDJL();
            }
            else
            {
                gED = TRUE;
                shEDP(0);
            }
        }
        else
        {
            shRole();
        }
        return;
    }
    if (gSt == S_DJAN)
    {
        if (r < R_MGR)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        gTN = llStringTrim(m, STRING_TRIM);
        if (gTN == "")
        {
            pm("Empty name.");
            shDJL();
            return;
        }
        shInp(S_DJAU, "URL for " + gTN + ":");
        return;
    }
    if (gSt == S_DJAU)
    {
        if (r < R_MGR)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        gTU = llStringTrim(m, STRING_TRIM);
        if (llGetSubString(llToLower(gTU), 0, 3) != "http")
        {
            pm("Must start with http.");
            shInp(S_DJAU, "URL for " + gTN + ":");
            return;
        }
        gDJ += [gTN, gTU];
        svDJ();
        pm("Added: " + gTN);
        gTN = "";
        gTU = "";
        shDJL();
        return;
    }
    if (gSt == S_DJRP)
    {
        if (m == "Back")
        {
            shDJL();
            return;
        }
        if (m == "<< Prev")
        {
            shDJR(gPg - 1);
            return;
        }
        if (m == "Next >>")
        {
            shDJR(gPg + 1);
            return;
        }
        if (r < R_MGR)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        integer idx = findE(gDJ, 2, 0, m);
        if (idx >= 0)
        {
            gTI = idx;
            shConf(S_DJRC, "Remove " + llList2String(gDJ, idx) + "?");
        }
        else
        {
            pm("Not found.");
            shDJL();
        }
        return;
    }
    if (gSt == S_DJRC)
    {
        if (m == "Confirm" && r >= R_MGR && gTI >= 0)
        {
            string nm = llList2String(gDJ, gTI);
            gDJ = llDeleteSubList(gDJ, gTI, gTI + 1);
            svDJ();
            pm("Removed: " + nm);
            gTI = -1;
        }
        shDJL();
        return;
    }
    if (gSt == S_DJPP)
    {
        if (m == "Back")
        {
            shRole();
            return;
        }
        if (m == "<< Prev")
        {
            shDJP(gPg - 1);
            return;
        }
        if (m == "Next >>")
        {
            shDJP(gPg + 1);
            return;
        }
        integer idx = findE(gDJ, 2, 0, m);
        if (idx >= 0)
        {
            setStr(llList2String(gDJ, idx), llList2String(gDJ, idx + 1), dn(gUs));
        }
        else
        {
            pm("Not found.");
        }
        clMenu();
        return;
    }
}

hRA(string m)
{
    integer r = getRole(gUs);
    if (gSt == S_RAL)
    {
        if (m == "Back")
        {
            shRole();
        }
        else if (m == "Add Radio" && r >= R_MGR)
        {
            shInp(S_RAAN, "Station name:");
        }
        else if (m == "Remove Radio" && r >= R_MGR)
        {
            shRAR(0);
        }
        else if (m == "Edit Radio" && r >= R_MGR)
        {
            if (llGetListLength(gRA) == 0)
            {
                pm("No stations.");
                shRAL();
            }
            else
            {
                gED = FALSE;
                shEDP(0);
            }
        }
        else
        {
            shRole();
        }
        return;
    }
    if (gSt == S_RAAN)
    {
        if (r < R_MGR)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        gTN = llStringTrim(m, STRING_TRIM);
        if (gTN == "")
        {
            pm("Empty name.");
            shRAL();
            return;
        }
        shInp(S_RAAU, "URL for " + gTN + ":");
        return;
    }
    if (gSt == S_RAAU)
    {
        if (r < R_MGR)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        gTU = llStringTrim(m, STRING_TRIM);
        if (llGetSubString(llToLower(gTU), 0, 3) != "http")
        {
            pm("Must start with http.");
            shInp(S_RAAU, "URL for " + gTN + ":");
            return;
        }
        gRA += [gTN, gTU];
        svRA();
        pm("Added: " + gTN);
        gTN = "";
        gTU = "";
        shRAL();
        return;
    }
    if (gSt == S_RARP)
    {
        if (m == "Back")
        {
            shRAL();
            return;
        }
        if (m == "<< Prev")
        {
            shRAR(gPg - 1);
            return;
        }
        if (m == "Next >>")
        {
            shRAR(gPg + 1);
            return;
        }
        if (r < R_MGR)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        integer idx = findE(gRA, 2, 0, m);
        if (idx >= 0)
        {
            gTI = idx;
            shConf(S_RARC, "Remove " + llList2String(gRA, idx) + "?");
        }
        else
        {
            pm("Not found.");
            shRAL();
        }
        return;
    }
    if (gSt == S_RARC)
    {
        if (m == "Confirm" && r >= R_MGR && gTI >= 0)
        {
            string nm = llList2String(gRA, gTI);
            gRA = llDeleteSubList(gRA, gTI, gTI + 1);
            svRA();
            pm("Removed: " + nm);
            gTI = -1;
        }
        shRAL();
        return;
    }
    if (gSt == S_RAPP)
    {
        if (m == "Back")
        {
            shRole();
            return;
        }
        if (m == "<< Prev")
        {
            shRAP(gPg - 1);
            return;
        }
        if (m == "Next >>")
        {
            shRAP(gPg + 1);
            return;
        }
        integer idx = findE(gRA, 2, 0, m);
        if (idx >= 0)
        {
            setStr(llList2String(gRA, idx), llList2String(gRA, idx + 1), dn(gUs));
        }
        else
        {
            pm("Not found.");
        }
        clMenu();
        return;
    }
}

hMG(string m)
{
    integer r = getRole(gUs);
    if (gSt == S_MGL)
    {
        if (m == "Back")
        {
            shRole();
        }
        else if (m == "Add Mgr" && r >= R_OWN)
        {
            shInp(S_MGAU, "Manager UUID:");
        }
        else if (m == "Remove Mgr" && r >= R_OWN)
        {
            shMGR(0);
        }
        else
        {
            shRole();
        }
        return;
    }
    if (gSt == S_MGAU)
    {
        if (r < R_OWN)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        string inp = llStringTrim(m, STRING_TRIM);
        if (llStringLength(inp) != 36)
        {
            pm("Invalid UUID.");
            shMGL();
            return;
        }
        integer i;
        integer c = llGetListLength(gMG);
        for (i = 0; i < c; i += 2)
        {
            if (llList2String(gMG, i) == inp)
            {
                pm("Already added.");
                shMGL();
                return;
            }
        }
        string nm = dn((key)inp);
        gMG += [inp, nm];
        svMG();
        pm("Added: " + nm);
        shMGL();
        return;
    }
    if (gSt == S_MGRP)
    {
        if (m == "Back")
        {
            shMGL();
            return;
        }
        if (m == "<< Prev")
        {
            shMGR(gPg - 1);
            return;
        }
        if (m == "Next >>")
        {
            shMGR(gPg + 1);
            return;
        }
        if (r < R_OWN)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        integer idx = findE(gMG, 2, 1, m);
        if (idx >= 0)
        {
            gTI = idx;
            shConf(S_MGRC, "Remove " + llList2String(gMG, idx + 1) + "?");
        }
        else
        {
            pm("Not found.");
            shMGL();
        }
        return;
    }
    if (gSt == S_MGRC)
    {
        if (m == "Confirm" && r >= R_OWN && gTI >= 0)
        {
            string nm = llList2String(gMG, gTI + 1);
            gMG = llDeleteSubList(gMG, gTI, gTI + 1);
            svMG();
            pm("Removed: " + nm);
            gTI = -1;
        }
        shMGL();
        return;
    }
}

hUtil(string m)
{
    integer r = getRole(gUs);
    if (gSt == S_SET)
    {
        if (m == "Full Reset" && r >= R_OWN)
        {
            shConf(S_RSET, "Delete ALL data?");
        }
        else if (m == "Auto-Play" && r >= R_OWN)
        {
            gAP = !gAP;
            svAct();
            string s;
            if (gAP)
            {
                s = "ON";
            }
            else
            {
                s = "OFF";
            }
            pm("Auto-Play: " + s);
            shSet();
        }
        else
        {
            shRole();
        }
        return;
    }
    if (gSt == S_RSET)
    {
        if (m == "Confirm" && r >= R_OWN)
        {
            stopStr();
            rstAll();
            pm("Reset complete.");
            upDisp();
        }
        clMenu();
        return;
    }
    if (gSt == S_STOP)
    {
        if (m == "Confirm")
        {
            stopStr();
        }
        shRole();
        return;
    }
    if (gSt == S_NP)
    {
        shRole();
        return;
    }
}

hEdit(string m)
{
    if (gSt == S_EDP)
    {
        if (m == "Back")
        {
            if (gED)
            {
                shDJL();
            }
            else
            {
                shRAL();
            }
            return;
        }
        if (m == "<< Prev")
        {
            shEDP(gPg - 1);
            return;
        }
        if (m == "Next >>")
        {
            shEDP(gPg + 1);
            return;
        }
        list d;
        if (gED)
        {
            d = gDJ;
        }
        else
        {
            d = gRA;
        }
        integer idx = findE(d, 2, 0, m);
        if (idx >= 0)
        {
            gTI = idx;
            shEDC();
        }
        else
        {
            pm("Not found.");
            if (gED)
            {
                shDJL();
            }
            else
            {
                shRAL();
            }
        }
        return;
    }
    if (gSt == S_EDC)
    {
        if (m == "Back")
        {
            if (gED)
            {
                shDJL();
            }
            else
            {
                shRAL();
            }
            return;
        }
        if (m == "Edit Name")
        {
            gEM = 0;
            shEDI();
            return;
        }
        if (m == "Edit URL")
        {
            gEM = 1;
            shEDI();
            return;
        }
        if (gED)
        {
            shDJL();
        }
        else
        {
            shRAL();
        }
        return;
    }
    if (gSt == S_EDI)
    {
        integer r = getRole(gUs);
        if (r < R_MGR)
        {
            pm("Denied.");
            clMenu();
            return;
        }
        string inp = llStringTrim(m, STRING_TRIM);
        if (gEM == 0)
        {
            if (inp == "")
            {
                pm("Empty name.");
                shEDC();
                return;
            }
            if (gED)
            {
                gDJ = llListReplaceList(gDJ, [inp], gTI, gTI);
                svDJ();
            }
            else
            {
                gRA = llListReplaceList(gRA, [inp], gTI, gTI);
                svRA();
            }
            pm("Updated: " + inp);
        }
        else
        {
            if (llGetSubString(llToLower(inp), 0, 3) != "http")
            {
                pm("Must start with http.");
                shEDI();
                return;
            }
            if (gED)
            {
                gDJ = llListReplaceList(gDJ, [inp], gTI + 1, gTI + 1);
                svDJ();
            }
            else
            {
                gRA = llListReplaceList(gRA, [inp], gTI + 1, gTI + 1);
                svRA();
            }
            pm("URL updated.");
        }
        if (gED)
        {
            shDJL();
        }
        else
        {
            shRAL();
        }
        return;
    }
}

hNew(string m)
{
    integer r = getRole(gUs);
    if (gSt == S_RCL)
    {
        if (m == "Back")
        {
            shRole();
            return;
        }
        integer idx = findE(gRC, 2, 0, m);
        if (idx >= 0)
        {
            setStr(llList2String(gRC, idx), llList2String(gRC, idx + 1), dn(gUs));
        }
        else
        {
            pm("Not found.");
        }
        clMenu();
        return;
    }
    if (gSt == S_ROT)
    {
        if (m == "Back")
        {
            shRole();
            return;
        }
        if (m == "Toggle" && r >= R_OWN)
        {
            if (llGetListLength(gDJ) == 0)
            {
                pm("No DJs.");
                shRotM();
                return;
            }
            gRot = !gRot;
            llLinksetDataWrite(DP + "ro", (string)gRot);
            if (gRot)
            {
                pm("Rotation ON");
                rotNext();
                llSetTimerEvent(gRF);
            }
            else
            {
                pm("Rotation OFF");
                llSetTimerEvent(0.0);
            }
            shRotM();
        }
        else if (m == "Set Time" && r >= R_OWN)
        {
            shRotI();
        }
        else if (m == "Skip" && r >= R_OWN)
        {
            if (!gRot)
            {
                pm("Not active.");
                shRotM();
                return;
            }
            rotNext();
            llSetTimerEvent(gRF);
            shRotM();
        }
        else
        {
            shRole();
        }
        return;
    }
    if (gSt == S_ROTI)
    {
        if (m == "Back")
        {
            shRotM();
            return;
        }
        float nv = 0.0;
        if (m == "15 min")
        {
            nv = 900.0;
        }
        else if (m == "30 min")
        {
            nv = 1800.0;
        }
        else if (m == "45 min")
        {
            nv = 2700.0;
        }
        else if (m == "1 hour")
        {
            nv = 3600.0;
        }
        else if (m == "2 hours")
        {
            nv = 7200.0;
        }
        else if (m == "3 hours")
        {
            nv = 10800.0;
        }
        if (nv > 0.0)
        {
            gRF = nv;
            llLinksetDataWrite(DP + "ri", (string)gRF);
            pm((string)((integer)(nv / 60.0)) + " min");
            if (gRot)
            {
                llSetTimerEvent(gRF);
            }
        }
        shRotM();
        return;
    }
}

proc(string m)
{
    if (gSt <= S_DJ)
    {
        hMain(m);
        return;
    }
    if (gSt < S_RAL)
    {
        hDJ(m);
        return;
    }
    if (gSt < S_MGL)
    {
        hRA(m);
        return;
    }
    if (gSt < S_SET)
    {
        hMG(m);
        return;
    }
    if (gSt >= S_EDP && gSt <= S_EDI)
    {
        hEdit(m);
        return;
    }
    if (gSt >= S_RCL && gSt <= S_ROTI)
    {
        hNew(m);
        return;
    }
    hUtil(m);
}

hChat(key id, string m)
{
    integer r = getRole(id);
    if (r == R_NONE)
    {
        return;
    }
    list p = llParseString2List(llToLower(m), [" "], []);
    string c = llList2String(p, 1);
    if (c == "help")
    {
        llRegionSayTo(id, 0, "/stream play [name]\n/stream stop\n/stream now\n/stream list\n/stream recent");
        return;
    }
    if (c == "now")
    {
        if (gAN != "")
        {
            llRegionSayTo(id, 0, "Now: " + gAN + " (" + gAB + ")");
        }
        else
        {
            llRegionSayTo(id, 0, "No stream.");
        }
        return;
    }
    if (c == "stop")
    {
        if (r < R_DJ)
        {
            return;
        }
        gUs = id;
        stopStr();
        return;
    }
    if (c == "list")
    {
        string o = "DJs:";
        integer i;
        integer ct = llGetListLength(gDJ) / 2;
        for (i = 0; i < ct; i++)
        {
            o += "\n " + llList2String(gDJ, i * 2);
        }
        o += "\nStations:";
        ct = llGetListLength(gRA) / 2;
        for (i = 0; i < ct; i++)
        {
            o += "\n " + llList2String(gRA, i * 2);
        }
        llRegionSayTo(id, 0, o);
        return;
    }
    if (c == "recent")
    {
        integer ct = llGetListLength(gRC) / 2;
        if (ct == 0)
        {
            llRegionSayTo(id, 0, "No recent.");
            return;
        }
        string o = "Recent:";
        integer i;
        for (i = 0; i < ct; i++)
        {
            o += "\n " + llList2String(gRC, i * 2);
        }
        llRegionSayTo(id, 0, o);
        return;
    }
    if (c == "play")
    {
        if (r < R_DJ)
        {
            return;
        }
        string sr = llStringTrim(llGetSubString(m, 13, -1), STRING_TRIM);
        if (sr == "")
        {
            llRegionSayTo(id, 0, "/stream play [name]");
            return;
        }
        string sl = llToLower(sr);
        integer i;
        integer ct = llGetListLength(gDJ);
        for (i = 0; i < ct; i += 2)
        {
            if (llSubStringIndex(llToLower(llList2String(gDJ, i)), sl) >= 0)
            {
                gUs = id;
                setStr(llList2String(gDJ, i), llList2String(gDJ, i + 1), dn(id));
                return;
            }
        }
        ct = llGetListLength(gRA);
        for (i = 0; i < ct; i += 2)
        {
            if (llSubStringIndex(llToLower(llList2String(gRA, i)), sl) >= 0)
            {
                gUs = id;
                setStr(llList2String(gRA, i), llList2String(gRA, i + 1), dn(id));
                return;
            }
        }
        llRegionSayTo(id, 0, "No match: " + sr);
        return;
    }
}

init()
{
    if (gH)
    {
        llListenRemove(gH);
        gH = 0;
    }
    if (gCH2)
    {
        llListenRemove(gCH2);
        gCH2 = 0;
    }
    gSt = S_NONE;
    gUs = NULL_KEY;
    llSetTimerEvent(0.0);
    gCh = -1 - (integer)llFrand(999999.0);
    string sa = llLinksetDataRead(DP + "adm");
    if (sa != "")
    {
        gAdm = (key)sa;
    }
    else
    {
        gAdm = llGetOwner();
        llLinksetDataWrite(DP + "adm", (string)gAdm);
    }
    ldAll();
    upDisp();
    gCH2 = llListen(1, "", NULL_KEY, "");
    if (gAP && gAU != "" && ckPerm())
    {
        llSetParcelMusicURL(gAU);
    }
    if (gRot && llGetListLength(gDJ) > 0)
    {
        llSetTimerEvent(gRF);
    }
    llSay(0, "Stream Changer v" + V + " | /stream help (ch1)");
    if (!ckPerm())
    {
        llSay(0, permErr());
    }
}

default
{
    state_entry()
    {
        init();
    }

    on_rez(integer p)
    {
        init();
    }

    touch_start(integer n)
    {
        key t = llDetectedKey(0);
        if (gUs != NULL_KEY && gUs != t)
        {
            if (llGetAgentSize(gUs) == ZERO_VECTOR)
            {
                clMenu();
            }
            else
            {
                llRegionSayTo(t, 0, "Menu in use.");
                return;
            }
        }
        integer r = getRole(t);
        if (r == R_NONE)
        {
            llRegionSayTo(t, 0, "Not authorized.");
            return;
        }
        gUs = t;
        if (r == R_OWN)
        {
            shOwn();
        }
        else if (r == R_MGR)
        {
            shMgr();
        }
        else
        {
            shDJM();
        }
    }

    listen(integer ch, string nm, key id, string m)
    {
        if (ch == 1)
        {
            if (llGetSubString(llToLower(m), 0, 6) == "/stream")
            {
                hChat(id, m);
            }
            return;
        }
        if (id != gUs || ch != gCh)
        {
            return;
        }
        proc(m);
    }

    timer()
    {
        if (gUs != NULL_KEY)
        {
            pm("Menu timed out.");
            clMenu();
            return;
        }
        if (gRot)
        {
            rotNext();
        }
    }

    changed(integer ch)
    {
        if (ch & CHANGED_OWNER)
        {
            list pd = llGetParcelDetails(llGetPos(), [PARCEL_DETAILS_GROUP]);
            if (llGetOwner() != llList2Key(pd, 0))
            {
                rstAll();
                llLinksetDataDelete(DP + "adm");
            }
            init();
        }
    }
}

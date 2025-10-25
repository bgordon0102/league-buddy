
import { ButtonInteraction, EmbedBuilder } from "discord.js";
import fs from "fs";
import path from "path";

export const customId = /^committee_(approve|deny)_/;
// Handles committee voting for trade proposals
export async function execute(interaction) {

    const APPROVED_CHANNEL_ID = "1425555422063890443";
    const DENIED_CHANNEL_ID = "1425567560241254520";
    const STAFF_ROLE_MAP_PATH = path.join(process.cwd(), "data/staffRoleMap.main.json");

    function getCommitteeRoleId() {
        const staffMap = JSON.parse(fs.readFileSync(STAFF_ROLE_MAP_PATH, "utf8"));
        return staffMap["Ghost Paradise Trade Committee"];
    }

    function userHasCommitteeRole(member) {
        // ...existing code...
    }

    // --- Roster update logic ---
    function teamToFile(team) {
        const map = {
            "cavaliers": "cleveland_cavaliers.json",
            "cleveland cavaliers": "cleveland_cavaliers.json",
            "hawks": "atlanta_hawks.json",
            "atlanta hawks": "atlanta_hawks.json",
            "celtics": "boston_celtics.json",
            "boston celtics": "boston_celtics.json",
            "nets": "brooklyn_nets.json",
            "brooklyn nets": "brooklyn_nets.json",
            "hornets": "charlotte_hornets.json",
            "charlotte hornets": "charlotte_hornets.json",
            "bulls": "chicago_bulls.json",
            "chicago bulls": "chicago_bulls.json",
            "mavericks": "dallas_mavericks.json",
            "dallas mavericks": "dallas_mavericks.json",
            "nuggets": "denver_nuggets.json",
            "denver nuggets": "denver_nuggets.json",
            "pistons": "detroit_pistons.json",
            "detroit pistons": "detroit_pistons.json",
            "warriors": "golden_state_warriors.json",
            "golden state warriors": "golden_state_warriors.json",
            "rockets": "houston_rockets.json",
            "houston rockets": "houston_rockets.json",
            "pacers": "indiana_pacers.json",
            "indiana pacers": "indiana_pacers.json",
            "clippers": "los_angeles_clippers.json",
            "los angeles clippers": "los_angeles_clippers.json",
            "lakers": "los_angeles_lakers.json",
            "los angeles lakers": "los_angeles_lakers.json",
            "grizzlies": "memphis_grizzlies.json",
            "memphis grizzlies": "memphis_grizzlies.json",
            "heat": "miami_heat.json",
            "miami heat": "miami_heat.json",
            "bucks": "milwaukee_bucks.json",
            "milwaukee bucks": "milwaukee_bucks.json",
            "timberwolves": "minnesota_timberwolves.json",
            "minnesota timberwolves": "minnesota_timberwolves.json",
            "knicks": "new_york_knicks.json",
            "new york knicks": "new_york_knicks.json",
            "thunder": "oklahoma_city_thunder.json",
            "oklahoma city thunder": "oklahoma_city_thunder.json",
            "magic": "orlando_magic.json",
            "orlando magic": "orlando_magic.json",
            "76ers": "philadelphia_76ers.json",
            "philadelphia 76ers": "philadelphia_76ers.json",
            "suns": "phoenix_suns.json",
            "phoenix suns": "phoenix_suns.json",
            "trail blazers": "portland_trail_blazers.json",
            "portland trail blazers": "portland_trail_blazers.json",
            "kings": "sacramento_kings.json",
            "sacramento kings": "sacramento_kings.json",
            "spurs": "san_antonio_spurs.json",
            "san antonio spurs": "san_antonio_spurs.json",
            "raptors": "toronto_raptors.json",
            "toronto raptors": "toronto_raptors.json",
            "jazz": "utah_jazz.json",
            "utah jazz": "utah_jazz.json",
            "wizards": "washington_wizards.json",
            "washington wizards": "washington_wizards.json"
        };
        const key = team.toLowerCase().trim();
        if (map[key]) return map[key];
        return key.replace(/ /g, '_') + '.json';
    }
    // Load pendingTrades.json and get trade/votes for this interaction/message
    const messageId = interaction.message?.id || interaction.id;
    const pendingPath = path.join(process.cwd(), 'data/pendingTrades.json');
    let pendingTrades = {};
    if (fs.existsSync(pendingPath)) {
        try {
            pendingTrades = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
        } catch { }
    }
    let entry = pendingTrades[messageId];
    if (!entry) {
        await interaction.reply({ content: "Trade not found for this committee vote.", flags: 64 });
        return;
    }
    // Log the vote for this user
    entry.votes = entry.votes || {};
    if (interaction.customId.startsWith('committee_approve_')) {
        entry.votes[interaction.user.id] = 'approve';
    } else if (interaction.customId.startsWith('committee_deny_')) {
        entry.votes[interaction.user.id] = 'deny';
    }
    pendingTrades[messageId] = entry;
    try {
        fs.writeFileSync(pendingPath, JSON.stringify(pendingTrades, null, 2));
    } catch (err) {
        console.error('Failed to save committee votes:', err);
    }
    const trade = entry.trade;
    if (!trade) {
        await interaction.reply({ content: "Trade details not found for this committee vote.", flags: 64 });
        return;
    }
    const teamAFile = path.join(process.cwd(), 'data/teams_rosters', teamToFile(trade.yourTeam));
    const teamBFile = path.join(process.cwd(), 'data/teams_rosters', teamToFile(trade.otherTeam));
    let teamARoster = JSON.parse(fs.readFileSync(teamAFile, 'utf8'));
    let teamBRoster = JSON.parse(fs.readFileSync(teamBFile, 'utf8'));

    // Helper to move players by name
    function normalize(str) {
        return str.toLowerCase().replace(/[^a-z0-9]/gi, '');
    }
    function movePlayers(playerNames, fromRoster, toRoster) {
        for (const name of playerNames) {
            const normName = normalize(name);
            const idx = fromRoster.findIndex(p => {
                const normRosterName = normalize(p.name);
                // Allow exact, partial, or substring match
                return normRosterName === normName || normRosterName.includes(normName) || normName.includes(normRosterName);
            });
            if (idx !== -1) {
                toRoster.push(fromRoster[idx]);
                fromRoster.splice(idx, 1);
            }
        }
    }

    // Parse assets (players only, picks ignored for now)
    const sentPlayers = trade.assetsSent.split(',').map(s => s.trim()).filter(s => s && !s.match(/pick/i));
    const receivedPlayers = trade.assetsReceived.split(',').map(s => s.trim()).filter(s => s && !s.match(/pick/i));

    movePlayers(sentPlayers, teamARoster, teamBRoster);
    movePlayers(receivedPlayers, teamBRoster, teamARoster);

    fs.writeFileSync(teamAFile, JSON.stringify(teamARoster, null, 2));
    fs.writeFileSync(teamBFile, JSON.stringify(teamBRoster, null, 2));
    // --- End roster update logic ---

    // --- Draft pick update logic ---
    const picksPath = path.join(process.cwd(), 'data/team_picks.json');
    let picksData = {};
    if (fs.existsSync(picksPath)) {
        try {
            picksData = JSON.parse(fs.readFileSync(picksPath, 'utf8'));
        } catch { }
    }
    function movePicks(pickNames, fromTeam, toTeam) {
        if (!Array.isArray(picksData[fromTeam])) return;
        picksData[toTeam] = picksData[toTeam] || [];
        for (const pick of pickNames) {
            // Find pick by loose match
            const idx = picksData[fromTeam].findIndex(p => {
                const pickStr = typeof p === 'string' ? p : `${p.year || ''} ${p.round ? (p.round === 1 ? '1st' : '2nd') : ''}`.trim();
                return pickStr.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().includes(pick.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
            });
            if (idx !== -1) {
                // Mark original team if traded
                let pickObj = picksData[fromTeam][idx];
                if (typeof pickObj === 'string') {
                    pickObj = { pick: pickObj, originalTeam: fromTeam };
                } else {
                    pickObj.originalTeam = fromTeam;
                }
                picksData[toTeam].push(pickObj);
                picksData[fromTeam].splice(idx, 1);
            }
        }
    }
    // Parse picks from assetsSent/assetsReceived
    const sentPicks = trade.assetsSent.split(',').map(s => s.trim()).filter(s => s.match(/pick|1st|2nd|round|protected|unprotected|lottery/i));
    const receivedPicks = trade.assetsReceived.split(',').map(s => s.trim()).filter(s => s.match(/pick|1st|2nd|round|protected|unprotected|lottery/i));
    movePicks(sentPicks, trade.yourTeam, trade.otherTeam);
    movePicks(receivedPicks, trade.otherTeam, trade.yourTeam);
    try {
        fs.writeFileSync(picksPath, JSON.stringify(picksData, null, 2));
    } catch { }
    function movePlayers(playerNames, fromRoster, toRoster) {
        for (const name of playerNames) {
            const normName = normalize(name);
            const idx = fromRoster.findIndex(p => {
                const normRosterName = normalize(p.name);
                // Allow exact, partial, or substring match
                return normRosterName === normName || normRosterName.includes(normName) || normName.includes(normRosterName);
            });
            if (idx !== -1) {
                toRoster.push(fromRoster[idx]);
                fromRoster.splice(idx, 1);
            }
        }
    }

    // Parse assets (players only, picks ignored for now)
    // Use unique variable names to avoid redeclaration
    const sentPlayersB = trade.assetsSent.split(',').map(s => s.trim()).filter(s => s && !s.match(/pick/i));
    const receivedPlayersB = trade.assetsReceived.split(',').map(s => s.trim()).filter(s => s && !s.match(/pick/i));

    movePlayers(sentPlayersB, teamARoster, teamBRoster);
    movePlayers(receivedPlayersB, teamBRoster, teamARoster);

    fs.writeFileSync(teamAFile, JSON.stringify(teamARoster, null, 2));
    fs.writeFileSync(teamBFile, JSON.stringify(teamBRoster, null, 2));
    // --- End roster update logic ---

    const notifyRoleId = "1428119680572325929";
    const embed = new EmbedBuilder()
        .setTitle("Trade Approved")
        .addFields(
            { name: "Your Team", value: trade.yourTeam, inline: true },
            { name: "Other Team", value: trade.otherTeam, inline: true },
            { name: "Assets Sent", value: trade.assetsSent },
            { name: "Assets Received", value: trade.assetsReceived }
        );
    if (trade.notes) embed.addFields({ name: "Notes", value: trade.notes });
    embed.setColor(0x57F287);
    try {
        const approvedChannel = await interaction.client.channels.fetch(APPROVED_CHANNEL_ID);
        await approvedChannel.send({ content: `<@&${notifyRoleId}>`, embeds: [embed] });
        try {
            const userA = await interaction.client.users.fetch(trade.proposerId);
            await userA.send({ embeds: [embed] });
        } catch (dmErr) {
            console.error('Failed to send DM to Coach A (proposerId):', trade.proposerId, dmErr);
        }
        await interaction.reply({ content: "Trade approved and rosters updated.", flags: 64 });
    } catch (err) {
        console.error('Trade approval notification error:', err);
        await interaction.reply({ content: "Trade approved, but notification failed.", flags: 64 });
    }
    return;
    // End of approval block
    // Continue with deny block inside the function
    if (votes.deny.length >= 1) {
        // Denied: post in denied channel, notify Coach A
        let trade = global.activeTrades && global.activeTrades[tradeId];
        if (!trade) {
            // Fallback to pendingTrades.json
            try {
                const pendingPath = path.join(process.cwd(), 'data/pendingTrades.json');
                const pendingTrades = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
                trade = pendingTrades[tradeId];
            } catch { }
        }
        if (!trade) {
            await interaction.reply({ content: "Trade not found or expired.", flags: 64 });
            return;
        }
        trade.status = "denied";
        const notifyRoleId = "1428119680572325929";
        const embed = new EmbedBuilder()
            .setTitle("Trade Denied")
            .addFields(
                { name: "Your Team", value: trade.yourTeam, inline: true },
                { name: "Other Team", value: trade.otherTeam, inline: true },
                { name: "Assets Sent", value: trade.assetsSent },
                { name: "Assets Received", value: trade.assetsReceived }
            );
        if (trade.notes) embed.addFields({ name: "Notes", value: trade.notes });
        embed.setColor(0xED4245);
        try {
            const deniedChannel = await interaction.client.channels.fetch(DENIED_CHANNEL_ID);
            await deniedChannel.send({ content: `<@&${notifyRoleId}>`, embeds: [embed] });
            try {
                const userA = await interaction.client.users.fetch(trade.proposerId);
                await userA.send({ embeds: [embed] });
            } catch (dmErr) {
                console.error('Failed to send DM to Coach A (proposerId):', trade.proposerId, dmErr);
            }
            await interaction.reply({ content: "Trade denied.", flags: 64 });
        } catch (err) {
            console.error('Trade denial notification error:', err);
            await interaction.reply({ content: "Trade denied, but notification failed.", flags: 64 });
        }
        return;
    }
    await interaction.reply({ content: `Vote recorded. Approve: ${votes.approve.length}, Deny: ${votes.deny.length}.`, flags: 64 });
}

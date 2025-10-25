import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
import axios from 'axios';
import { Client, GatewayIntentBits } from 'discord.js';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Serve /data directory as static files
app.use('/data', express.static(path.join(__dirname, 'data')));
// API: Get Discord user by role ID
app.get('/api/discord-user-by-role/:roleId', async (req, res) => {
    try {
        const guildId = process.env.DISCORD_GUILD_ID;
        const roleId = req.params.roleId;
        console.log('[discord-user-by-role] Endpoint called for roleId:', roleId);
        console.log('[discord-user-by-role] Lookup for roleId:', roleId, 'in guild:', guildId);
        const guild = await discordClient.guilds.fetch(guildId);
        if (!guild) {
            console.error('[discord-user-by-role] Guild not found:', guildId);
            return res.status(404).json({ error: 'Guild not found' });
        }
        // Use only cached members for large servers
        const members = guild.members.cache;
        console.log('[discord-user-by-role] Using cached members:', members.size);
        const overarchingRole = '1428119680572325929';
        for (const member of members.values()) {
            if (!member.roles.cache.has(overarchingRole)) continue;
            const roleIds = Array.from(member.roles.cache.keys());
            console.log(`[discord-user-by-role] Checking member: ${member.user.username} (${member.user.id}) Roles:`, roleIds);
            if (member.roles.cache.has(roleId)) {
                console.log('[discord-user-by-role] Found user:', member.user.username, 'for roleId:', roleId);
                return res.json({ username: member.user.username, id: member.user.id });
            }
        }
        console.warn('[discord-user-by-role] No user found for roleId:', roleId);
        return res.status(404).json({ error: 'User not found for role' });
    } catch (err) {
        console.error('[discord-user-by-role] Internal server error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});
const PORT = 3001;

// Session middleware
app.use(session({ secret: 'your_secret', resave: false, saveUninitialized: true }));

// Discord OAuth2 login route
app.get('/api/auth/discord', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=1427783020949274636&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20guilds.members.read`;
    res.redirect(url);
});

// Discord OAuth2 callback route
app.get('/api/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.DISCORD_REDIRECT_URI,
            scope: 'identify guilds guilds.members.read'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenRes.data.access_token;

        // Get user info
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // Get member info in your guild (to check roles)
        // You will need to set DISCORD_GUILD_ID in your .env file
        const memberRes = await axios.get(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        console.log('Discord user info:', userRes.data);
        console.log('Discord member info:', memberRes.data);
        req.session.user = {
            id: userRes.data.id,
            username: userRes.data.username,
            avatar: userRes.data.avatar || null,
            roles: memberRes.data.roles // Array of role IDs
        };
        console.log('Session user set:', req.session.user);
        req.session.save(err => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).send('Session save failed');
            }
            res.redirect('/dashboard'); // Redirect to your dashboard
        });
    } catch (err) {
        console.error('Discord OAuth2 callback error:', err.response ? err.response.data : err);
        res.status(500).send('Discord login failed');
    }
});

// Serve static files FIRST so API routes are not blocked
app.use(express.static(path.join(__dirname, 'dashboard'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-store');
    }
}));

// --- Pending Trades API ---
const pendingTradesFile = path.join(__dirname, 'data', 'pendingTrades.json');

function readPendingTrades() {
    try {
        const data = fs.readFileSync(pendingTradesFile, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function writePendingTrades(trades) {
    fs.writeFileSync(pendingTradesFile, JSON.stringify(trades, null, 2));
}

// Get all pending trades
app.get('/api/pending-trades', (req, res) => {
    // Mark expired trades
    let archetypes = new Set();
    fs.readdirSync(rosterDir).forEach(file => {
        if (!file.endsWith('.json')) return;
        let data;
        try {
            data = JSON.parse(fs.readFileSync(path.join(rosterDir, file)));
            console.log('Read file:', file);
        } catch (err) {
            console.error('Error reading file:', file, err.message);
            return;
        }
        if (Array.isArray(data)) {
            data.forEach(player => {
                if (player.archetype) archetypes.add(player.archetype);
            });
        } else if (Array.isArray(data.players)) {
            data.players.forEach(player => {
                if (player.archetype) archetypes.add(player.archetype);
            });
        }
    });
    console.log('Archetypes found:', Array.from(archetypes));
    res.json(Array.from(archetypes).sort());
});

// Endpoint to get logged-in user info
app.get('/api/me', (req, res) => {
    res.json(req.session.user || null);
});

// Middleware to require staff role
function requireStaff(req, res, next) {
    if (req.session.user && req.session.user.roles && req.session.user.roles.includes(process.env.STAFF_ROLE_ID)) {
        return next();
    }
    res.status(403).send('Staff only');
}

// Example: Protect approve/reject endpoints
app.post('/api/pending-trades/approve/:idx', requireStaff, (req, res) => {
    // ...existing approve logic...
});
app.post('/api/pending-trades/reject/:idx', requireStaff, (req, res) => {
    // ...existing reject logic...
});

// --- Discord Bot Integration ---
const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });
discordClient.login(process.env.DISCORD_TOKEN);

// On bot ready, cache all members with the overarching role and any coach/staff roles
const COACH_ROLE_IDS = [
    // Add all coach role IDs from coachRoleMap.json here
    '1428100606622695485', '1428100611395817604', '1428100616982368367', '1428100621931778153',
    '1428100628017840128', '1428100633898127532', '1428100638486822913', '1428100644916428864',
    '1428100650423550074', '1428100655267971214', '1428100664516415548', '1428100669453242479',
    '1428100674750644345', '1428100680018559076', '1428100684892344552', '1428100690479284246',
    '1428100695416111165', '1428100700688351303', '1428100705776046211', '1428100710997954651',
    '1428100717243138061', '1428100723077419008', '1428100728194470012', '1428100733416374475',
    '1428100738566979594', '1428100744992788651', '1428100749966966784', '1428100754585026767',
    '1428100759936831639', '1428100764877848787'
];
const OVERARCHING_ROLE_ID = '1428119680572325929';
discordClient.on('ready', async () => {
    try {
        const guildId = process.env.DISCORD_GUILD_ID;
        const guild = await discordClient.guilds.fetch(guildId);
        // Fetch all members (requires Server Members Intent)
        await guild.members.fetch();
        let cached = 0;
        for (const member of guild.members.cache.values()) {
            let isCoach = false;
            let coachTeam = null;
            if (member.roles.cache.has(OVERARCHING_ROLE_ID)) {
                for (const [team, roleId] of Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'coachRoleMap.json'))))) {
                    if (member.roles.cache.has(roleId)) {
                        isCoach = true;
                        coachTeam = team;
                        break;
                    }
                }
            }
            if (isCoach) {
                cached++;
                console.log(`[discord-user-by-role] Cached coach: ${member.user.username} (${member.user.id}) for team: ${coachTeam}`);
            }
        }
        console.log(`[discord-user-by-role] Cached ${cached} coaches with overarching/coach roles on startup.`);
    } catch (err) {
        console.error('[discord-user-by-role] Error caching members on startup:', err);
    }
});
// Listen for DM replies from coaches for trade proposals
discordClient.on('messageCreate', async (msg) => {
    // Handle !signup command in any channel or DM
    if (msg.content.trim().toLowerCase() === '!signup') {
        // Build dashboard registration link (Discord OAuth)
        const dashboardUrl = `${process.env.DASHBOARD_URL || 'https://leaguebuddy.app'}/api/auth/discord`;
        try {
            await msg.author.send(`Welcome to LEAGUEbuddy! Please register your coach account here: ${dashboardUrl}`);
            if (msg.channel.type !== 1) {
                await msg.reply('Check your DMs for the registration link!');
            }
        } catch (err) {
            console.error('Error sending signup DM:', err);
            if (msg.channel.type !== 1) {
                await msg.reply('Could not DM you the registration link. Please make sure your DMs are open.');
            }
        }
        return;
    }

    // Only process DMs for trade accept/deny
    if (msg.channel.type !== 1) return; // 1 = DM
    const content = msg.content.trim().toLowerCase();
    if (content !== 'accept' && content !== 'deny') return;
    // ...existing code for trade accept/deny...
    const trades = readPendingTrades();
    const COACH_ROLE_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'coachRoleMap.json')));
    const guildId = process.env.DISCORD_GUILD_ID;
    const guild = await discordClient.guilds.fetch(guildId);
    const members = await guild.members.fetch();
    let coachTeam = null;
    for (const [team, roleId] of Object.entries(COACH_ROLE_MAP)) {
        const member = members.get(msg.author.id);
        if (member && member.roles.cache.has(roleId)) {
            coachTeam = team;
            break;
        }
    }
    if (!coachTeam) return;
    const idx = trades.findIndex(t => t.toTeam === coachTeam && t.status === 'pending');
    if (idx === -1) return;
    const trade = trades[idx];
    if (content === 'accept') {
        trade.status = 'accepted';
        trade.respondedAt = Date.now();
        writePendingTrades(trades);
        msg.reply('You have accepted the trade. It will now go to the committee for voting.');
        sendTradeToCommittee(trade);
    } else if (content === 'deny') {
        trade.status = 'denied';
        trade.respondedAt = Date.now();
        writePendingTrades(trades);
        msg.reply('You have denied the trade.');
    }
    // DM Coach A (fromTeam) about the result
    try {
        const roleIdA = COACH_ROLE_MAP[trade.fromTeam];
        let coachAId = null;
        for (const member of members.values()) {
            if (member.roles.cache.has(roleIdA)) {
                coachAId = member.user.id;
                break;
            }
        }
        if (coachAId) {
            const userA = await discordClient.users.fetch(coachAId);
            await userA.send(`Your trade with ${trade.toTeam} was ${trade.status}.`);
        }
    } catch (err) {
        console.error('Error DMing coach A:', err);
    }
});

const TRADE_COMMITTEE_CHANNEL_ID = '1425555499440410812'; // Committee channel

function sendTradeToCommittee(trade) {
    // Tag committee role and post trade for voting
    const COMMITTEE_ROLE_ID = '1428100787225235526';
    const channel = discordClient.channels.cache.get(TRADE_COMMITTEE_CHANNEL_ID);
    if (!channel) return;
    // Format trade summary
    const summary = `<@&${COMMITTEE_ROLE_ID}> New Trade Submitted:\n` +
        `${trade.fromTeam} sends: ${trade.players.join(', ')}${trade.picks.length ? ', ' + trade.picks.join(', ') : ''}\n` +
        `${trade.toTeam} sends: ${trade.playersTo.join(', ')}${trade.picksTo.length ? ', ' + trade.picksTo.join(', ') : ''}`;
    channel.send(summary).then(async msg => {
        await msg.react('✅');
        await msg.react('❌');
        // Store votes privately in memory
        const tradeVotes = {};
        const APPROVE_CHANNEL_ID = '1425555422063890443';
        const DENY_CHANNEL_ID = '1425567560241254520';
        discordClient.on('messageReactionAdd', async (reaction, user) => {
            if (reaction.message.id !== msg.id) return;
            if (user.bot) return;
            // Only allow committee role to vote
            const member = await reaction.message.guild.members.fetch(user.id);
            if (!member.roles.cache.has(COMMITTEE_ROLE_ID)) return;
            if (!tradeVotes[user.id]) tradeVotes[user.id] = null;
            if (reaction.emoji.name === '✅') {
                tradeVotes[user.id] = 'approve';
            } else if (reaction.emoji.name === '❌') {
                tradeVotes[user.id] = 'deny';
            }
            // Count votes privately (not shown in channel)
            const approveCount = Object.values(tradeVotes).filter(v => v === 'approve').length;
            const denyCount = Object.values(tradeVotes).filter(v => v === 'deny').length;
            if (approveCount >= 3 || denyCount >= 3) {
                // Update trade status in pendingTrades.json
                const trades = readPendingTrades();
                const idx = trades.findIndex(t => t.fromTeam === trade.fromTeam && t.toTeam === trade.toTeam && t.status === 'accepted');
                if (idx !== -1) {
                    trades[idx].status = approveCount >= 3 ? 'committee_approved' : 'committee_denied';
                    trades[idx].committeeRespondedAt = Date.now();
                    writePendingTrades(trades);
                }
                // Post to approve/deny channel
                const resultChannelId = approveCount >= 3 ? APPROVE_CHANNEL_ID : DENY_CHANNEL_ID;
                const resultChannel = discordClient.channels.cache.get(resultChannelId);
                if (resultChannel) {
                    await resultChannel.send(`${approveCount >= 3 ? 'Trade Approved' : 'Trade Denied'}:\n${summary}`);
                }
                // DM both coaches
                try {
                    const COACH_ROLE_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'coachRoleMap.json')));
                    const guildId = process.env.DISCORD_GUILD_ID;
                    const guild = await discordClient.guilds.fetch(guildId);
                    const members = await guild.members.fetch();
                    // Coach A
                    const roleIdA = COACH_ROLE_MAP[trade.fromTeam];
                    let coachAId = null;
                    for (const member of members.values()) {
                        if (member.roles.cache.has(roleIdA)) {
                            coachAId = member.user.id;
                            break;
                        }
                    }
                    // Coach B
                    const roleIdB = COACH_ROLE_MAP[trade.toTeam];
                    let coachBId = null;
                    for (const member of members.values()) {
                        if (member.roles.cache.has(roleIdB)) {
                            coachBId = member.user.id;
                            break;
                        }
                    }
                    const resultMsg = `Your trade between ${trade.fromTeam} and ${trade.toTeam} was ${approveCount >= 3 ? 'APPROVED' : 'DENIED'} by committee.`;
                    if (coachAId) {
                        const userA = await discordClient.users.fetch(coachAId);
                        await userA.send(resultMsg);
                    }
                    if (coachBId) {
                        const userB = await discordClient.users.fetch(coachBId);
                        await userB.send(resultMsg);
                    }
                } catch (err) {
                    console.error('Error DMing coaches after committee vote:', err);
                }
                msg.delete();
            }
        });
    });
}

// Catch-all 404 for any unknown API route
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// Serve dashboard index.html
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

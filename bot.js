import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import { Client, GatewayIntentBits } from 'discord.js';

const discordClient = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });
discordClient.login(process.env.DISCORD_TOKEN);

const COACH_ROLE_IDS = [
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

discordClient.on('messageCreate', async (msg) => {
    if (msg.content.trim().toLowerCase() === '!signup') {
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

    if (msg.channel.type !== 1) return;
    const content = msg.content.trim().toLowerCase();
    if (content !== 'accept' && content !== 'deny') return;
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

const TRADE_COMMITTEE_CHANNEL_ID = '1425555499440410812';

function sendTradeToCommittee(trade) {
    const COMMITTEE_ROLE_ID = '1428100787225235526';
    const channel = discordClient.channels.cache.get(TRADE_COMMITTEE_CHANNEL_ID);
    if (!channel) return;
    const summary = `<@&${COMMITTEE_ROLE_ID}> New Trade Submitted:\n` +
        `${trade.fromTeam} sends: ${trade.players.join(', ')}${trade.picks.length ? ', ' + trade.picks.join(', ') : ''}\n` +
        `${trade.toTeam} sends: ${trade.playersTo.join(', ')}${trade.picksTo.length ? ', ' + trade.picksTo.join(', ') : ''}`;
    channel.send(summary).then(async msg => {
        await msg.react('✅');
        await msg.react('❌');
        const tradeVotes = {};
        const APPROVE_CHANNEL_ID = '1425555422063890443';
        const DENY_CHANNEL_ID = '1425567560241254520';
        discordClient.on('messageReactionAdd', async (reaction, user) => {
            if (reaction.message.id !== msg.id) return;
            if (user.bot) return;
            const member = await reaction.message.guild.members.fetch(user.id);
            if (!member.roles.cache.has(COMMITTEE_ROLE_ID)) return;
            if (!tradeVotes[user.id]) tradeVotes[user.id] = null;
            if (reaction.emoji.name === '✅') {
                tradeVotes[user.id] = 'approve';
            } else if (reaction.emoji.name === '❌') {
                tradeVotes[user.id] = 'deny';
            }
            const approveCount = Object.values(tradeVotes).filter(v => v === 'approve').length;
            const denyCount = Object.values(tradeVotes).filter(v => v === 'deny').length;
            if (approveCount >= 3 || denyCount >= 3) {
                const trades = readPendingTrades();
                const idx = trades.findIndex(t => t.fromTeam === trade.fromTeam && t.toTeam === trade.toTeam && t.status === 'accepted');
                if (idx !== -1) {
                    trades[idx].status = approveCount >= 3 ? 'committee_approved' : 'committee_denied';
                    trades[idx].committeeRespondedAt = Date.now();
                    writePendingTrades(trades);
                }
                const resultChannelId = approveCount >= 3 ? APPROVE_CHANNEL_ID : DENY_CHANNEL_ID;
                const resultChannel = discordClient.channels.cache.get(resultChannelId);
                if (resultChannel) {
                    await resultChannel.send(`${approveCount >= 3 ? 'Trade Approved' : 'Trade Denied'}:\n${summary}`);
                }
                try {
                    const COACH_ROLE_MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'coachRoleMap.json')));
                    const guildId = process.env.DISCORD_GUILD_ID;
                    const guild = await discordClient.guilds.fetch(guildId);
                    const members = await guild.members.fetch();
                    const roleIdA = COACH_ROLE_MAP[trade.fromTeam];
                    let coachAId = null;
                    for (const member of members.values()) {
                        if (member.roles.cache.has(roleIdA)) {
                            coachAId = member.user.id;
                            break;
                        }
                    }
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

function readPendingTrades() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'pendingTrades.json')));
}
function writePendingTrades(trades) {
    fs.writeFileSync(path.join(__dirname, 'data', 'pendingTrades.json'), JSON.stringify(trades, null, 2));
}

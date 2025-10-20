

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { DataManager } from '../../utils/dataManager.js';
import { sendWelcomeAndButton, updateStandingsAndPlayoff } from '../../interactions/submit_score.js';
import fs from 'fs';

export const data = new SlashCommandBuilder()
    .setName('advanceweek')
    .setDescription('Advance the current week by 1, or specify a week to advance to')
    .addIntegerOption(option =>
        option.setName('week')
            .setDescription('The week number to advance to (optional)')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const TOTAL_WEEKS = 29;
// Updated dedicated channel for weekly game threads
const DEDICATED_CHANNEL_ID = '1428417230000885830';

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const dataManager = new DataManager();
    let season = dataManager.readData('season') || { currentWeek: 1, seasonNo: 1 };
    let weekNum = interaction.options.getInteger('week');
    if (!weekNum) weekNum = (season.currentWeek || 1) + 1;
    if (weekNum < 1 || weekNum > TOTAL_WEEKS) {
        await interaction.editReply({ content: `Invalid week number. Must be between 1 and ${TOTAL_WEEKS}.` });
        return;
    }
    let schedule = dataManager.readData('schedule') || [];
    const matchups = schedule[weekNum] || [];
    const guild = interaction.guild;
    // Try to fetch the dedicated channel (use fetch to ensure latest and handle uncached channels)
    let dedicatedChannel = null;
    try {
        dedicatedChannel = await guild.channels.fetch(DEDICATED_CHANNEL_ID);
    } catch (err) {
        console.error('[advanceweek] Failed to fetch dedicated channel:', err);
    }
    if (!dedicatedChannel) {
        await interaction.editReply({ content: `❌ Dedicated channel not found or bot lacks access. Check DISCORD_GUILD_ID, DEDICATED_CHANNEL_ID, and bot permissions.` });
        return;
    }
    // Ensure channel supports threads
    if (typeof dedicatedChannel.isTextBased === 'function' && !dedicatedChannel.isTextBased()) {
        await interaction.editReply({ content: '❌ Dedicated channel must be a text channel that supports threads.' });
        return;
    }
    let createdThreads = [];
    // Load gameInfo.json once
    let gameInfo = {};
    try {
        gameInfo = JSON.parse(fs.readFileSync('./data/gameInfo.json', 'utf8'));
    } catch (err) { gameInfo = {}; }
    for (const matchup of matchups) {
        // Use short team names for thread names to match coach role naming
        const team1Short = matchup.team1.name.replace('Milwaukee ', '').replace('Portland ', '').replace('Los Angeles ', '').replace('Golden State ', '').replace('New York ', '').replace('San Antonio ', '').replace('Oklahoma City ', '').replace('Charlotte ', '').replace('Philadelphia ', '').replace('Minnesota ', '').replace('Cleveland ', '').replace('Indiana ', '').replace('Sacramento ', '').replace('Toronto ', '').replace('New Orleans ', '').replace('Washington ', '').replace('Atlanta ', '').replace('Brooklyn ', '').replace('Chicago ', '').replace('Dallas ', '').replace('Denver ', '').replace('Detroit ', '').replace('Houston ', '').replace('LA ', '').replace('Memphis ', '').replace('Miami ', '').replace('Orlando ', '').replace('Phoenix ', '').replace('Utah ', '').replace('Boston ', '').replace('Clippers', 'Clippers').replace('Lakers', 'Lakers').replace('Trail Blazers', 'Trail Blazers').replace('Thunder', 'Thunder').replace('Spurs', 'Spurs').replace('Jazz', 'Jazz').replace('Wizards', 'Wizards').replace('Raptors', 'Raptors').replace('Kings', 'Kings').replace('Suns', 'Suns').replace('Magic', 'Magic').replace('Heat', 'Heat').replace('Grizzlies', 'Grizzlies').replace('Bucks', 'Bucks').replace('Mavericks', 'Mavericks').replace('Nuggets', 'Nuggets').replace('Pistons', 'Pistons').replace('Rockets', 'Rockets').replace('Pacers', 'Pacers').replace('Cavaliers', 'Cavaliers').replace('Timberwolves', 'Timberwolves').replace('76ers', '76ers').replace('Hornets', 'Hornets').replace('Bulls', 'Bulls').replace('Nets', 'Nets').replace('Hawks', 'Hawks').replace('Celtics', 'Celtics');
        const team2Short = matchup.team2.name.replace('Milwaukee ', '').replace('Portland ', '').replace('Los Angeles ', '').replace('Golden State ', '').replace('New York ', '').replace('San Antonio ', '').replace('Oklahoma City ', '').replace('Charlotte ', '').replace('Philadelphia ', '').replace('Minnesota ', '').replace('Cleveland ', '').replace('Indiana ', '').replace('Sacramento ', '').replace('Toronto ', '').replace('New Orleans ', '').replace('Washington ', '').replace('Atlanta ', '').replace('Brooklyn ', '').replace('Chicago ', '').replace('Dallas ', '').replace('Denver ', '').replace('Detroit ', '').replace('Houston ', '').replace('LA ', '').replace('Memphis ', '').replace('Miami ', '').replace('Orlando ', '').replace('Phoenix ', '').replace('Utah ', '').replace('Boston ', '').replace('Clippers', 'Clippers').replace('Lakers', 'Lakers').replace('Trail Blazers', 'Trail Blazers').replace('Thunder', 'Thunder').replace('Spurs', 'Spurs').replace('Jazz', 'Jazz').replace('Wizards', 'Wizards').replace('Raptors', 'Raptors').replace('Kings', 'Kings').replace('Suns', 'Suns').replace('Magic', 'Magic').replace('Heat', 'Heat').replace('Grizzlies', 'Grizzlies').replace('Bucks', 'Bucks').replace('Mavericks', 'Mavericks').replace('Nuggets', 'Nuggets').replace('Pistons', 'Pistons').replace('Rockets', 'Rockets').replace('Pacers', 'Pacers').replace('Cavaliers', 'Cavaliers').replace('Timberwolves', 'Timberwolves').replace('76ers', '76ers').replace('Hornets', 'Hornets').replace('Bulls', 'Bulls').replace('Nets', 'Nets').replace('Hawks', 'Hawks').replace('Celtics', 'Celtics');
        const threadName = `${team1Short}-vs-${team2Short}-w${weekNum}`;
        try {
            const thread = await dedicatedChannel.threads.create({
                name: threadName,
                autoArchiveDuration: 1440,
                reason: `Game thread for ${threadName} (Week ${weekNum})`
            });
            createdThreads.push(threadName);
            await sendWelcomeAndButton(thread, thread.id, gameInfo);
        } catch (err) {
            console.error(`[advanceweek] Error creating thread:`, err);
        }
    }
    season.currentWeek = weekNum;
    const writeSuccess = dataManager.writeData('season', season);
    if (writeSuccess) {
        console.log(`[advanceweek] Successfully wrote currentWeek=${weekNum} to season.json`);
    } else {
        console.error(`[advanceweek] FAILED to write currentWeek=${weekNum} to season.json`);
    }
    // After advancing week, update standings
    try {
        await updateStandingsAndPlayoff(interaction.guild);
        await interaction.editReply({ content: `Week advanced! Current week is now ${season.currentWeek}. Created ${createdThreads.length}/${matchups.length} threads in the dedicated channel. Standings updated.` });
    } catch (err) {
        console.error('[advanceweek] Failed to update standings:', err);
        await interaction.editReply({ content: `Week advanced! Current week is now ${season.currentWeek}. Created ${createdThreads.length}/${matchups.length} threads in the dedicated channel. (Standings update failed)` });
    }
}

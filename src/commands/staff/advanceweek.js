
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import fs from 'fs';
import { sendWelcomeAndButton } from '../../interactions/submit_score.js';

export const data = new SlashCommandBuilder()
    .setName('advanceweek')
    .setDescription('Advance the current week by 1, or specify a week to advance to')
    .addIntegerOption(option =>
        option.setName('week')
            .setDescription('The week number to advance to (optional)')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const SEASON_FILE = './data/season.json';
const SCHEDULE_FILE = './data/schedule.json';
const TOTAL_WEEKS = 29;

export async function execute(interaction) {
    await interaction.deferReply();
    try {
        // Read season.json
        let season;
        try {
            season = JSON.parse(fs.readFileSync(SEASON_FILE, 'utf8'));
        } catch {
            season = { currentWeek: 1, seasonNo: 1, coachRoleMap: {} };
        }
        // Get week number from option or increment
        let weekNum = interaction.options.getInteger('week');
        if (!weekNum) {
            weekNum = (season.currentWeek || 1) + 1;
        }
        if (weekNum < 1 || weekNum > TOTAL_WEEKS) {
            await interaction.editReply({ content: `Invalid week number. Must be between 1 and ${TOTAL_WEEKS}.` });
            return;
        }
        // Update backend
        season.currentWeek = weekNum;
        fs.writeFileSync(SEASON_FILE, JSON.stringify(season, null, 2));
        // Read schedule for the week
        let schedule;
        try {
            schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
        } catch {
            schedule = [];
        }
        const matchups = schedule[weekNum] || [];

        console.log(`[advanceweek] Creating game channels for week ${weekNum}, total matchups: ${matchups.length}`);
        let createdChannels = [];
        // Create a category for the week
        const guild = interaction.guild;
        const weekCategoryName = `Week ${weekNum} Games`;
        let weekCategory = guild.channels.cache.find(c => c.name === weekCategoryName && c.type === ChannelType.GuildCategory);
        if (!weekCategory) {
            weekCategory = await guild.channels.create({
                name: weekCategoryName,
                type: ChannelType.GuildCategory
            });
        }

        // Batch channel creation
        const batchSize = 5;
        for (let i = 0; i < matchups.length; i += batchSize) {
            const batch = matchups.slice(i, i + batchSize);
            for (const matchup of batch) {
                try {
                    const chanName = `${matchup.team1.abbreviation.toLowerCase()}-vs-${matchup.team2.abbreviation.toLowerCase()}`;
                    let gameChannel = guild.channels.cache.find(c => c.name === chanName && c.parentId === weekCategory.id);
                    if (!gameChannel) {
                        gameChannel = await guild.channels.create({
                            name: chanName,
                            type: ChannelType.GuildText,
                            parent: weekCategory.id
                        });
                        createdChannels.push(chanName);
                    }
                    await sendWelcomeAndButton(gameChannel, weekNum, season.seasonNo);
                } catch (err) {
                    console.error(`[advanceweek] Error creating channel or sending message:`, err);
                }
            }
            // Progress update after each batch
            await interaction.followUp({ content: `Created ${createdChannels.length}/${matchups.length} channels...`, ephemeral: true });
            await new Promise(res => setTimeout(res, 1500));
        }
        console.log(`[advanceweek] All channels created:`, createdChannels);
        await interaction.editReply({ content: `Week advanced! Current week is now ${season.currentWeek}. All game channels created.` });
    } catch (err) {
        console.error('[advanceweek] Error:', err);
        await interaction.editReply({ content: 'Error advancing week.' });
    }
}


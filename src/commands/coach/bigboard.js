import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const data = new SlashCommandBuilder()
    .setName('bigboard')
    .setDescription('View and manage your personal draft big board (reorder your scouted players)');

export async function execute(interaction) {
    const now = new Date();
    console.log(`[myscouts] Command received at ${now.toISOString()} from user ${interaction.user.username} (${interaction.user.id})`);
    await interaction.deferReply({ ephemeral: true }); // Always defer immediately
    try {
        // Use season.json to check current week
        const seasonPath = path.join(process.cwd(), 'data/season.json');
        const seasonData = JSON.parse(fs.readFileSync(seasonPath, 'utf8'));
        const currentWeek = seasonData.currentWeek ?? 0;
        if (currentWeek < 1) {
            await interaction.editReply({ content: 'Scouting features unlock in Week 1. Only the recruit board is available during preseason.' });
            return;
        }

        const userId = interaction.user.id;
        const scoutPath = path.join(process.cwd(), 'data/scout_points.json');
        if (!fs.existsSync(scoutPath)) {
            await interaction.editReply({ content: 'No scouting data found.' });
            return;
        }

        // Load and ensure user data structure
        const scoutData = JSON.parse(fs.readFileSync(scoutPath, 'utf8'));
        if (!scoutData[userId]) {
            scoutData[userId] = { playersScouted: {}, weeklyPoints: {}, bigBoardOrder: [] };
        }
        const userData = scoutData[userId];
        if (!userData.playersScouted) userData.playersScouted = {};
        if (!userData.bigBoardOrder) userData.bigBoardOrder = [];

        // If user has no scouted players
        const scoutedNames = Object.keys(userData.playersScouted);
        if (scoutedNames.length === 0) {
            await interaction.editReply({ content: 'You have not scouted any players yet.' });
            return;
        }

        // Only allow scouted players (by name) on big board
        let changed = false;
        userData.bigBoardOrder = userData.bigBoardOrder.filter(name => scoutedNames.includes(name));
        // Add any missing scouted players to the end
        for (const name of scoutedNames) {
            if (!userData.bigBoardOrder.includes(name)) {
                userData.bigBoardOrder.push(name);
                changed = true;
            }
        }
        if (changed) {
            fs.writeFileSync(scoutPath, JSON.stringify(scoutData, null, 2));
        }

        // Use prospectBoards.json for board file selection
        let phase = 'pre';
        if (currentWeek >= 20) phase = 'final';
        else if (currentWeek >= 10) phase = 'mid';
        const prospectBoardsPath = path.join(process.cwd(), 'data/prospectBoards.json');
        const prospectBoards = JSON.parse(fs.readFileSync(prospectBoardsPath, 'utf8'));
        const boardFile = prospectBoards[phase];
        let boardData = {};
        if (!boardFile) {
            await interaction.editReply({ content: `No board file configured for phase: ${phase}. Please contact staff if this is unexpected.` });
            return;
        }
        const boardPath = path.join(process.cwd(), boardFile);
        try {
            boardData = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
        } catch (err) {
            await interaction.editReply({ content: `Could not load the board file for phase: ${phase}. Please contact staff if this is unexpected.` });
            return;
        }
        // Build a map of name->player for the current phase
        const currentBoardNameMap = {};
        Object.values(boardData).forEach(p => { if (p && p.name) currentBoardNameMap[p.name] = p; });

        const embed = new EmbedBuilder()
            .setTitle('Your Personal Draft Big Board')
            .setDescription('Use the ⬆️⬇️ buttons to reorder your board for the draft!')
            .setColor(0x1e90ff);

        // Show players in user-defined order
        const components = [];
        userData.bigBoardOrder.forEach((playerName, idx) => {
            const player = Object.values(boardData).find(p => p.name === playerName);
            if (!player) {
                embed.addFields({ name: `#${idx + 1}: ${playerName}`, value: 'Not available this phase.' });
                return;
            }
            // Use playerName directly for unlocks
            const unlocked = userData.playersScouted[playerName] || [];
            const fields = [];
            if (unlocked.includes('overall')) fields.push(`Overall: ${player.overall}`);
            if (unlocked.includes('potential')) fields.push(`Potential: ${player.potential}`);
            if (unlocked.includes('draft_score')) fields.push(`Draft Score: ${player.draft_score}`);
            if (unlocked.includes('build')) fields.push(`Build: ${player.build}`);
            embed.addFields({ name: `#${idx + 1}: ${player.position_1} ${player.name} - ${player.team}`, value: fields.join(' | ') });
        });

        // Build select menu for player selection
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('bigboard_select_player')
            .setPlaceholder('Select a player to move')
            .addOptions(userData.bigBoardOrder.map((playerName, idx) => {
                const player = Object.values(boardData).find(p => p.name === playerName);
                return {
                    label: `#${idx + 1}: ${playerName}`,
                    value: playerName
                };
            }))
            .setMinValues(1)
            .setMaxValues(1);
        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        // Add move up/down buttons (act on selected player)
        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('bigboard_move_up')
                .setLabel('⬆️ Move Up')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('bigboard_move_down')
                .setLabel('⬇️ Move Down')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.editReply({ embeds: [embed], components: [selectRow, buttonRow] });
    } catch (err) {
        console.error('❌ Error in /bigboard:', err);
        // Only try to reply if not already replied
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            } catch { }
        } else {
            try {
                await interaction.editReply({ content: 'There was an error while executing this command!' });
            } catch { }
        }
    }
}

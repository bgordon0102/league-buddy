import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import fs from 'fs';

import path from 'path';

const SEASON_FILE = './data/season.json';
const PLAYERS_FILE = './data/players.json';

function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const data = new SlashCommandBuilder()
    .setName('bigboard')
    .setDescription('View the big board')
    .addStringOption(option =>
        option.setName('board')
            .setDescription('Which board to view')
            .setRequired(true)
            .addChoices(
                { name: 'Pre Big Board', value: 'pre' },
                { name: 'Mid Big Board', value: 'mid' },
                { name: 'Final Big Board', value: 'final' }
            ));

export async function execute(interaction) {
    const board = interaction.options.getString('board');
    let responded = false;
    try {
        await interaction.deferReply();
        // Read season data for current week
        if (!fs.existsSync(SEASON_FILE)) {
            if (!responded) {
                responded = true;
                await interaction.editReply({ content: 'Season file not found.' });
            }
            return;
        }

        const season = readJSON(SEASON_FILE);
        const currentWeek = season.currentWeek || 0;

        // Check unlock rules
        const unlockWeeks = { pre: 1, mid: 10, final: 20 };
        if (currentWeek < unlockWeeks[board]) {
            if (!responded) {
                responded = true;
                await interaction.editReply({
                    content: `🔒 This board is locked until Week ${unlockWeeks[board]}. Current week: ${currentWeek}`
                });
            }
            return;
        }

        // Read board file paths from prospectBoards.json
        const prospectBoardsPath = path.join(process.cwd(), 'data/prospectBoards.json');
        if (!fs.existsSync(prospectBoardsPath)) {
            if (!responded) {
                responded = true;
                await interaction.editReply({ content: 'Prospect boards file not found.' });
            }
            return;
        }
        const prospectBoards = readJSON(prospectBoardsPath);
        let boardFilePath = prospectBoards[board];
        if (!boardFilePath) {
            if (!responded) {
                responded = true;
                await interaction.editReply({ content: `${board} board file not found in prospectBoards.json.` });
            }
            return;
        }
        // Always resolve to absolute path
        if (!path.isAbsolute(boardFilePath)) {
            boardFilePath = path.join(process.cwd(), boardFilePath);
        }
        if (!fs.existsSync(boardFilePath)) {
            if (!responded) {
                responded = true;
                await interaction.editReply({ content: `${board} board file not found at resolved path: ${boardFilePath}` });
            }
            return;
        }

        // Read the actual big board data
        let bigBoardData;
        try {
            bigBoardData = readJSON(boardFilePath);
        } catch (e) {
            console.error('Failed to parse board file:', e);
            if (!responded) {
                responded = true;
                await interaction.editReply({ content: `Failed to parse ${board} board file.` });
            }
            return;
        }
        // Get all players for the board
        const allPlayers = Object.values(bigBoardData).filter(player =>
            player && player.name && player.position_1
        );
        if (allPlayers.length === 0) {
            if (!responded) {
                responded = true;
                await interaction.editReply({ content: `No players found in ${board} board.` });
            }
            return;
        }

        // Determine number of select menus
        let numMenus = 1;
        if (board === 'pre') numMenus = 2;
        else if (board === 'mid') numMenus = 3;
        else if (board === 'final') numMenus = 4;

        // Set embed title based on phase
        let boardTitle = '';
        if (board === 'pre') boardTitle = 'Pre-Season Board';
        else if (board === 'mid') boardTitle = 'Mid-Season Board';
        else if (board === 'final') boardTitle = 'Final Board';

        // Create embed with all players in one clean list
        const embed = new EmbedBuilder()
            .setTitle(`📋 ${boardTitle}`)
            .setColor(0x1f8b4c)
            .setDescription(`Week ${currentWeek} • ${allPlayers.length} players available`);

        const playerLines = allPlayers.map((player, index) => `${index + 1}: ${player.position_1} ${player.name} - ${player.team}`);
        embed.addFields({ name: 'Players', value: playerLines.length ? playerLines.join('\n') : 'No players available' });

        // Create all select menus for this board
        const components = [];
        for (let i = 0; i < numMenus; i++) {
            const startIdx = i * 15;
            const boardPlayers = allPlayers.slice(startIdx, startIdx + 15);
            if (boardPlayers.length === 0) continue;
            let customId = 'bigboard_select';
            if (i > 0) customId = `bigboard_select_${i + 1}`;
            const selectOptions = boardPlayers.map((player, idx) => ({
                label: `${startIdx + idx + 1}. ${player.name}`,
                description: `${player.position_1} - ${player.team}`,
                value: player.id_number.toString()
            }));
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(customId)
                .setPlaceholder(`Select a player to view their card (${startIdx + 1}-${startIdx + boardPlayers.length})`)
                .addOptions(selectOptions);
            const row = new ActionRowBuilder().addComponents(selectMenu);
            components.push(row);
        }

        if (!responded) {
            responded = true;
            await interaction.editReply({
                embeds: [embed],
                components
            });
        }
    } catch (err) {
        // Enhanced error logging for debugging
        console.error('bigboard.js error:', err && err.stack ? err.stack : err);
        if (!responded) {
            responded = true;
            try {
                await interaction.editReply({ content: 'Error loading big board.' });
            } catch (e) {
                console.error('Failed to send error message:', e && e.stack ? e.stack : e);
            }
        }
    }
}

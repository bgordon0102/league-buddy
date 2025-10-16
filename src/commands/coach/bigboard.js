import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const data = new SlashCommandBuilder()
    .setName('bigboard')
    .setDescription('View the big board');

export async function execute(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const seasonPath = path.join(process.cwd(), 'data/season.json');
        const seasonData = JSON.parse(fs.readFileSync(seasonPath, 'utf8'));
        const currentWeek = seasonData.currentWeek ?? 0;
        if (currentWeek < 1) {
            await interaction.editReply({ content: 'Big board and scouting features unlock in Week 1.' });
            return;
        }
        const boardFilePath = path.join(process.cwd(), 'draft classes/CUS01/2k26_CUS01 - Big Board.json');
        if (!fs.existsSync(boardFilePath)) {
            await interaction.editReply({ content: 'Big board file not found.' });
            return;
        }
        const bigBoardData = readJSON(boardFilePath);
        const allPlayers = Object.values(bigBoardData).filter(player => player && player.name && (player.position_1 || player.position));
        if (allPlayers.length === 0) {
            await interaction.editReply({ content: 'No players found in big board.' });
            return;
        }
        const playerLines = allPlayers.map((player, index) => {
            const pos = player.position_1 || player.position || '';
            const name = player.name || '';
            const team = player.team || player.college || '';
            return `${index + 1}: ${pos} ${name} - ${team}`;
        });
        // Create 4 select menus for groups of 15 players each
        const numMenus = 4;
        const components = [];
        for (let i = 0; i < numMenus; i++) {
            const startIdx = i * 15;
            const boardPlayers = allPlayers.slice(startIdx, startIdx + 15);
            if (boardPlayers.length === 0) continue;
            let customId = `bigboard_select_${i + 1}`;
            const selectOptions = boardPlayers.map((player, idx) => ({
                label: `${startIdx + idx + 1}. ${player.name}`,
                description: `${player.position_1 || player.position} - ${player.team || player.college}`,
                value: player.name
            }));
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(customId)
                .setPlaceholder(`Select a player (${startIdx + 1}-${startIdx + boardPlayers.length})`)
                .addOptions(selectOptions)
                .setMinValues(1)
                .setMaxValues(1);
            const row = new ActionRowBuilder().addComponents(selectMenu);
            components.push(row);
        }
        const embed = new EmbedBuilder()
            .setTitle('📋 Big Board')
            .setColor(0x1f8b4c)
            .setDescription(playerLines.length ? playerLines.join('\n') : 'No players available');
        await interaction.editReply({ embeds: [embed], components });
    } catch (err) {
        console.error('bigboard.js error:', err && err.stack ? err.stack : err);
        await interaction.editReply({ content: 'Error loading big board.' });
    }
}

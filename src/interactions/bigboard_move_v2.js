import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const customId = 'bigboard_move_v2';

export async function execute(interaction) {
    // This handler is for button presses (move up/down) with a selected player in the customId
    const userId = interaction.user.id;
    const scoutPath = path.join(process.cwd(), 'data/scout_points.json');
    if (!fs.existsSync(scoutPath)) {
        return await interaction.reply({ content: 'No scouting data found.', flags: 64 });
    }
    const scoutData = JSON.parse(fs.readFileSync(scoutPath, 'utf8'));
    const userData = scoutData[userId];
    if (!userData || !userData.bigBoardOrder || userData.bigBoardOrder.length === 0) {
        return await interaction.reply({ content: 'No big board found.', flags: 64 });
    }
    // Parse which player and direction from customId: e.g., bigboard_move_up:<playerId>
    const [baseId, playerName] = interaction.customId.split(':');
    let direction = null;
    if (baseId === 'bigboard_move_up') direction = 'up';
    if (baseId === 'bigboard_move_down') direction = 'down';
    if (!playerName) {
        return await interaction.reply({ content: 'Please select a player first.', flags: 64 });
    }
    const idx = userData.bigBoardOrder.indexOf(playerName);
    if (idx === -1) {
        return await interaction.reply({ content: 'Player not found in your big board.', flags: 64 });
    }
    if (!direction) {
        return await interaction.reply({ content: 'Invalid move action.', flags: 64 });
    }
    if (direction === 'up' && idx > 0) {
        [userData.bigBoardOrder[idx - 1], userData.bigBoardOrder[idx]] = [userData.bigBoardOrder[idx], userData.bigBoardOrder[idx - 1]];
    } else if (direction === 'down' && idx < userData.bigBoardOrder.length - 1) {
        [userData.bigBoardOrder[idx + 1], userData.bigBoardOrder[idx]] = [userData.bigBoardOrder[idx], userData.bigBoardOrder[idx + 1]];
    } else {
        return await interaction.reply({ content: 'Cannot move further in that direction.', flags: 64 });
    }
    // After move, always re-sync bigBoardOrder with playersScouted
    const scoutedNames = Object.keys(userData.playersScouted);
    userData.bigBoardOrder = userData.bigBoardOrder.filter(name => scoutedNames.includes(name));
    for (const name of scoutedNames) {
        if (!userData.bigBoardOrder.includes(name)) {
            userData.bigBoardOrder.push(name);
        }
    }
    fs.writeFileSync(scoutPath, JSON.stringify(scoutData, null, 2));

    // Rebuild the embed and components to reflect the new order
    // Load player data
    const seasonPath = path.join(process.cwd(), 'data/season.json');
    const seasonData = JSON.parse(fs.readFileSync(seasonPath, 'utf8'));
    const currentWeek = seasonData.currentWeek || 1;
    let phase = 'pre';
    if (currentWeek >= 20) phase = 'final';
    else if (currentWeek >= 10) phase = 'mid';
    const boardFile = seasonData.prospectBoards?.[phase];
    if (!boardFile) {
        return await interaction.reply({ content: `No board file configured for phase: ${phase}`, flags: 64 });
    }
    const boardPath = path.join(process.cwd(), boardFile);
    const boardData = JSON.parse(fs.readFileSync(boardPath, 'utf8'));

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = await import('discord.js');

    const embed = new EmbedBuilder()
        .setTitle('Your Personal Draft Big Board')
        .setDescription('Use the ⬆️⬇️ buttons to reorder your board for the draft!')
        .setColor(0x1e90ff);

    userData.bigBoardOrder.forEach((playerName, idx) => {
        const player = Object.values(boardData).find(p => p.name === playerName);
        if (!player) return;
        const unlocked = userData.playersScouted[playerName] || [];
        const fields = [];
        if (unlocked.includes('overall')) fields.push(`Overall: ${player.overall}`);
        if (unlocked.includes('potential')) fields.push(`Potential: ${player.potential}`);
        if (unlocked.includes('draft_score')) fields.push(`Draft Score: ${player.draft_score}`);
        if (unlocked.includes('build')) fields.push(`Build: ${player.build}`);
        embed.addFields({ name: `#${idx + 1}: ${player.position_1} ${player.name} - ${player.team}`, value: fields.join(' | ') });
    });

    // Build select menu for player selection, keep the same player selected
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('bigboard_select_player')
        .setPlaceholder('Select a player to move')
        .addOptions(userData.bigBoardOrder.map((name, idx) => {
            const player = Object.values(boardData).find(p => p.name === name);
            const opt = new StringSelectMenuOptionBuilder()
                .setLabel(`#${idx + 1}: ${player ? player.name : name}`)
                .setValue(name);
            if (name === playerName) opt.setDefault(true);
            return opt;
        }))
        .setMinValues(1)
        .setMaxValues(1);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Add move up/down buttons (act on selected player)
    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('bigboard_move_up:' + playerName)
            .setLabel('⬆️ Move Up')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('bigboard_move_down:' + playerName)
            .setLabel('⬇️ Move Down')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.update({ embeds: [embed], components: [selectRow, buttonRow] });
}

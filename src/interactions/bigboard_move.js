import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const customId = 'bigboard_move';

export async function execute(interaction) {
    const userId = interaction.user.id;
    const scoutPath = path.join(process.cwd(), 'data/scout_points.json');
    if (!fs.existsSync(scoutPath)) {
        return await interaction.reply({ content: 'No scouting data found.', ephemeral: true });
    }
    const scoutData = JSON.parse(fs.readFileSync(scoutPath, 'utf8'));
    const userData = scoutData[userId];
    if (!userData || !userData.bigBoardOrder || userData.bigBoardOrder.length === 0) {
        return await interaction.reply({ content: 'No big board found.', ephemeral: true });
    }

    // Parse which player and direction
    const [prefix, playerId, direction] = interaction.customId.split(':');
    const idx = userData.bigBoardOrder.indexOf(playerId);
    if (idx === -1) {
        return await interaction.reply({ content: 'Player not found in your big board.', ephemeral: true });
    }
    if (direction === 'up' && idx > 0) {
        [userData.bigBoardOrder[idx - 1], userData.bigBoardOrder[idx]] = [userData.bigBoardOrder[idx], userData.bigBoardOrder[idx - 1]];
    } else if (direction === 'down' && idx < userData.bigBoardOrder.length - 1) {
        [userData.bigBoardOrder[idx + 1], userData.bigBoardOrder[idx]] = [userData.bigBoardOrder[idx], userData.bigBoardOrder[idx + 1]];
    }
    fs.writeFileSync(scoutPath, JSON.stringify(scoutData, null, 2));
    await interaction.reply({ content: 'Big board updated! Use /bigboard to see your new order.', ephemeral: true });
}

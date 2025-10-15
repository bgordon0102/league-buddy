export const customId = "bigboard_select_4";
import fs from "fs";
import path from "path";
import { EmbedBuilder } from "discord.js";

// This handler is for page 4 (46-60)
const bigBoardsFile = path.join(process.cwd(), "data/prospectBoards.json");

export async function execute(interaction) {
    await interaction.deferUpdate();
    // Get which board is active from the message embed title
    const boardTitle = interaction.message.embeds[0]?.title || "";
    let board = "final";
    if (boardTitle.includes("Mid Prospect")) board = "mid";
    else if (boardTitle.includes("Pre Prospect")) board = "pre";

    const prospectBoards = JSON.parse(fs.readFileSync(prospectBoardsFile, 'utf8'));
    const bigBoards = JSON.parse(fs.readFileSync(bigBoardsFile, 'utf8'));
    let boardFilePath = bigBoards[board];
    if (!boardFilePath) {
        await interaction.editReply({ content: `Board file for phase '${board}' not found.`, flags: 64 });
        return;
    }
    if (!path.isAbsolute(boardFilePath)) {
        boardFilePath = path.join(process.cwd(), boardFilePath);
    }
    if (!fs.existsSync(boardFilePath)) {
        await interaction.editReply({ content: `Board file not found at resolved path: ${boardFilePath}`, flags: 64 });
        return;
    }
    const bigBoardData = JSON.parse(fs.readFileSync(boardFilePath, 'utf8'));
    const allPlayers = Object.values(bigBoardData).filter(player => player && player.name && player.position_1);

    // Page 4: 46-60
    const players = allPlayers.slice(45, 60);
    const selected = players.find(p => p.id_number.toString() === interaction.values[0]);
    if (!selected) return await interaction.editReply({ content: "Player not found.", flags: 64 });

    const strengths = [selected.strength_1, selected.strength_2, selected.strength_3].filter(Boolean).join(", ") || "N/A";
    const weaknesses = [selected.weakness_1, selected.weakness_2, selected.weakness_3].filter(Boolean).join(", ") || "N/A";

    // Load scouting data for the requesting coach
    const userId = interaction.user.id;
    const scoutPath = path.join(process.cwd(), 'data/scout_points.json');
    let scoutData = fs.existsSync(scoutPath) ? JSON.parse(fs.readFileSync(scoutPath, 'utf8')) : {};
    const userData = scoutData[userId] || { playersScouted: {} };
    const unlocked = userData.playersScouted[selected.name] || [];

    const embed = new EmbedBuilder()
        .setTitle(`${selected.position_1} - ${selected.name}`)
        .setThumbnail(selected.image || null)
        .addFields(
            { name: "Team", value: selected.team || "N/A", inline: true },
            { name: "Nationality", value: selected.nationality || "N/A", inline: true },
            { name: "Class", value: selected.class || "N/A", inline: true },
            { name: "Height", value: selected.height || "N/A", inline: true },
            { name: "Weight", value: selected.weight?.toString() || "N/A", inline: true },
            { name: "Wingspan", value: selected.wingspan || "N/A", inline: true },
            { name: "About", value: selected.about || "N/A" },
            { name: "Strengths", value: strengths, inline: true },
            { name: "Weaknesses", value: weaknesses, inline: true },
            { name: "Pro Comparison", value: selected.pro_comp || "N/A", inline: false }
        )
        .setColor("Green");

    // Add scouted info if unlocked
    const displayOrder = ['build', 'draft_score', 'overall', 'potential'];
    let info = [];
    displayOrder.forEach(cat => {
        if (unlocked.includes(cat) && selected[cat]) {
            if (cat === 'build') info.push(`**Build:** ${selected.build}`);
            if (cat === 'draft_score') info.push(`**Draft Score:** ${selected.draft_score}`);
            if (cat === 'overall') info.push(`**Overall:** ${selected.overall}`);
            if (cat === 'potential') info.push(`**Potential:** ${selected.potential}`);
        }
    });
    if (info.length > 0) {
        embed.addFields({ name: 'Scouted Info', value: info.join(' | '), inline: false });
    }

    await interaction.editReply({ embeds: [embed], flags: 64 });
}

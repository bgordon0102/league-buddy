export const customId = "prospectboard_select_2";
import fs from "fs";
import path from "path";
import { EmbedBuilder } from "discord.js";

// This handler is for page 2 (16-30)
const prospectBoardsFile = path.join(process.cwd(), "data/prospectBoards.json");

export async function execute(interaction) {
    await interaction.deferUpdate();
    // Get which board is active from the message embed title
    const boardTitle = interaction.message.embeds[0]?.title || "";
    let board = "pre";
    if (boardTitle.includes("Mid Prospect")) board = "mid";
    else if (boardTitle.includes("Final Prospect")) board = "final";

    const prospectBoards = JSON.parse(fs.readFileSync(prospectBoardsFile, 'utf8'));
    let boardFilePath = prospectBoards[board];
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

    // Page 2: 16-30
    const players = allPlayers.slice(15, 30);
    const selected = players.find(p => p.id_number.toString() === interaction.values[0]);
    if (!selected) return await interaction.editReply({ content: "Player not found.", flags: 64 });

    const strengths = [selected.strength_1, selected.strength_2, selected.strength_3].filter(Boolean).join(", ") || "N/A";
    const weaknesses = [selected.weakness_1, selected.weakness_2, selected.weakness_3].filter(Boolean).join(", ") || "N/A";

    const embed = new EmbedBuilder()
        .setTitle(`${selected.position_1} - ${selected.name}`)
        .setThumbnail(selected.image || null)
        .addFields(
            { name: "Team", value: selected.team || "N/A", inline: true },
            { name: "Class", value: selected.class || "N/A", inline: true },
            { name: "Age", value: selected.age?.toString() || "N/A", inline: true },
            { name: "Nationality", value: selected.nationality || "N/A", inline: true },
            { name: "Physicals", value: `**Ht:** ${selected.height || 'N/A'}  **Wt:** ${selected.weight?.toString() || 'N/A'}  **Wingspan:** ${selected.wingspan || 'N/A'}`, inline: false },
            { name: "About", value: selected.about || "N/A", inline: false },
            { name: "Strengths", value: strengths, inline: true },
            { name: "Weaknesses", value: weaknesses, inline: true },
            { name: "Pro Comp", value: selected.pro_comp || "N/A", inline: true }
        )
        .setColor("Green");

    await interaction.editReply({ embeds: [embed], flags: 64 });
}

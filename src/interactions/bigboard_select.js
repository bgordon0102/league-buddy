export const customId = "bigboard_select_1";
import fs from "fs";
import path from "path";
import { EmbedBuilder } from "discord.js";

const bigBoardsFile = path.join(process.cwd(), "data/prospectBoards.json");

export async function execute(interaction) {
    // Always use the same big board file
    const boardFilePath = path.join(process.cwd(), "draft classes/CUS01/2k26_CUS01 - Big Board.json");
    if (!fs.existsSync(boardFilePath)) {
        await interaction.reply({ content: `Big board file not found at resolved path: ${boardFilePath}`, flags: 64 });
        return;
    }
    const bigBoardData = JSON.parse(fs.readFileSync(boardFilePath, 'utf8'));
    const allPlayers = Object.values(bigBoardData).filter(player => player && player.name && player.position_1);

    // Page 1: 1-15
    const players = allPlayers.slice(0, 15);
    // Extract player name (remove leading number and dot if present)
    function normalize(str) {
        return str
            .replace(/^\d+\.\s*/, '')
            .trim()
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '');
    }
    const normalizedSelected = normalize(interaction.values[0]);
    const selected = players.find(p => p.name && normalize(p.name) === normalizedSelected);
    if (!selected) {
        console.log('Bigboard select debug: Selected value (raw):', interaction.values[0]);
        console.log('Bigboard select debug: Selected value (normalized):', normalizedSelected);
        console.log('Bigboard select debug: All normalized player names:', players.map(p => normalize(p.name)));
        console.log('Bigboard select debug: All raw player names:', players.map(p => p.name));
        await interaction.reply({ content: "Player not found.", flags: 64 });
        return;
    }

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

    await interaction.reply({ embeds: [embed], flags: 64 });
}

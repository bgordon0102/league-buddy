export const customId = "bigboard_select_4";
import fs from "fs";
import path from "path";
import { EmbedBuilder } from "discord.js";

// This handler is for page 4 (46-60)
const bigBoardsFile = path.join(process.cwd(), "draft classes", "2k26_CUS01 - Big Board.json");

export async function execute(interaction) {
    // Always use the same big board file
    if (!fs.existsSync(bigBoardsFile)) {
        await interaction.reply({ content: `Big board file not found at resolved path: ${bigBoardsFile}`, flags: 64 });
        return;
    }
    const bigBoardData = JSON.parse(fs.readFileSync(bigBoardsFile, 'utf8'));
    const allPlayers = Object.values(bigBoardData).filter(player => player && player.name && player.position_1);

    // Page 4: 46-60
    const players = allPlayers.slice(45, 60);
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
    // Debug logging for value matching
    console.log('Bigboard select 4 debug: Selected value (raw):', interaction.values[0]);
    console.log('Bigboard select 4 debug: Selected value (normalized):', normalizedSelected);
    console.log('Bigboard select 4 debug: All normalized player names:', players.map(p => normalize(p.name)));
    console.log('Bigboard select 4 debug: All raw player names:', players.map(p => p.name));
    const selected = players.find(p => p.name && normalize(p.name) === normalizedSelected);
    if (!selected) return await interaction.reply({ content: "Player not found.", flags: 64 });

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

    await interaction.reply({ embeds: [embed], flags: 64 });
}

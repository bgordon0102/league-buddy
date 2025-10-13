export const customId = "recruitboard_select_1";
// src/interactions/recruitboard_select.js
import fs from "fs";
import path from "path";
import { EmbedBuilder } from "discord.js";

const playersFile = path.join(process.cwd(), "CUS01/2k26_CUS01 - Recruiting.json");

export async function execute(interaction) {
    const playersData = JSON.parse(fs.readFileSync(playersFile));
    const players = Object.values(playersData);

    // Identify which player was selected
    const selected = players.find(p => p.national_rank.toString() === interaction.values[0]);
    if (!selected) {
        const msg = { content: "Player not found.", ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            try { await interaction.editReply(msg); } catch (err) { if (err.code === 40060) await interaction.followUp(msg); else throw err; }
        } else {
            try { await interaction.reply(msg); } catch (err) { if (err.code === 40060) await interaction.followUp(msg); else throw err; }
        }
        return;
    }

    // Convert star rating to emojis
    const stars = "⭐".repeat(selected["star rating"]);

    // Show 🍔 if All-American
    const allAmerican = selected.all_american === "yes" ? "🍔" : "";

    const embed = new EmbedBuilder()
        .setTitle(`${selected.name} — ${selected.position}`)
        .setThumbnail(selected.image || null)
        .addFields(
            { name: "College", value: selected.college, inline: true },
            { name: "Hometown", value: selected.hometown, inline: true },
            { name: "Height / Weight", value: `${selected.height} / ${selected.weight}`, inline: true },
            { name: "National / Positional Rank", value: `${selected.national_rank} / ${selected.positional_rank}`, inline: true },
            { name: "All-American", value: allAmerican || "—", inline: true },
            { name: "Grade", value: selected.grade.toString(), inline: true },
            { name: "Star Rating", value: stars, inline: true }
        )
        .setColor("Green");

    const msg = { embeds: [embed], ephemeral: true };
    if (interaction.deferred || interaction.replied) {
        try { await interaction.editReply(msg); } catch (err) { if (err.code === 40060) await interaction.followUp(msg); else throw err; }
    } else {
        try { await interaction.reply(msg); } catch (err) { if (err.code === 40060) await interaction.followUp(msg); else throw err; }
    }
}
// removed stray closing brace

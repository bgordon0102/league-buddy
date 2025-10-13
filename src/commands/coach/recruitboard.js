// src/commands/coach/recruitboard.js
import fs from "fs";
import path from "path";
import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from "discord.js";

const playersFile = path.join(process.cwd(), "CUS01/2k26_CUS01 - Recruiting.json");

export const data = new SlashCommandBuilder()
    .setName("recruitboard")
    .setDescription("View the recruiting board");

export async function execute(interaction) {
    const playersData = JSON.parse(fs.readFileSync(playersFile));

    // Convert object to sorted array by national rank
    const players = Object.values(playersData).sort((a, b) => a.national_rank - b.national_rank);

    // Embed listing all 50 players
    const listEmbed = new EmbedBuilder()
        .setTitle("ESPN's Top 50 Recruits")
        .setDescription(
            players.map(p => `${p.national_rank}: ${p.position} ${p.name} - ${p.college}`).join("\n")
        )
        .setColor("Blue");

    // Split into two select menus: 1-25, 26-50
    const menu1 = new StringSelectMenuBuilder()
        .setCustomId("recruitboard_select_1")
        .setPlaceholder("Select a player (1-25)")
        .addOptions(
            players.slice(0, 25).map(p => ({
                label: `${p.name} (${p.position})`,
                description: `${p.college}`,
                value: p.national_rank.toString(),
            }))
        );

    const menu2 = new StringSelectMenuBuilder()
        .setCustomId("recruitboard_select_2")
        .setPlaceholder("Select a player (26-50)")
        .addOptions(
            players.slice(25, 50).map(p => ({
                label: `${p.name} (${p.position})`,
                description: `${p.college}`,
                value: p.national_rank.toString(),
            }))
        );

    const row1 = new ActionRowBuilder().addComponents(menu1);
    const row2 = new ActionRowBuilder().addComponents(menu2);

    await interaction.reply({ embeds: [listEmbed], components: [row1, row2], flags: 64 });
}

// src/commands/coach/recruitboard.js
import fs from "fs";
import path from "path";
import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from "discord.js";

const playersFile = path.join(process.cwd(), "CUS01/2k26_CUS01 - Recruiting.json");

export const data = new SlashCommandBuilder()
    .setName("recruitboard")
    .setDescription("View the recruiting board");

export async function execute(interaction) {
    let responded = false;
    try {
        await interaction.deferReply({ ephemeral: true });
        const playersData = JSON.parse(fs.readFileSync(playersFile));
        const players = Object.values(playersData).sort((a, b) => a.national_rank - b.national_rank);
        const listEmbed = new EmbedBuilder()
            .setTitle("ESPN's Top 50 Recruits")
            .setDescription(
                players.map(p => `${p.national_rank}: ${p.position} ${p.name} - ${p.college}`).join("\n")
            )
            .setColor("Blue");
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
        if (!responded) {
            responded = true;
            await interaction.editReply({ embeds: [listEmbed], components: [row1, row2] });
        }
    } catch (err) {
        console.error('recruitboard.js error:', err);
        if (!responded) {
            responded = true;
            await interaction.editReply({ content: 'Failed to load recruit board.' });
        }
    }
}

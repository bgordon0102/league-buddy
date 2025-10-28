// Handles upgrade modal submission, posts to progression/regression channel
import fs from "fs";
import path from "path";
import { EmbedBuilder } from "discord.js";

// Channel IDs (replace with your actual channel IDs)
const PROGRESSION_CHANNEL_ID = "1425555037328773220";
const REGRESSION_CHANNEL_ID = "1425555499440410812";

export const customId = "upgrade_modal_submit";

export async function execute(interaction) {
    if (!interaction.isModalSubmit() || interaction.customId !== "upgrade_modal_submit") return;
    const playerName = interaction.fields.getTextInputValue("playerName");
    const upgradeDetails = interaction.fields.getTextInputValue("upgradeDetails");
    // You can add more fields if needed

    // Build embed for progression/regression request
    const embed = new EmbedBuilder()
        .setTitle("Progression/Upgrade Request")
        .addFields(
            { name: "Player Name", value: playerName },
            { name: "Details", value: upgradeDetails }
        )
        .setColor(0x00FF00);

    // Post to progression channel
    const channel = await interaction.client.channels.fetch(PROGRESSION_CHANNEL_ID);
    if (channel) {
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: `Upgrade request for ${playerName} submitted to progression channel.`, ephemeral: true });
    } else {
        await interaction.reply({ content: `Error: Progression channel not found.`, ephemeral: true });
    }
}

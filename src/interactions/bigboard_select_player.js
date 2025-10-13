
import { ActionRowBuilder } from 'discord.js';

export const customId = 'bigboard_select_player';

export async function execute(interaction) {
    // Get the selected player ID from the select menu
    const selectedPlayerId = interaction.values[0];

    // Clone the current message components
    const components = interaction.message.components.map(row => ActionRowBuilder.from(row));

    // Update the select menu to keep the selected value highlighted
    for (const row of components) {
        for (const component of row.components) {
            if (component.data && component.data.custom_id === 'bigboard_select_player') {
                // Rebuild options using StringSelectMenuOptionBuilder
                if (component.options) {
                    const { StringSelectMenuOptionBuilder } = await import('discord.js');
                    component.options = component.options.map(opt => {
                        const builder = new StringSelectMenuOptionBuilder(opt.data ?? opt);
                        if (opt.value === selectedPlayerId) builder.setDefault(true);
                        else builder.setDefault(false);
                        return builder;
                    });
                }
            }
            // Update the custom_id of the buttons to include the selected player
            if (component.data && (component.data.custom_id === 'bigboard_move_up' || component.data.custom_id === 'bigboard_move_down')) {
                component.setCustomId(component.data.custom_id + ':' + selectedPlayerId);
            }
        }
    }

    // Edit the message to update the components with the selected player context
    await interaction.update({
        components,
    });
}

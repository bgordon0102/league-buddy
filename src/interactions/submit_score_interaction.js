// Legacy submit_score interaction stub (disabled)
// This file is intentionally disabled to avoid duplicate registration of the 'submit_score' interaction.
// If you need the legacy implementation for reference, see the git history. Do not export `customId='submit_score'` here.

export const customId = 'submit_score_legacy_disabled';
export async function execute(interaction) {
    console.log('[submit_score_legacy_disabled] This legacy handler is disabled.');
    return interaction.reply({ content: 'This legacy submit handler has been disabled on the bot. If you see this message, please contact an admin.', ephemeral: true });
}

export const modalCustomId = 'submit_score_modal_legacy_disabled';
export async function handleModal(interaction) {
    console.log('[submit_score_legacy_disabled] handleModal called but legacy modal handler is disabled.');
    return interaction.reply({ content: 'Legacy modal handler disabled.', ephemeral: true });
}

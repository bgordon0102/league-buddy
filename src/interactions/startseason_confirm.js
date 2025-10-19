console.log('[startseason_confirm] File loaded and registered.');
import { ButtonInteraction } from 'discord.js';

const SEASON_FILE = './data/season.json';
const TEAMS_FILE = './data/teams.json';
const LEAGUE_FILE = './data/league.json';
const PLAYERS_FILE = './data/players.json';
// const BIGBOARD_FILE = './data/bigboard.json'; // REMOVED: No longer used
const SCOUTING_FILE = './data/scouting.json';
const RECRUITS_FILE = './data/recruits.json';

export const customId = /^startseason_confirm/;

export async function execute(interaction) {
    // Diagnostic: log entry to handler
    console.log('[startseason_confirm] Handler entered. customId:', interaction.customId, 'user:', interaction.user?.id);
    try {
        if (!(interaction instanceof ButtonInteraction)) return;
        // Only acknowledge the button interaction ONCE
        let seasonno = null;
        if (interaction.customId && interaction.customId.startsWith('startseason_confirm_')) {
            const parts = interaction.customId.split('_');
            seasonno = parseInt(parts[2], 10);
        }
        let success = false;
        let errorMsg = '';
        console.log('[startseason_confirm] Button handler triggered for seasonno:', seasonno, 'guild:', interaction.guild?.id);
        try {
            const { resetSeasonData } = await import('../commands/staff/startseason.js');
            console.log('[startseason_confirm] Imported resetSeasonData:', typeof resetSeasonData);
            await resetSeasonData(seasonno, interaction.guild, 'button');
            console.log('[startseason_confirm] resetSeasonData completed.');
            success = true;
        } catch (err) {
            console.error('[startseason_confirm] Error during resetSeasonData:', err);
            errorMsg = err?.message || 'Unknown error';
        }
        console.log('[startseason_confirm] Preparing to respond to interaction. Success:', success, 'Error:', errorMsg);
        // Always respond to the interaction
        let replied = false;
        try {
            await interaction.update({
                content: success
                    ? `✅ Season ${seasonno} has been started and all data files have been reset.`
                    : `❌ Failed to reset season data: ${errorMsg}`,
                components: []
            });
            replied = true;
        } catch (err) {
            // If update fails, try a followUp
            try {
                await interaction.followUp({
                    content: success
                        ? `✅ Season ${seasonno} has been started and all data files have been reset.`
                        : `❌ Failed to reset season data: ${errorMsg}`,
                    ephemeral: true
                });
                replied = true;
            } catch (finalErr) {
                console.error('[startseason_confirm] Failed to send interaction response:', finalErr);
            }
        }
        // Final fallback: if still not replied, log and try a generic reply
        if (!replied) {
            try {
                await interaction.reply({
                    content: 'An error occurred while processing your request. Please contact an admin.',
                    ephemeral: true
                });
            } catch (err) {
                console.error('[startseason_confirm] Final fallback reply failed:', err);
            }
        }
    } catch (outerErr) {
        // Top-level catch: should never hit, but just in case
        console.error('[startseason_confirm] Top-level handler error:', outerErr);
        try {
            await interaction.reply({
                content: 'A critical error occurred in the startseason_confirm handler. Please contact an admin.',
                ephemeral: true
            });
        } catch (err) {
            console.error('[startseason_confirm] Top-level fallback reply failed:', err);
        }
    }
}
export default { customId, execute };

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
        console.log('[startseason_confirm] Calling resetSeasonData...');
        resetSeasonData(seasonno, interaction.guild, 'button');
        console.log('[startseason_confirm] resetSeasonData completed.');
        success = true;
    } catch (err) {
        console.error('[startseason_confirm] Error during resetSeasonData:', err);
        errorMsg = err?.message || 'Unknown error';
    }
    console.log('[startseason_confirm] Preparing to respond to interaction. Success:', success, 'Error:', errorMsg);
    // Always respond to the interaction
    try {
        await interaction.update({
            content: success
                ? `✅ Season ${seasonno} has been started and all data files have been reset.`
                : `❌ Failed to reset season data: ${errorMsg}`,
            components: []
        });
    } catch (err) {
        // If update fails, try a followUp
        try {
            await interaction.followUp({
                content: success
                    ? `✅ Season ${seasonno} has been started and all data files have been reset.`
                    : `❌ Failed to reset season data: ${errorMsg}`,
                ephemeral: true
            });
        } catch (finalErr) {
            console.error('[startseason_confirm] Failed to send interaction response:', finalErr);
        }
    }
}
export default { customId, execute };

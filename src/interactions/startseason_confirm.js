import { ButtonInteraction } from 'discord.js';

const SEASON_FILE = './data/season.json';
const TEAMS_FILE = './data/teams.json';
const LEAGUE_FILE = './data/league.json';
const PLAYERS_FILE = './data/players.json';
const BIGBOARD_FILE = './data/bigboard.json';
const SCOUTING_FILE = './data/scouting.json';
const RECRUITS_FILE = './data/recruits.json';

export const customId = /^startseason_confirm/;

export async function execute(interaction) {
    if (!(interaction instanceof ButtonInteraction)) return;
    // Immediately acknowledge the button interaction to prevent Discord API errors
    // Extract season number from customId: startseason_confirm_<seasonno>
    let seasonno = null;
    if (interaction.customId && interaction.customId.startsWith('startseason_confirm_')) {
        const parts = interaction.customId.split('_');
        seasonno = parseInt(parts[2], 10);
    }
    const { resetSeasonData } = await import('../commands/staff/startseason.js');
    resetSeasonData(seasonno, interaction.guild);
    // Edit the original message to confirm the reset
    try {
        await interaction.update({
            content: `✅ Season ${seasonno} has been started and all data files have been reset.`,
            components: []
        });
    } catch (err) {
        // If update fails, try a followUp
        try {
            await interaction.followUp({ content: `✅ Season ${seasonno} has been started and all data files have been reset.`, ephemeral: true });
        } catch { }
    }
}
export default { customId, execute };

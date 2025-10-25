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
    console.log('[startseason_confirm] TOP-LEVEL ENTER handler for customId:', interaction.customId);
    try {
        if (!(interaction instanceof ButtonInteraction)) {
            console.error('[startseason_confirm] Not a ButtonInteraction:', interaction);
            return;
        }
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
            // Only update standings pin after successful reset
            try {
                const standingsChannelId = '1428159168904167535';
                const blankStandingsEmbed = new (await import('discord.js')).EmbedBuilder()
                    .setTitle('NBA League Standings')
                    .addFields(
                        { name: 'Eastern Conference', value: 'No games played', inline: false },
                        { name: 'Western Conference', value: 'No games played', inline: false }
                    )
                    .setColor(0x1D428A)
                    .setFooter({ text: 'W-L | Win% | Games Behind (GB)' });
                // Use the same resetPinnedEmbed logic as in startseason.js
                const guild = interaction.guild;
                async function resetPinnedEmbed(channelId, embedArr, envKey = null) {
                    try {
                        const channel = await guild.channels.fetch(channelId);
                        if (!channel) return;
                        const pins = await channel.messages.fetchPins();
                        if (pins && typeof pins.forEach === 'function') {
                            pins.forEach(async (msg) => {
                                if (msg.author && msg.author.id === guild.client.user.id) {
                                    try {
                                        await msg.unpin();
                                        await msg.delete();
                                    } catch (err) {
                                        console.error('Failed to unpin/delete message:', err);
                                    }
                                }
                            });
                        }
                        const sentMsg = await channel.send({ embeds: embedArr });
                        await sentMsg.pin();
                        if (envKey) {
                            const envPath = require('path').resolve(process.cwd(), '.env');
                            let envContent = '';
                            try {
                                envContent = require('fs').readFileSync(envPath, 'utf8');
                            } catch { }
                            const regex = new RegExp(`^${envKey}=.*$`, 'm');
                            if (regex.test(envContent)) {
                                envContent = envContent.replace(regex, `${envKey}=${sentMsg.id}`);
                            } else {
                                envContent += `\n${envKey}=${sentMsg.id}`;
                            }
                            require('fs').writeFileSync(envPath, envContent, 'utf8');
                        }
                    } catch (err) {
                        if (err && err.stack) {
                            console.error('Failed to reset pinned message in channel', channelId, err.stack);
                        } else if (err && err.message) {
                            console.error('Failed to reset pinned message in channel', channelId, err.message);
                        } else {
                            console.error('Failed to reset pinned message in channel', channelId, err);
                        }
                    }
                }
                await resetPinnedEmbed(standingsChannelId, [blankStandingsEmbed], 'STANDINGS_PINNED_MESSAGE_ID');
                console.log('[startseason_confirm] Standings pin updated after confirmation.');
            } catch (pinErr) {
                console.error('[startseason_confirm] Error updating standings pin:', pinErr);
            }
            success = true;
        } catch (err) {
            console.error('[startseason_confirm] Error during resetSeasonData:', err);
            errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
        }
        console.log('[startseason_confirm] Preparing to respond to interaction. Success:', success, 'Error:', errorMsg);
        // Always respond to the interaction, with fallback and extra logging
        let replied = false;
        try {
            await interaction.update({
                content: success
                    ? `✅ Season ${seasonno} has been started and all data files have been reset.`
                    : `❌ Failed to reset season data: ${errorMsg}`,
                components: []
            });
            replied = true;
            console.log('[startseason_confirm] interaction.update sent');
        } catch (err) {
            console.error('[startseason_confirm] interaction.update failed:', err);
            // If update fails, try a followUp
            try {
                await interaction.followUp({
                    content: success
                        ? `✅ Season ${seasonno} has been started and all data files have been reset.`
                        : `❌ Failed to reset season data: ${errorMsg}`,
                    ephemeral: true
                });
                replied = true;
                console.log('[startseason_confirm] interaction.followUp sent');
            } catch (finalErr) {
                console.error('[startseason_confirm] Failed to send interaction response:', finalErr);
            }
        }
        if (!replied) {
            // Last resort: log and do nothing (Discord API may block further responses)
            console.error('[startseason_confirm] No response sent to interaction. Discord may have blocked further replies.');
        }
        console.log('[startseason_confirm] EXIT handler for customId:', interaction.customId);
    } catch (outerErr) {
        console.error('[startseason_confirm] TOP-LEVEL FATAL error in button handler:', outerErr);
        try {
            await interaction.followUp({
                content: `❌ Fatal error in season reset: ${outerErr?.message || outerErr}`,
                ephemeral: true
            });
            console.log('[startseason_confirm] Fatal error followUp sent');
        } catch (finalErr) {
            console.error('[startseason_confirm] Failed to send fatal error followUp:', finalErr);
        }
    }
}
export default { customId, execute };

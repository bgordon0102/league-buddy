
// Script to send and pin the initial trade submission message in the trade channel, using a modal-based DM approval flow
import { Client, GatewayIntentBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const TRADE_CHANNEL_ID = '1425555037328773220';
const TRADE_COMMITTEE_CHANNEL_ID = '1425555499440410812';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages], partials: ['CHANNEL'] });

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const channel = await client.channels.fetch(TRADE_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
        console.error('Trade channel not found or not text-based.');
        process.exit(1);
    }
    // Create the button
    const submitButton = new ButtonBuilder()
        .setCustomId('trade_submit_button')
        .setLabel('Submit Trade')
        .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(submitButton);
    // Send the message
    const msg = await channel.send({
        content: ':pushpin: Use the button below to submit a trade proposal.',
        components: [row]
    });
    await msg.pin();
    console.log('Trade submission message sent and pinned.');
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'trade_submit_button') {
        // Show modal to collect trade details
        const modal = new ModalBuilder()
            .setCustomId('trade_modal')
            .setTitle('Submit Trade Proposal')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('your_team')
                        .setLabel('Your Team (name or keyword)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('other_team')
                        .setLabel('Other Team (name or keyword)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('assets_sent')
                        .setLabel('Assets Sent')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('assets_received')
                        .setLabel('Assets Received')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('notes')
                        .setLabel('Notes (optional)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                )
            );
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'trade_modal') {
        // Parse modal fields
        const yourTeam = interaction.fields.getTextInputValue('your_team');
        const otherTeam = interaction.fields.getTextInputValue('other_team');
        const assetsSent = interaction.fields.getTextInputValue('assets_sent');
        const assetsReceived = interaction.fields.getTextInputValue('assets_received');
        const notes = interaction.fields.getTextInputValue('notes');

        // Find the submitting user and the other coach by team name
        const guild = await client.guilds.fetch(interaction.guildId);
        const members = await guild.members.fetch();
        // Try to find users by nickname or username containing the team name
        const findCoach = (team) => {
            const lower = team.toLowerCase();
            return members.find(m => m.displayName.toLowerCase().includes(lower) || m.user.username.toLowerCase().includes(lower));
        };
        const submitter = interaction.user;
        const otherCoach = findCoach(otherTeam);

        if (!otherCoach) {
            await interaction.reply({ content: `Could not find a coach for team: ${otherTeam}. Please check the team name.`, ephemeral: true });
            return;
        }

        // DM the other coach for approval
        const dmEmbed = {
            title: 'Trade Proposal Approval',
            description: `You have a pending trade proposal from **${yourTeam}** (submitted by <@${submitter.id}>):`,
            fields: [
                { name: 'Your Team', value: yourTeam, inline: true },
                { name: 'Other Team', value: otherTeam, inline: true },
                { name: 'Assets Sent', value: assetsSent },
                { name: 'Assets Received', value: assetsReceived },
                ...(notes ? [{ name: 'Notes', value: notes }] : [])
            ],
            color: 0x1E90FF
        };
        const approveButton = new ButtonBuilder()
            .setCustomId('approve_trade_button')
            .setLabel('Approve Trade')
            .setStyle(ButtonStyle.Success);
        const denyButton = new ButtonBuilder()
            .setCustomId('deny_trade_button')
            .setLabel('Deny Trade')
            .setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(approveButton, denyButton);
        try {
            await otherCoach.user.send({ embeds: [dmEmbed], components: [row] });
            await interaction.reply({ content: `Trade proposal sent to ${otherCoach.user.tag} for approval via DM.`, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: `Failed to DM the other coach. They may have DMs disabled.`, ephemeral: true });
            return;
        }

        // Store trade details in memory for approval (in production, use a DB or file)
        client.pendingTrades = client.pendingTrades || {};
        client.pendingTrades[otherCoach.id] = {
            yourTeam,
            otherTeam,
            assetsSent,
            assetsReceived,
            notes,
            submitterId: submitter.id,
            otherCoachId: otherCoach.id
        };
    }

    if (interaction.isButton() && (interaction.customId === 'approve_trade_button' || interaction.customId === 'deny_trade_button')) {
        // Find the pending trade for this user
        const trade = client.pendingTrades && client.pendingTrades[interaction.user.id];
        if (!trade) {
            await interaction.reply({ content: 'No pending trade found for you.', ephemeral: true });
            return;
        }
        if (interaction.customId === 'approve_trade_button') {
            // Post to committee channel
            const committeeChannel = await client.channels.fetch(TRADE_COMMITTEE_CHANNEL_ID);
            if (!committeeChannel || !committeeChannel.isTextBased()) {
                await interaction.reply({ content: 'Failed to find the committee channel.', ephemeral: true });
                return;
            }
            const embed = {
                title: 'Trade Proposal (Approved by Both Coaches)',
                description: `Trade between **${trade.yourTeam}** and **${trade.otherTeam}** (submitted by <@${trade.submitterId}>, approved by <@${interaction.user.id}>)`,
                fields: [
                    { name: 'Team 1', value: trade.yourTeam, inline: true },
                    { name: 'Team 2', value: trade.otherTeam, inline: true },
                    { name: 'Assets Sent', value: trade.assetsSent },
                    { name: 'Assets Received', value: trade.assetsReceived },
                    ...(trade.notes ? [{ name: 'Notes', value: trade.notes }] : [])
                ],
                color: 0xFFD700
            };
            await committeeChannel.send({ embeds: [embed] });
            await interaction.reply({ content: 'Trade approved and sent to the committee channel.', ephemeral: true });
            // Remove from pending
            delete client.pendingTrades[interaction.user.id];
        } else if (interaction.customId === 'deny_trade_button') {
            // Notify both coaches
            try {
                const submitterUser = await client.users.fetch(trade.submitterId);
                await submitterUser.send(`Your trade proposal with **${trade.otherTeam}** was denied by the other coach.`);
            } catch { }
            try {
                await interaction.user.send('You have denied the trade proposal. The other coach has been notified.');
            } catch { }
            await interaction.reply({ content: 'Trade denied. Both coaches have been notified.', ephemeral: true });
            // Remove from pending
            delete client.pendingTrades[interaction.user.id];
        }
    }
});

client.login(TOKEN);

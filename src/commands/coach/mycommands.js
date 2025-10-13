import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('mycommands')
    .setDescription('Shows a list of commands available to you.');

export async function execute(interaction) {
    const member = interaction.member;

    // Staff role names
    const staffRoles = ['Admin', 'Commish', 'Schedule Tracker', 'Gameplay Mod', 'Trade Committee'];
    const hasStaffRole = member.roles.cache.some(role => staffRoles.includes(role.name));

    let embed;

    if (hasStaffRole) {
        embed = new EmbedBuilder()
            .setColor(0xFFD700) // gold
            .setTitle('⭐ Staff Commands')
            .setDescription('Here are the commands available to Staff:')
            .addFields(
                { name: '/mycommands ⭐', value: 'Shows this menu' },
                { name: '/advanceweek', value: 'Advance the league to the next week' },
                { name: '/assignrole', value: 'Assign a coach role to a user' },
                { name: '/clearcoachoffices', value: 'Remove all messages from coach office channels' },
                { name: '/clearmessages', value: 'Clear messages from a specified channel' },
                { name: '/createcoachoffices', value: 'Create all coach office channels' },
                { name: '/deletegamechannel', value: 'Delete a game channel' },
                { name: '/generaterandomscores', value: 'Simulate and approve random scores for all games up to a given week' },
                { name: '/resetnbaroles', value: 'Reset NBA coach roles for all teams' },
                { name: '/resetscouting', value: 'Reset all scouting data' },
                { name: '/startseason', value: 'Start or reset the NBA season and all league data files' }
            )
            .setFooter({ text: 'Staff access only' });
    } else {
        embed = new EmbedBuilder()
            .setColor(0x1E90FF) // blue
            .setTitle('⭐ Coach Commands')
            .setDescription('Here are the commands available to Coaches:')
            .addFields(
                { name: '/mycommands ⭐', value: 'Shows this menu' },
                { name: '/standings', value: 'Show NBA-style conference standings' },
                { name: '/schedule', value: "Show a team's NBA season schedule" },
                { name: '/prospectboard', value: 'View the prospect board (pre, mid, final)' },
                { name: '/bigboard', value: 'View and manage your personal draft big board (reorder your scouted players)' },
                { name: '/scout', value: 'Show the current NBA-style playoff bracket and play-in teams' },
                { name: '/recruitboard', value: 'View recruits and player cards' },
                { name: '/invitecoach', value: 'Invite a coach to your office channel' },
                { name: '/uninvitecoach', value: 'Remove a coach from your office channel' }
            )
            .setFooter({ text: 'Coach access only' });
    }

    await interaction.reply({
        embeds: [embed],
        flags: 64 // MessageFlags.Ephemeral
    });
}

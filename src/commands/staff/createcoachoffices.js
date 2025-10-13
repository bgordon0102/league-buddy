import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('createcoachoffices')
    .setDescription("Create a 'Coach's Office' category and private channels for each coach role.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const guild = interaction.guild;
    if (!guild) return await interaction.editReply('❌ This command must be run in a server.');

    // List your coach roles here (role names must match exactly)
    const NBA_TEAMS = [
        '76ers', 'Bucks', 'Bulls', 'Cavaliers', 'Celtics', 'Clippers',
        'Grizzlies', 'Hawks', 'Heat', 'Hornets', 'Jazz', 'Kings',
        'Knicks', 'Lakers', 'Magic', 'Mavericks', 'Nets', 'Nuggets',
        'Pacers', 'Pelicans', 'Pistons', 'Raptors', 'Rockets', 'Spurs',
        'Suns', 'Thunder', 'Timberwolves', 'Trail Blazers', 'Warriors', 'Wizards'
    ];

    // Create the category
    let category;
    try {
        category = await guild.channels.create({
            name: "Coach's Office",
            type: 4 // Category
        });
    } catch (err) {
        return await interaction.editReply(`❌ Error creating category: ${err.message}`);
    }

    // Create a private channel for each coach role
    let createdChannels = [];
    for (const team of NBA_TEAMS) {
        const teamCoachRoleName = `${team} Coach`;
        const teamCoachRole = guild.roles.cache.find(r => r.name === teamCoachRoleName);
        const channelName = team.toLowerCase().replace(/\s+/g, '-');
        if (!teamCoachRole) {
            createdChannels.push(`Role not found: ${teamCoachRoleName}`);
            continue;
        }
        // Build permission overwrites for only the team coach and @everyone
        const permissionOverwrites = [
            {
                id: guild.id, // @everyone
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: teamCoachRole.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.UseApplicationCommands
                ]
            }
        ];
        try {
            const channel = await guild.channels.create({
                name: channelName,
                type: 0, // Text channel
                parent: category.id,
                permissionOverwrites
            });
            // Send a cool welcome message
            const welcomeMsg = await channel.send({
                content: `👋 **Welcome to your office!**\n\nThis is your private space to scout, strategize, and build your draft board.\n\nUse this channel to discuss prospects, share scouting reports, and plan your next moves. Good luck, Coach! 🏀📝`
            });
            await welcomeMsg.pin();
            createdChannels.push(`Created: ${channel.name}`);
        } catch (err) {
            createdChannels.push(`Error for Head Coach: ${err.message}`);
        }
    }
    await interaction.editReply(createdChannels.join('\n'));
}

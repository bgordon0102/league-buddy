import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const NBA_TEAMS = [
    'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Mavericks', 'Nuggets', 'Pistons',
    'Warriors', 'Rockets', 'Pacers', 'Clippers', 'Lakers', 'Grizzlies', 'Heat', 'Bucks', 'Timberwolves',
    'Pelicans', 'Knicks', 'Thunder', 'Magic', '76ers', 'Suns', 'Trail Blazers', 'Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards'
];

const STAFF_ROLES = ['Commish', 'Schedule Tracker', 'Gameplay Mod', 'Trade Committee', 'Head Coach'];

export const data = new SlashCommandBuilder()
    .setName('assignrole')
    .setDescription('Assign up to two roles to a user quickly.')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to assign the role to')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('role1')
            .setDescription('The first role to assign')
            .setRequired(true)
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('role2')
            .setDescription('The second role to assign (optional)')
            .setRequired(false)
            .setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const user = interaction.options.getUser('user');
    const roleName1 = interaction.options.getString('role1');
    const roleName2 = interaction.options.getString('role2');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
        return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    const role1 = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName1.toLowerCase());
    if (!role1) {
        return interaction.reply({ content: `Role "${roleName1}" not found.`, ephemeral: true });
    }
    let role2 = null;
    if (roleName2) {
        role2 = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === roleName2.toLowerCase());
        if (!role2) {
            return interaction.reply({ content: `Role "${roleName2}" not found.`, ephemeral: true });
        }
    }

    try {
        await member.roles.add(role1);
        let msg = `Assigned role "${role1.name}" to ${user.tag}.`;
        if (role2) {
            await member.roles.add(role2);
            msg = `Assigned roles "${role1.name}" and "${role2.name}" to ${user.tag}.`;
        }
        await interaction.reply({ content: msg, ephemeral: false });
    } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'Error assigning role. Check bot permissions.', ephemeral: true });
    }
}

export async function autocomplete(interaction) {
    try {
        const focusedValue = interaction.options.getFocused();
        // Create list of all available roles
        const allRoles = [
            ...NBA_TEAMS.map(team => `${team} Coach`),
            ...STAFF_ROLES
        ];
        // Filter roles based on what user typed
        const filtered = allRoles.filter(role =>
            role.toLowerCase().includes(focusedValue.toLowerCase())
        );
        // Return up to 25 choices (Discord limit)
        if (!interaction.responded && interaction.isAutocomplete()) {
            await interaction.respond(
                filtered.slice(0, 25).map(role => ({ name: role, value: role }))
            );
        }
    } catch (err) {
        // Silently ignore errors to avoid crashing the bot
        console.error('Autocomplete error in /assignrole:', err?.message || err);
        try {
            if (!interaction.responded && interaction.isAutocomplete()) {
                await interaction.respond([]); // Respond with empty if error
            }
        } catch { }
    }
}

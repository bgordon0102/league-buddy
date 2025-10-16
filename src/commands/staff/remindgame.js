import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import fs from 'fs';

export const data = new SlashCommandBuilder()
    .setName('remindgame')
    .setDescription('Send a reminder to play the game in this thread (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        // Only allow staff
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isStaff = member.permissions.has(PermissionFlagsBits.ManageChannels);
        if (!isStaff) {
            await interaction.editReply({ content: 'Only staff can use this command.' });
            return;
        }
        // Get channel and coach roles
        const channel = interaction.channel;
        const match = channel.name.match(/^(.*?)-vs-(.*?)$/);
        if (!match) {
            await interaction.editReply({ content: 'This command can only be used in a game thread.' });
            return;
        }
        const abbrToFull = {
            ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets', CHA: 'Charlotte Hornets', CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets', DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers', LAC: 'LA Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat', MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans', NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns', POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors', UTA: 'Utah Jazz', WAS: 'Washington Wizards'
        };
        const abbr1 = match[1].toUpperCase();
        const abbr2 = match[2].toUpperCase();
        const team1Full = abbrToFull[abbr1] || abbr1;
        const team2Full = abbrToFull[abbr2] || abbr2;
        let coachRoleMap = {};
        try {
            const guildId = process.env.DISCORD_GUILD_ID;
            let coachRoleMapFile = './data/coachRoleMap.json';
            if (guildId === '1415452215044473036') {
                coachRoleMapFile = './data/coachRoleMap.main.json';
            } else if (guildId === '1407111281147641976') {
                coachRoleMapFile = './data/coachRoleMap.dev.json';
            }
            coachRoleMap = JSON.parse(fs.readFileSync(coachRoleMapFile, 'utf8'));
        } catch { }
        const team1RoleId = coachRoleMap[team1Full];
        const team2RoleId = coachRoleMap[team2Full];
        // Calculate deadline (24 hours from channel creation)
        const deadline = Math.floor(channel.createdTimestamp / 1000) + 24 * 3600;
        let content = '';
        if (team1RoleId && team2RoleId) {
            content += `Reminder: <@&${team1RoleId}> & <@&${team2RoleId}> please play your game!\n`;
        } else {
            content += `Reminder: Coaches, please play your game!\n`;
        }
        content += `:alarm_clock: **Score must be submitted within <t:${deadline}:R> (<t:${deadline}:f>)**`;
        await interaction.editReply({ content });
    } catch (err) {
        console.error('Error in remindgame:', err);
        await interaction.editReply({ content: 'Error sending reminder.' });
    }
}

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const NBA_TEAMS = [
  'Hawks', 'Celtics', 'Nets', 'Hornets', 'Bulls', 'Cavaliers', 'Mavericks', 'Nuggets', 'Pistons',
  'Warriors', 'Rockets', 'Pacers', 'Clippers', 'Lakers', 'Grizzlies', 'Heat', 'Bucks', 'Timberwolves',
  'Pelicans', 'Knicks', 'Thunder', 'Magic', '76ers', 'Suns', 'Trail Blazers', 'Kings', 'Spurs', 'Raptors', 'Jazz', 'Wizards'
];

const STAFF_ROLES = ['Commish', 'Schedule Tracker', 'Gameplay Mod', 'Trade Committee'];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const data = new SlashCommandBuilder()
  .setName('resetnbaroles')
  .setDescription('Delete existing NBA roles and recreate them properly.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  console.log('🏀 Starting resetnbaroles command...');

  try {
    await interaction.reply({ content: '🏀 Resetting NBA roles...', flags: 64 });
    console.log('✅ Initial reply sent');

    const guild = interaction.guild;

    // Full list of roles to create
    const allRoleNames = [...NBA_TEAMS.map(t => `${t} Coach`), ...STAFF_ROLES];
    console.log(`📊 Processing ${allRoleNames.length} roles`);

    // Delete existing roles
    let deletedCount = 0;
    console.log('🗑️ Starting deletion phase...');
    for (const roleName of allRoleNames) {
      const existingRoles = guild.roles.cache.filter(r => r.name === roleName);
      for (const role of existingRoles.values()) {
        try {
          await role.delete('Resetting NBA roles');
          deletedCount++;
          console.log(`🗑️ Deleted: ${role.name}`);
        } catch (err) {
          console.error(`❌ Delete failed: ${role.name} - ${err.message}`);
        }
      }
    }

    console.log(`✅ Deletion complete: ${deletedCount} roles deleted`);
    await interaction.editReply({ content: `Deleted ${deletedCount} roles. Creating ${allRoleNames.length} new ones...`, flags: 64 });

    // Create roles with 1-second delay
    let createdCount = 0;
    console.log('➕ Starting creation phase...');
    for (const roleName of allRoleNames) {
      try {
        console.log(`➕ Creating: ${roleName} (${createdCount + 1}/${allRoleNames.length})`);

        await guild.roles.create({
          name: roleName,
          mentionable: true,
          reason: 'NBA role creation'
        });

        createdCount++;
        console.log(`✅ Created: ${roleName}`);

        // Progress update every 5 roles
        if (createdCount % 5 === 0) {
          await interaction.editReply({
            content: `Progress: ${createdCount}/${allRoleNames.length} roles created...`,
            flags: 64
          });
        }

        // 1-second delay to avoid rate limits
        await delay(1000);

      } catch (err) {
        console.error(`❌ Create failed: ${roleName} - ${err.message}`);
      }
    } await interaction.editReply({
      content: `✅ Complete! Created ${createdCount}/${allRoleNames.length} NBA roles`,
      flags: 64
    });

    console.log(`🏀 NBA roles reset complete! Created ${createdCount} roles.`);

  } catch (error) {
    console.error('Command failed:', error);
    await interaction.editReply({ content: '❌ Something went wrong', flags: 64 });
  }
}
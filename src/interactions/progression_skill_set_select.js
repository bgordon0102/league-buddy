// Handles skill set dropdown selection after player is chosen
import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import fs from "fs";
import path from "path";

export const customId = "progression_skill_set_select";

const skillSetAttributes = {
    "Driving": ["Layup", "Dunk", "Close Shot", "Speed with Ball"],
    "Shooting": ["Mid", "3pt", "Free Throw"],
    "Post Scoring": ["Post Hook", "Post Fade", "Post Control"],
    "Playmaking": ["Ball Handling", "Pass Accuracy", "Pass IQ", "Vision"],
    "Interior Defense": ["Inside Defense", "Block", "Help Defense IQ"],
    "Perimeter Defense": ["Perimeter Defense", "Steal", "Pass Perception"],
    "Rebounding": ["Offensive Rebound", "Defensive Rebound"],
    "IQ": ["Foul", "Shot IQ", "Offensive Consistency", "Defensive Consistency", "Intangible"],
    "Conditioning": ["+5 to use on Speed, Accel, Agility, Vertical, Stamina"],
    "Weight Room": ["+3 Strength, +8 lbs, -1 Speed, Accel, Vertical"],
    "Shooting Mechanics": ["Shot Timing"],
    "Distributor": ["Enable Play Initiator"],
    "X-Factor": ["+3 Potential"]
};

const shootingMechanicsOptions = [
    { label: "Very Slow", value: "Very Slow" },
    { label: "Slow", value: "Slow" },
    { label: "Normal", value: "Normal" },
    { label: "Quick", value: "Quick" },
    { label: "Very Quick", value: "Very Quick" }
];

export async function execute(interaction) {
    const selectedSkillSet = interaction.values[0];
    // Retrieve context from previous interaction (ephemeral reply)
    // Try to get player and team from interaction.message.content
    const content = interaction.message.content;
    const playerMatch = content.match(/Select a skill set for (.+):/);
    const selectedPlayer = playerMatch ? playerMatch[1] : "";

    // Detect team from roles
    const coachRoleMap = JSON.parse(fs.readFileSync("data/coachRoleMap.json", "utf8"));
    const member = interaction.member;
    let teamName = null;
    for (const [team, roleId] of Object.entries(coachRoleMap)) {
        if (member.roles.cache.has(roleId)) {
            teamName = team;
            break;
        }
    }
    // Auto-detect player's OVR from roster
    let playerOvr = "";
    if (teamName) {
        const fileName = teamName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() + ".json";
        const rosterPath = path.join(process.cwd(), "data/teams_rosters", fileName);
        if (fs.existsSync(rosterPath)) {
            const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
            const players = Array.isArray(roster) ? roster : roster.players || [];
            const playerObj = players.find(p => p.name === selectedPlayer);
            if (playerObj && playerObj.ovr) playerOvr = playerObj.ovr.toString();
        }
    }
    // Build modal fields for attributes
    let modalFields = [];
    if (selectedSkillSet === "Shooting Mechanics") {
        // Use text field for shot timing
        modalFields.push(new TextInputBuilder()
            .setCustomId("Shot Timing")
            .setLabel("Shot Timing (Very Slow, Slow, Normal, Quick, Very Quick)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false));
    } else if (selectedSkillSet === "Distributor") {
        modalFields.push(new TextInputBuilder()
            .setCustomId("Enable Play Initiator")
            .setLabel("Enable Play Initiator (type YES to enable)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false));
    } else if (selectedSkillSet === "X-Factor") {
        modalFields.push(new TextInputBuilder()
            .setCustomId("+3 Potential")
            .setLabel("+3 Potential (type YES to apply)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false));
    } else {
        for (const attr of skillSetAttributes[selectedSkillSet] || []) {
            modalFields.push(new TextInputBuilder()
                .setCustomId(attr)
                .setLabel(attr)
                .setStyle(TextInputStyle.Short)
                .setRequired(false));
        }
    }
    // Always include team, player, skill set, and OVR as hidden fields
    modalFields.unshift(
        new TextInputBuilder().setCustomId("teamName").setLabel("Team").setStyle(TextInputStyle.Short).setValue(teamName || "").setRequired(true),
        new TextInputBuilder().setCustomId("playerName").setLabel("Player Name").setStyle(TextInputStyle.Short).setValue(selectedPlayer).setRequired(true),
        new TextInputBuilder().setCustomId("skillSet").setLabel("Skill Set").setStyle(TextInputStyle.Short).setValue(selectedSkillSet).setRequired(true),
        new TextInputBuilder().setCustomId("currentOvr").setLabel("Current OVR").setStyle(TextInputStyle.Short).setValue(playerOvr).setRequired(true)
    );
    // Build modal
    const modal = new ModalBuilder()
        .setCustomId("player_progression_modal_submit")
        .setTitle(selectedSkillSet + " Progression")
        .addComponents(
            ...modalFields.map(f => new ActionRowBuilder().addComponents(f))
        );
    await interaction.showModal(modal);
}

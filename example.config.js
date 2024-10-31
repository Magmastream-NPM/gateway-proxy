const { GatewayIntentBits } = require("discord-api-types/v10");

module.exports = {
	token: "",
	intents: GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildMessages | GatewayIntentBits.Guilds | GatewayIntentBits.GuildVoiceStates,
};

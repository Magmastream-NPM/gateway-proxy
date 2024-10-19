const axios = require("axios");

const config = require("../config.json");
let cachedDiscordGatewayUrl = null;
let cacheTimestamp = 0;
const CACHE_EXPIRY = 3600000;

async function getDiscordGatewayUrl() {
	const now = Date.now();
	if (cachedDiscordGatewayUrl && now - cacheTimestamp < CACHE_EXPIRY) {
		return cachedDiscordGatewayUrl;
	}

	try {
		const response = await axios.get("https://discord.com/api/v10/gateway/bot", {
			headers: {
				Authorization: `Bot ${config.token}`,
			},
		});
		cachedDiscordGatewayUrl = response.data.url;
		cacheTimestamp = now;
		return cachedDiscordGatewayUrl;
	} catch (error) {
		console.error("Failed to retrieve Discord Gateway URL:", error);
		throw new Error("Unable to get Discord Gateway URL");
	}
}

module.exports = { getDiscordGatewayUrl };

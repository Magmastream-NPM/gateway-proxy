const axios = require("axios");

let cachedDiscordGatewayUrls = {};
const CACHE_EXPIRY = 3600000;

// Delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getDiscordGatewayUrl(botToken) {
	const now = Date.now();
	if (cachedDiscordGatewayUrls[botToken] && now - cachedDiscordGatewayUrls[botToken].timestamp < CACHE_EXPIRY) {
		return cachedDiscordGatewayUrls[botToken].url;
	}

	await delay(8000);

	try {
		const response = await axios.get("https://discord.com/api/v10/gateway/bot", {
			headers: {
				Authorization: `Bot ${botToken}`,
			},
		});
		cachedDiscordGatewayUrls[botToken] = { url: response.data.url, timestamp: now };
		return cachedDiscordGatewayUrls[botToken].url;
	} catch (error) {
		// Enhanced error logging
		if (error.response) {
			console.error("Failed to retrieve Discord Gateway URL:", error.response.data);
		} else {
			console.error("Failed to retrieve Discord Gateway URL:", error.message);
		}
		throw new Error("Unable to get Discord Gateway URL");
	}
}

module.exports = { getDiscordGatewayUrl };

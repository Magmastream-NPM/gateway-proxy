const WebSocket = require("ws");
const axios = require("axios");
const config = require("./config.json");

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

const wss = new WebSocket.Server({ port: config.port });
const shardConnections = new Map();
const availableShards = [...Array(config.totalShards).keys()];

wss.on("connection", async (clientSocket) => {
	console.log("Client connected to the proxy");

	if (availableShards.length === 0) {
		clientSocket.close(1008, "No available shards");
		return;
	}

	const shardId = availableShards.shift();

	try {
		const discordWsUrl = await getDiscordGatewayUrl();
		const discordSocket = new WebSocket(`${discordWsUrl}?v=10&encoding=json`);
		shardConnections.set(shardId, { discordSocket, clientSocket });

		// Handle Discord WebSocket events
		discordSocket.on("message", (message) => {
			try {
				const jsonMessage = JSON.parse(message);
				clientSocket.send(JSON.stringify(jsonMessage));
			} catch (error) {
				console.error("Failed to parse message from Discord:", error);
			}
		});

		discordSocket.on("close", (code, reason) => {
			console.log(`Discord WebSocket for Shard ${shardId} closed: ${code} ${reason}`);
			clientSocket.close();
			shardConnections.delete(shardId);
			availableShards.push(shardId);
		});

		discordSocket.on("error", (error) => {
			console.error(`Discord WebSocket for Shard ${shardId} error:`, error);
			clientSocket.close();
			shardConnections.delete(shardId);
			availableShards.push(shardId);
		});

		// Handle client WebSocket events
		clientSocket.on("message", (message) => {
			try {
				const jsonMessage = JSON.parse(message);
				discordSocket.send(JSON.stringify(jsonMessage));
			} catch (error) {
				console.error("Failed to parse message from client:", error);
			}
		});

		clientSocket.on("close", () => {
			console.log(`Client for Shard ${shardId} disconnected`);
			discordSocket.close();
			shardConnections.delete(shardId);
			availableShards.push(shardId);
		});

		clientSocket.on("error", (error) => {
			console.error(`Client WebSocket for Shard ${shardId} error:`, error);
			discordSocket.close();
			shardConnections.delete(shardId);
			availableShards.push(shardId);
		});
	} catch (error) {
		console.error("Error during connection handling:", error);
		clientSocket.close(1011, "Internal server error");
		availableShards.push(shardId);
	}
});

console.log(`Proxy WebSocket server running on ws://localhost:${config.port}`);

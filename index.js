const WebSocket = require("ws");
const config = require("./config.json");
const cluster = require("cluster");
const os = require("os");
const { getDiscordGatewayUrl } = require("./src/getDiscordGatewayUrl");

if (cluster.isMaster) {
	const numCPUs = os.cpus().length;

	console.log(`Master process is running with ${numCPUs} CPUs`);

	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}

	cluster.on("exit", (worker, code, signal) => {
		console.log(`Worker ${worker.process.pid} died, restarting...`);
		cluster.fork();
	});
} else {
	const wss = new WebSocket.Server({ port: config.port });
	const shardConnections = new Map();
	const availableShards = config.botTokens.flatMap(bot => [...Array(bot.totalShards).keys()].map(i => ({ botToken: bot.token, shardId: i })));

	wss.on("connection", async (clientSocket) => {
		console.log("Client connected to the proxy");

		if (availableShards.length === 0) {
			clientSocket.close(1008, "No available shards");
			console.log("No available shards to connect.");
			return;
		}

		const { botToken, shardId } = availableShards.shift();
		console.log(`Connecting to Discord with Bot Token: ${botToken}, Shard ID: ${shardId}`);

		try {
			const discordWsUrl = await getDiscordGatewayUrl(botToken);
			console.log(`Discord WebSocket URL for Bot Token: ${botToken} is ${discordWsUrl}`);
			const discordSocket = new WebSocket(`${discordWsUrl}?v=10&encoding=json`);
			shardConnections.set(`${botToken}-${shardId}`, { discordSocket, clientSocket });

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
				console.log(`Discord WebSocket for Bot Token: ${botToken}, Shard ${shardId} closed: ${code} ${reason}`);
				clientSocket.close();
				shardConnections.delete(`${botToken}-${shardId}`);
				availableShards.push({ botToken, shardId });
			});

			discordSocket.on("error", (error) => {
				console.error(`Discord WebSocket for Bot Token: ${botToken}, Shard ${shardId} error:`, error);
				clientSocket.close();
				shardConnections.delete(`${botToken}-${shardId}`);
				availableShards.push({ botToken, shardId });
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
				console.log(`Client for Bot Token: ${botToken}, Shard ${shardId} disconnected`);
				discordSocket.close();
				shardConnections.delete(`${botToken}-${shardId}`);
				availableShards.push({ botToken, shardId });
			});

			clientSocket.on("error", (error) => {
				console.error(`Client WebSocket for Bot Token: ${botToken}, Shard ${shardId} error:`, error);
				discordSocket.close();
				shardConnections.delete(`${botToken}-${shardId}`);
				availableShards.push({ botToken, shardId });
			});
		} catch (error) {
			console.error("Error during connection handling:", error);
			clientSocket.close(1011, "Internal server error");
			availableShards.push({ botToken, shardId });
		}
	});

	console.log(`Worker ${process.pid} started WebSocket server on ws://localhost:${config.port}`);
}

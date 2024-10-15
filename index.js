const WebSocket = require("ws");
const axios = require("axios");
const config = require("./config.json");

const totalShards = 1; // Total number of shards

// Function to retrieve the actual Discord WebSocket gateway URL
async function getDiscordGatewayUrl() {
  const response = await axios.get("https://discord.com/api/v10/gateway/bot", {
    headers: {
      Authorization: `Bot ${config.token}`,
    },
  });
  return response.data.url;
}

// Start the WebSocket server for your proxy
const wss = new WebSocket.Server({ port: 8080 });

// Hold shard connections by shardId
const shardConnections = new Map();

wss.on("connection", async (clientSocket, request) => {
  console.log("Client connected to the proxy");

  // Extract the shard ID from the request (could be passed as a query parameter)
  const shardId = parseInt(
    new URL(request.url, `http://${request.headers.host}`).searchParams.get(
      "shardId"
    ),
    10
  );

  if (isNaN(shardId) || shardId < 0 || shardId >= totalShards) {
    clientSocket.close(1008, "Invalid shard ID");
    return;
  }

  // Check if there's already a connection for the given shard
  if (shardConnections.has(shardId)) {
    clientSocket.close(1008, "Shard already connected");
    return;
  }

  // Get the Discord Gateway URL
  const discordWsUrl = await getDiscordGatewayUrl();

  // Create a connection to the real Discord gateway for this shard
  const discordSocket = new WebSocket(`${discordWsUrl}?v=10&encoding=json`);

  shardConnections.set(shardId, { discordSocket, clientSocket });

  // Handle messages from Discord WebSocket to client
  discordSocket.on("message", (message) => {
    console.log(`Message from Discord (Shard ${shardId}):`, message);
    clientSocket.send(message); // Forward message to the client
  });

  // Handle messages from client to Discord WebSocket
  clientSocket.on("message", (message) => {
    console.log(`Message from Client (Shard ${shardId}):`, message);
    discordSocket.send(message); // Forward message to Discord
  });

  // Handle Discord WebSocket close event
  discordSocket.on("close", (code, reason) => {
    console.log(
      `Discord WebSocket for Shard ${shardId} closed: ${code} ${reason}`
    );
    clientSocket.close(); // Close client connection as well
    shardConnections.delete(shardId);
  });

  // Handle client WebSocket close event
  clientSocket.on("close", () => {
    console.log(`Client for Shard ${shardId} disconnected`);
    discordSocket.close(); // Close Discord connection as well
    shardConnections.delete(shardId);
  });
});

console.log("Proxy WebSocket server running on ws://localhost:8080");

const { WebSocketServer, WebSocket } = require("ws");
const { WebSocketManager, DefaultWebSocketManagerOptions } = require("@discordjs/ws");
const { REST } = require("@discordjs/rest");
const { token, intents } = require("./config");
const { GatewayOpcodes } = require("discord-api-types/v10");

const rest = new REST().setToken(token);

const manager = new WebSocketManager({
	token,
	intents,
	rest,
	...DefaultWebSocketManagerOptions,
});

const wss = new WebSocketServer({ port: 8080 });
let client = null; // Track the connected client

// Session and sequence management
let sessionId = null;
let sequence = null;
let wasClientConnected = false; // Track if a client was recently connected

// Heartbeat interval management for Discord gateway
let heartbeatInterval = null;
let awaitingHeartbeatAck = false;

// Ensure the shard is spawned before sending Identify/Resume
async function initializeShard() {
	console.log("Initializing shard and connecting to Discord gateway...");
	await manager.connect();
	console.log("Shard initialized and connected.");
}

// Start connection to Discord gateway with Resume or Identify
async function connectToGateway() {
	console.log("Connecting to Discord gateway with Resume or Identify...");
	if (sessionId && sequence !== null) {
		const resumePayload = {
			op: GatewayOpcodes.Resume,
			d: {
				token,
				session_id: sessionId,
				seq: sequence,
			},
		};
		console.log("Sending Resume payload:", resumePayload);
		await manager.send(0, resumePayload);
	} else {
		await sendIdentify(); // Send Identify if no previous session exists
	}
}

// Function to send Identify payload
async function sendIdentify() {
	const identifyPayload = {
		op: GatewayOpcodes.Identify,
		d: {
			token,
			intents,
			properties: {
				os: process.platform,
				browser: "my_library",
				device: "my_library",
			},
		},
	};
	console.log("Sending Identify payload:", identifyPayload);
	await manager.send(0, identifyPayload);
}

// Set up WebSocket server
wss.on("connection", (ws) => {
	console.log("Client connected to the proxy");
	client = ws;

	if (wasClientConnected) {
		// Destroy existing gateway connection only if a client was previously connected
		manager.destroy().then(() => {
			console.log("Destroyed existing gateway connection due to client reconnect.");
			initializeShard().then(connectToGateway); // Spawn shard and connect with Resume/Identify
		});
	} else {
		// First connection: initialize shard and connect directly
		initializeShard().then(connectToGateway);
	}

	// Mark client as recently connected
	wasClientConnected = true;

	// Forward client messages to Discord
	ws.on("message", async (message) => {
		try {
			const data = JSON.parse(message);
			console.log("Message received from client:", data);
			await manager.send(0, data); // Forward all client messages to Discord
		} catch (error) {
			console.error("Error parsing client message:", error);
		}
	});

	ws.on("close", () => {
		console.log("Client disconnected from the proxy");
		client = null;
		wasClientConnected = false; // Update flag since client is no longer connected
		manager.destroy(); // Clean up connection on client disconnect
		clearGatewayHeartbeat(); // Stop gateway heartbeat
	});
});

// Heartbeat management for Discord gateway
function startGatewayHeartbeat(interval) {
	clearGatewayHeartbeat();
	heartbeatInterval = setInterval(() => {
		if (awaitingHeartbeatAck) {
			console.log("Heartbeat ACK not received, reconnecting...");
			reconnectGateway();
		} else {
			console.log("Sending Heartbeat to Discord gateway");
			awaitingHeartbeatAck = true;
			manager.send(0, { op: GatewayOpcodes.Heartbeat, d: sequence });
		}
	}, interval);
}

// Stop gateway heartbeat
function clearGatewayHeartbeat() {
	if (heartbeatInterval) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
}

// Reconnect to the Discord gateway
async function reconnectGateway() {
	clearGatewayHeartbeat();
	await manager.destroy();
	console.log("Reconnecting to the gateway...");
	initializeShard().then(connectToGateway);
}

// Track session and sequence on relevant Discord events
manager.on("dispatch", (payload, shardId) => {
	console.log("Event received from Discord:", payload.t);

	if (payload.op === GatewayOpcodes.Hello) {
		console.log("Received HELLO, starting gateway heartbeat");
		startGatewayHeartbeat(payload.d.heartbeat_interval);
	}

	if (payload.op === GatewayOpcodes.HeartbeatAck) {
		console.log("Received Heartbeat ACK from Discord gateway");
		awaitingHeartbeatAck = false;
	}

	if (payload.t === "READY" || payload.t === "RESUMED") {
		if (!heartbeatInterval) {
			// If HELLO was not received, start the heartbeat using an estimated interval
			console.log("Starting gateway heartbeat from READY or RESUMED");
			startGatewayHeartbeat(41250); // Approximate default interval (41.25s)
		}
		sessionId = payload.d.session_id;
		sequence = payload.s;
		console.log("Session ID set:", sessionId, "Sequence:", sequence);
	}

	// Track sequence for each event to ensure resumption accuracy
	if (payload.s !== null) {
		sequence = payload.s;
	}

	// Forward all messages from Discord to the client
	if (client && client.readyState === WebSocket.OPEN) {
		client.send(JSON.stringify(payload));
	}
});

console.log("WebSocket proxy server started on ws://localhost:8080");

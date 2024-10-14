const WebSocket = require("ws");
const http = require("http");
const { EventEmitter } = require("events");
const crypto = require("crypto");
const { promisify } = require("util");
const setTimeoutPromise = promisify(setTimeout);
const { InMemoryCache } = require("./InMemoryCache");
const { CONFIG } = require("./config");
const { events } = require("./dispatch");
const { Guilds } = require("./cache");
const { Ready, Shard, StateInner } = require("./state");
const { runServer } = require("./server");
const CloseFrame = require("./closeCodes");

const SHUTDOWN = { value: false };

async function run() {
	try {
		// Set up metrics collection (could be done with prom-client in JS)
		console.log("Setting up metrics");

		// Create a HTTP Client
		const client = createClient(CONFIG.token);

		// Check total shards required
		const gateway = await client.getGatewayBot();
		const session = gateway.session_start_limit;
		const shardCount = CONFIG.shards || gateway.shards;

		const queue = createQueue(session.max_concurrency, session.remaining, session.reset_after, session.total);

		const shardStart = CONFIG.shard_start || 0;
		const shardEnd = CONFIG.shard_end || shardCount;
		const shards = [];

		console.log(`Creating shards ${shardStart} to ${shardEnd - 1} of ${shardCount} total`);

		const readyState = new Ready();
		const dispatchTasks = [];

		for (let shardId = shardStart; shardId < shardEnd; shardId++) {
			const guildCache = new Guilds(new InMemoryCache());

			const shardStatus = new Shard({
				id: shardId,
				sender: createWebSocketSender(shardId, CONFIG.token),
				events: new EventEmitter(),
				ready: readyState,
				guilds: guildCache,
			});

			dispatchTasks.push(events(shardStatus, shardId));
			shards.push(shardStatus);
		}

		const state = new StateInner(shards, shardCount, new Map());

		await runServer(CONFIG.port, state); // Server to handle incoming connections

		process.on("SIGINT", () => handleShutdown(state));
		process.on("SIGTERM", () => handleShutdown(state));

		console.log("All shards created successfully");
	} catch (e) {
		console.error("Fatal error:", e);
	}
}

function createClient(token) {
	// Placeholder for creating HTTP client (e.g., using Axios or native http)
	return {
		getGatewayBot: async function () {
			// This would call Discord's API for the gateway bot details
			return {
				shards: 1,
				session_start_limit: {
					total: 1000,
					remaining: 500,
					reset_after: 3600000,
					max_concurrency: 1,
				},
			};
		},
	};
}

function createQueue(concurrency, remaining, resetAfter, total) {
	// Placeholder for queue logic
	console.log(`Setting up queue with concurrency ${concurrency}`);
	return {};
}

function createWebSocketSender(shardId, token) {
	// Placeholder for WebSocket connection (can be used with ws)
	return {
		send: (data) => console.log(`Shard ${shardId} sending data:`, data),
		close: (code) => console.log(`Shard ${shardId} closing connection with code ${code}`),
	};
}

async function handleShutdown(state) {
	console.log("Shutting down...");
	SHUTDOWN.value = true;

	// Close all shard connections gracefully
	for (let shard of state.shards) {
		shard.sender.close(CloseFrame.NORMAL);
	}

	await setTimeoutPromise(10000); // Simulate waiting for graceful shutdown

	console.log("Shutdown complete.");
}

// Simulate running the function
run();

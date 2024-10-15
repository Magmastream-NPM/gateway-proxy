const fs = require("fs");
const { watch } = require("fs");
const { exit } = require("process");
const { parse } = require("path");
const { Lazy } = require("lazy-val");
const { EventEmitter } = require("events");

class Config {
	constructor({
		log_level = defaultLogLevel(),
		token = tokenFallback(),
		intents,
		port = defaultPort(),
		shards,
		shard_start,
		shard_end,
		activity,
		status = defaultStatus(),
		backpressure = defaultBackpressure(),
		validate_token = defaultValidateToken(),
		twilight_http_proxy,
		externally_accessible_url,
		cache = new Cache(),
	}) {
		this.log_level = log_level;
		this.token = token;
		this.intents = intents;
		this.port = port;
		this.shards = shards;
		this.shard_start = shard_start;
		this.shard_end = shard_end;
		this.activity = activity;
		this.status = status;
		this.backpressure = backpressure;
		this.validate_token = validate_token;
		this.twilight_http_proxy = twilight_http_proxy;
		this.externally_accessible_url = externally_accessible_url;
		this.cache = cache;
	}
}

class Cache {
	constructor({
		channels = true,
		presences = false,
		current_member = true,
		emojis = false,
		members = false,
		roles = true,
		scheduled_events = false,
		stage_instances = false,
		stickers = false,
		users = false,
		voice_states = false,
	} = {}) {
		this.channels = channels;
		this.presences = presences;
		this.current_member = current_member;
		this.emojis = emojis;
		this.members = members;
		this.roles = roles;
		this.scheduled_events = scheduled_events;
		this.stage_instances = stage_instances;
		this.stickers = stickers;
		this.users = users;
		this.voice_states = voice_states;
	}
}

function defaultLogLevel() {
	return "info";
}

function tokenFallback() {
	if (process.env.TOKEN) {
		return process.env.TOKEN;
	} else {
		console.error("Config Error: token is not present and TOKEN environment variable is not set");
		exit(1);
	}
}

function defaultPort() {
	return 7878;
}

function defaultStatus() {
	return "online"; // Equivalent of Status::Online in Rust
}

function defaultBackpressure() {
	return 100;
}

function defaultValidateToken() {
	return true;
}

class ErrorClass extends Error {
	constructor(message) {
		super(message);
		this.name = "ErrorClass";
	}
}

function loadConfig(path) {
	try {
		const content = fs.readFileSync(path, "utf8");
		return JSON.parse(content);
	} catch (err) {
		throw new ErrorClass(`File ${path} not found or access denied`);
	}
}

const CONFIG = new Lazy(() => {
	try {
		return loadConfig("config.json");
	} catch (err) {
		console.error(`Config Error: ${err.message}`);
		exit(1);
	}
});

// Watch for changes in the config file
function watchConfigChanges(reloadCallback) {
	try {
		fs.watch("config.json", (eventType, filename) => {
			if (eventType === "change") {
				try {
					const config = loadConfig("config.json");
					reloadCallback(config.log_level);
					console.info("Config was modified, reloaded log-level");
				} catch (err) {
					console.error("Config was modified, but failed to reload");
				}
			}
		});
		console.debug("Inotify is initialized");
	} catch (err) {
		console.error("Failed to initialize file watcher, log-levels cannot be reloaded on the fly");
	}
}

// Example of using watchConfigChanges
function reloadLogLevel(logLevel) {
	// This function can be customized to handle reloading logic
	console.log(`Reloading log-level to: ${logLevel}`);
}

// Start watching for config changes
watchConfigChanges(reloadLogLevel);

module.exports = { CONFIG };

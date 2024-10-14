const { EventEmitter } = require("events");
const { randomBytes } = require("crypto");

// Ready state manager
class Ready {
  constructor() {
    this.inner = null;
    this.changed = new EventEmitter();
  }

  async waitChanged() {
    return new Promise((resolve) => {
      this.changed.once("changed", resolve);
    });
  }

  isReady() {
    return this.inner !== null;
  }

  setReady(payload) {
    this.inner = payload;
    this.changed.emit("changed");
  }

  setNotReady() {
    this.inner = null;
    this.changed.emit("changed");
  }

  async waitUntilReady() {
    while (!this.isReady()) {
      await this.waitChanged();
    }
    return this.inner;
  }
}

// Shard state
class Shard {
  constructor(id, sender, events, guilds) {
    this.id = id;
    this.sender = sender; // Message sender (equivalent to twilight_gateway::MessageSender)
    this.events = events; // Broadcasting events (equivalent to broadcast::Sender)
    this.ready = new Ready(); // Ready state manager
    this.guilds = guilds; // Cache for guilds (equivalent to cache::Guilds)
  }
}

// Session for a client
class Session {
  constructor(shard_id, compress = null) {
    this.shard_id = shard_id;
    this.compress = compress;
  }
}

// Global state for all shards
class StateInner {
  constructor(shards, shard_count) {
    this.shards = shards; // List of shards
    this.shard_count = shard_count; // Total shard count
    this.sessions = new Map(); // Active sessions
  }

  // Get a session by its ID
  getSession(session_id) {
    return this.sessions.get(session_id) || null;
  }

  // Create a new session and return its ID
  createSession(session) {
    const session_id = randomBytes(16).toString("hex"); // 32 characters in hex (16 bytes)
    this.sessions.set(session_id, session);
    return session_id;
  }
}

// Helper to wrap the StateInner in an Arc-like structure using Node's references
class State {
  constructor(inner) {
    this.inner = inner;
  }

  get shards() {
    return this.inner.shards;
  }

  get shardCount() {
    return this.inner.shard_count;
  }

  getSession(session_id) {
    return this.inner.getSession(session_id);
  }

  createSession(session) {
    return this.inner.createSession(session);
  }
}

// Usage example
const shardSender = {}; // Example placeholder for message sender
const broadcastEmitter = new EventEmitter(); // Broadcasting events
const guildsCache = {}; // Example placeholder for guild cache

const shard = new Shard(0, shardSender, broadcastEmitter, guildsCache);
const stateInner = new StateInner([shard], 1);
const state = new State(stateInner);

// Create a session
const session = new Session(0, true);
const sessionId = state.createSession(session);

console.log(`Created session with ID: ${sessionId}`);

module.exports = { Ready, Shard, StateInner };

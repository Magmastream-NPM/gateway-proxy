const { WebSocket } = require("ws");
const { EventEmitter } = require("events");
const metrics = require("metrics");
const { setTimeout } = require("timers/promises");

const TEN_SECONDS = 10000; // Duration in milliseconds

class ShardState {
  constructor() {
    this.ready = new ReadyState();
    this.guilds = new GuildCache();
  }
}

class ReadyState {
  setReady(data) {
    this.readyData = data;
  }

  setNotReady() {
    this.readyData = null;
  }
}

class GuildCache {
  constructor() {
    this.guilds = [];
    // Add other cache objects here (channels, emojis, etc.)
  }

  update(event) {
    // Handle guild updates based on the event
  }

  stats() {
    return {
      emojis: () => this.guilds.length, // Example: number of guilds as emojis count
      guilds: () => this.guilds.length,
      members: () => 0, // Add members count logic here
      presences: () => 0, // Add presences count logic here
      channels: () => 0, // Add channels count logic here
      roles: () => 0, // Add roles count logic here
      unavailable_guilds: () => 0, // Add unavailable guilds logic here
      users: () => 0, // Add users count logic here
      voice_states: () => 0, // Add voice states count logic here
    };
  }
}

async function events(shard, shardState, shardId, broadcastTx) {
  let isReady = false;
  let lastMetricsUpdate = Date.now();
  console.log(shardId);
  const shardIdStr = shardId.toString();
  const eventTypeFlags = CONFIG.cache; // Assuming CONFIG.cache contains relevant flags

  shard.on("message", async (payload) => {
    const now = Date.now();

    // Update metrics if 10 seconds have passed since the last update
    if (now - lastMetricsUpdate > TEN_SECONDS) {
      const latencies = shard.getLatencies(); // Replace with actual method to get latencies
      const connectionState = shard.getState(); // Replace with actual method to get state
      updateShardStatistics(shardIdStr, shardState, connectionState, latencies);
      lastMetricsUpdate = now;
    }

    let event;
    try {
      event = GatewayEvent.fromJson(payload);
    } catch (err) {
      console.error("Failed to deserialize gateway event");
      return;
    }

    const [op, sequence, eventType] = event.intoParts();

    if (eventType) {
      metrics
        .counter("gateway_shard_events", {
          shard: shardIdStr,
          event_type: eventType.value,
        })
        .increment(1);

      if (eventType.value === "READY") {
        let ready;
        try {
          ready = JSON.parse(payload);
        } catch (err) {
          console.error("Failed to parse READY event");
          return;
        }

        // Clear guilds and override URL
        ready.d.guilds = [];
        ready.d.resume_gateway_url = CONFIG.externally_accessible_url;

        shardState.ready.setReady(ready.d);
        isReady = true;
      } else if (eventType.value === "RESUMED") {
        isReady = true;
      } else if (op === 0 && isReady) {
        // Relay event to clients if it's dispatchable
        broadcastTx.emit("message", [payload, sequence]);
      }
    }

    // Parse the event for further processing if necessary
    const parsedEvent = parseEvent(payload, eventTypeFlags);
    if (parsedEvent) {
      switch (parsedEvent.type) {
        case "Dispatch":
          shardState.guilds.update(parsedEvent.event);
          break;
        case "InvalidateSession":
          console.debug(
            `[Shard ${shardId}] Session invalidated, resumable: ${parsedEvent.canResume}`
          );
          if (!parsedEvent.canResume) {
            shardState.ready.setNotReady();
          }
          isReady = false;
          break;
        default:
          break;
      }
    }
  });

  shard.on("close", () => {
    if (isReady) {
      console.warn(`Shard ${shardId} stream closed`);
    } else {
      console.info(`Shard ${shardId} received close`);
    }
  });
}

function updateShardStatistics(
  shardIdStr,
  shardState,
  connectionState,
  latencies
) {
  const connectionStatus = getConnectionStatus(connectionState);

  const latency = latencies.length ? latencies[0] : NaN;

  metrics
    .histogram("gateway_shard_latency_histogram", { shard: shardIdStr })
    .record(latency);
  metrics.gauge("gateway_shard_latency", { shard: shardIdStr }).set(latency);
  metrics
    .histogram("gateway_shard_status", { shard: shardIdStr })
    .record(connectionStatus);

  const stats = shardState.guilds.stats();

  metrics
    .gauge("gateway_cache_emojis", { shard: shardIdStr })
    .set(stats.emojis());
  metrics
    .gauge("gateway_cache_guilds", { shard: shardIdStr })
    .set(stats.guilds());
  metrics
    .gauge("gateway_cache_members", { shard: shardIdStr })
    .set(stats.members());
  metrics
    .gauge("gateway_cache_presences", { shard: shardIdStr })
    .set(stats.presences());
  metrics
    .gauge("gateway_cache_channels", { shard: shardIdStr })
    .set(stats.channels());
  metrics
    .gauge("gateway_cache_roles", { shard: shardIdStr })
    .set(stats.roles());
  metrics
    .gauge("gateway_cache_unavailable_guilds", { shard: shardIdStr })
    .set(stats.unavailable_guilds());
  metrics
    .gauge("gateway_cache_users", { shard: shardIdStr })
    .set(stats.users());
  metrics
    .gauge("gateway_cache_voice_states", { shard: shardIdStr })
    .set(stats.voice_states());
}

function getConnectionStatus(state) {
  switch (state) {
    case "ACTIVE":
      return 4;
    case "DISCONNECTED":
      return 1;
    case "IDENTIFYING":
      return 2;
    case "RESUMING":
      return 3;
    case "CLOSED":
      return 0;
    default:
      return NaN;
  }
}

function parseEvent(payload, eventTypeFlags) {
  try {
    const event = JSON.parse(payload);
    // Handle parsing logic for different event types
    return event;
  } catch (err) {
    console.error("Failed to parse event:", err);
    return null;
  }
}

module.exports = {
  events,
  updateShardStatistics,
};

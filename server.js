const WebSocket = require("ws");
const zlib = require("zlib");
const promClient = require("prom-client");
const http = require("http");
const { EventEmitter } = require("events");

const HELLO = '{"t":null,"s":null,"op":10,"d":{"heartbeat_interval":41250}}';
const HEARTBEAT_ACK = '{"t":null,"s":null,"op":11,"d":null}';
const INVALID_SESSION = '{"t":null,"s":null,"op":9,"d":false}';
const RESUMED = '{"t":"RESUMED","s":null,"op":0,"d":{}}';
const TRAILER = Buffer.from([0x00, 0x00, 0xff, 0xff]);

async function sinkFromQueue(addr, useZlib, compressRx, messageStream, ws) {
  let compress = zlib.createDeflateRaw({ level: zlib.constants.Z_BEST_SPEED });
  let compressionBuffer = [];

  // Send HELLO message
  if (useZlib) {
    compressionBuffer = compressAndFlush(compress, HELLO);
    ws.send(Buffer.concat(compressionBuffer));
  } else {
    ws.send(HELLO);
  }

  if ((await compressRx) === true) {
    useZlib = true;
  }

  for await (const msg of messageStream) {
    if (useZlib) {
      compressionBuffer = compressAndFlush(compress, msg);
      ws.send(Buffer.concat(compressionBuffer));
    } else {
      ws.send(msg);
    }
  }
}

// Compression logic (similar to `compress_full` in Rust)
function compressAndFlush(compressor, input) {
  const chunks = [];
  let buffer = compressor.write(input);
  chunks.push(buffer);

  compressor.flush(zlib.constants.Z_SYNC_FLUSH);
  buffer = compressor.read();
  if (buffer) chunks.push(buffer);

  return chunks;
}

async function handleClient(ws, state, useZlib) {
  const streamWriter = new EventEmitter();
  const messageStream = new EventEmitter();
  const compressRx = new Promise((resolve) => {
    ws.on("message", (msg) => {
      const payload = JSON.parse(msg);
      // Check if compression is enabled in the IDENTIFY payload
      resolve(payload.d.compress || false);
    });
  });

  // Forward messages from client
  let shardForwardTask;
  let shardSender = null;

  ws.on("message", async (msg) => {
    const payload = JSON.parse(msg);

    switch (payload.op) {
      case 1: // Heartbeat
        ws.send(HEARTBEAT_ACK);
        break;
      case 2: // Identify
        const identify = payload.d;
        const { shard_id, shard_count } = identify.shard;

        if (shard_count !== state.shardCount) {
          console.warn("Shard count mismatch, disconnecting");
          ws.close();
          return;
        }

        if (shard_id >= shard_count) {
          console.warn("Shard ID out of range, disconnecting");
          ws.close();
          return;
        }

        if (identify.token !== state.token) {
          console.warn("Token mismatch, disconnecting");
          ws.close();
          return;
        }

        // Store the shard's sender and start forwarding events
        shardSender = state.shards[shard_id];
        shardForwardTask = forwardShard(
          identify,
          shardSender,
          streamWriter,
          ws
        );
        break;

      case 6: // Resume
        const resume = payload.d;

        if (resume.token !== state.token) {
          console.warn("Token mismatch during RESUME, disconnecting");
          ws.send(INVALID_SESSION);
          ws.close();
          return;
        }

        if (shardSender) {
          shardForwardTask = forwardShard(
            resume,
            shardSender,
            streamWriter,
            ws
          );
          ws.send(RESUMED);
        } else {
          ws.send(INVALID_SESSION);
        }
        break;
      default:
        // Forward payload to the shard
        if (shardSender) {
          shardSender.send(msg);
        }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    if (shardForwardTask) {
      shardForwardTask.abort();
    }
  });

  await sinkFromQueue(
    ws._socket.remoteAddress,
    useZlib,
    compressRx,
    messageStream,
    ws
  );
}

async function forwardShard(session, shardSender, streamWriter, ws) {
  // Mock forward logic, forward all shard events to WebSocket
  shardSender.on("event", (event) => {
    ws.send(JSON.stringify(event));
  });
}

async function startWebSocketServer(port, state) {
  const server = new WebSocket.Server({ port });

  server.on("connection", (ws, req) => {
    const useZlib = false; // Default to no compression
    handleClient(ws, state, useZlib);
  });

  console.log(`WebSocket server listening on port ${port}`);
}

const state = {
  shardCount: 2,
  token: "your-bot-token",
  shards: [new EventEmitter(), new EventEmitter()], // Mock shards
};

// Start the WebSocket server on port 8080
startWebSocketServer(8080, state);

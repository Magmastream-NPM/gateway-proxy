const http = require("http");
const crypto = require("crypto");
const WebSocket = require("ws");
const { URL } = require("url");

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// Handle WebSocket upgrade request
function handleWebSocketUpgrade(req, socket, head, state) {
	const url = new URL(req.url, `http://${req.headers.host}`);
	const queryParams = url.searchParams;
	const useZlib = queryParams.has("compress") && queryParams.get("compress") === "zlib-stream";

	if (req.headers.upgrade.toLowerCase() !== "websocket" || !req.headers["sec-websocket-key"] || req.headers["sec-websocket-version"] !== "13") {
		socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
		socket.destroy();
		return;
	}

	const websocketKey = req.headers["sec-websocket-key"];
	const acceptKey = generateWebSocketAcceptKey(websocketKey);

	const responseHeaders = [
		"HTTP/1.1 101 Switching Protocols",
		"Upgrade: websocket",
		"Connection: Upgrade",
		`Sec-WebSocket-Accept: ${acceptKey}`,
		"Sec-WebSocket-Version: 13",
		"\r\n",
	];

	// Write headers to upgrade to WebSocket
	socket.write(responseHeaders.join("\r\n"));

	// Now we have a WebSocket connection
	const ws = new WebSocket(null);
	ws.setSocket(socket, head, { perMessageDeflate: useZlib });

	// Handle client connection
	handleClientConnection(ws, state, useZlib);
}

// Generate the WebSocket Accept key using SHA1 hash
function generateWebSocketAcceptKey(websocketKey) {
	return crypto
		.createHash("sha1")
		.update(websocketKey + GUID)
		.digest("base64");
}

// Example function for handling WebSocket connection
function handleClientConnection(ws, state, useZlib) {
	console.log("Client connected with zlib compression:", useZlib);

	ws.on("message", (message) => {
		console.log("Received message:", message.toString());
		// Handle incoming messages from the client
	});

	ws.on("close", () => {
		console.log("Client disconnected");
	});
}

// Example server
const server = http.createServer((req, res) => {
	res.writeHead(400, { "Content-Type": "text/plain" });
	res.end("WebSocket connections only");
});

// Listen for WebSocket upgrade requests
server.on("upgrade", (req, socket, head) => {
	const state = {}; // Replace with your actual state object
	handleWebSocketUpgrade(req, socket, head, state);
});

server.listen(8080, () => {
	console.log("Server is listening on port 8080");
});

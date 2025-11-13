// server.js
const WebSocket = require("ws");
const connectDB = require("./config/db");
const Message = require("./models/message");
const dotenv = require("dotenv");
dotenv.config();

connectDB();
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
console.log("🚀 WebSocket server running on ws://localhost:8080");

// Store connected clients and their info
const clients = new Map(); // Map<ws, { user, target }>

// store unread messages info and count
const userUnreadMap = new Map(); // Map<username, { [fromUser]: count }>

// Helper: unique chatId
function getChatId(userA, userB) {
  return [userA, userB].sort().join("_");
}

// Helper: broadcast list of online users
function broadcastOnlineUsers() {
  const users = Array.from(clients.values())
    .map((c) => c.user)
    .filter(Boolean); // only users who registered
  const payload = JSON.stringify({ type: "onlineUsers", data: users });
  for (const client of clients.keys()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected ✅");

  ws.on("message", async (raw) => {
    try {
      const data = JSON.parse(raw);

      // 🟦 1️⃣ Register new user
      if (data.type === "registerUser") {
        clients.set(ws, { user: data.user });
        console.log(`🟢 ${data.user} joined`);
        broadcastOnlineUsers();
        return;
      }

      // 🟨 2️⃣ User joins a chat
      if (data.type === "joinChat") {
        clients.set(ws, { user: data.user, target: data.target });
        const chatId = getChatId(data.user, data.target);
        const oldMessages = await Message.find({ chatId }).sort({
          createdAt: 1,
        });
        ws.send(JSON.stringify({ type: "history", data: oldMessages }));

        // --- RESET UNREAD COUNT HERE ---
        const unread = userUnreadMap.get(data.user) || {};
        if (unread[data.target]) {
          delete unread[data.target];
          userUnreadMap.set(data.user, unread);
        }

        // Send updated unread counts
        ws.send(JSON.stringify({ type: "unreadUpdate", data: unread }));

        return;
      }

      // 🟩 3️⃣ User sends a message
      if (data.type === "message") {
        const info = clients.get(ws);
        if (!info || !info.target) return;
        const chatId = getChatId(info.user, info.target);

        // Save to DB
        const newMsg = await Message.create({
          user: info.user,
          text: data.text,
          chatId,
        });

        const payload = JSON.stringify({ type: "message", data: newMsg });

        for (const [client, cinfo] of clients.entries()) {
          if (
            cinfo &&
            getChatId(cinfo.user, cinfo.target) === chatId &&
            client.readyState === WebSocket.OPEN
          ) {
            client.send(payload);
          }
        }

        // --- ADD THIS UNREAD LOGIC BELOW ---
        const receiver = info.target;
        const sender = info.user;

        // Check if receiver is connected
        const receiverClient = Array.from(clients.entries()).find(
          ([, c]) => c.user === receiver
        );

        // If receiver exists but is not chatting with sender, mark unread
        if (receiverClient) {
          const receiverInfo = receiverClient[1];

          if (receiverInfo.target !== sender) {
            const currentUnread = userUnreadMap.get(receiver) || {};
            currentUnread[sender] = (currentUnread[sender] || 0) + 1;
            userUnreadMap.set(receiver, currentUnread);

            // Send updated unread counts to receiver
            const unreadPayload = JSON.stringify({
              type: "unreadUpdate",
              data: currentUnread,
            });
            receiverClient[0].send(unreadPayload);
          }
        }
        return;
      }
    } catch (err) {
      console.error("❌ Error handling WS message:", err);
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info && info.user) console.log(`🔴 ${info.user} left`);
    clients.delete(ws);
    broadcastOnlineUsers();
  });
});

// client.js
const WebSocket = require("ws");
const readline = require("readline");

// Prompt for username before connecting
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter your username: ", (name) => {
  const ws = new WebSocket("ws://localhost:8080");

  ws.on("open", () => {
    console.log(`✅ Connected as ${name}`);
    rl.setPrompt(`${name}: `);
    rl.prompt();

    rl.on("line", (line) => {
      // Send message as JSON with username
      const message = JSON.stringify({ user: name, text: line });
      ws.send(message);
      rl.prompt();
    });
  });

  ws.on("message", (data) => {
    try {
      const { user, text } = JSON.parse(data);
      console.log(`\n${user}: ${text}`);
    } catch {
      console.log(`\n${data.toString()}`);
    }
    rl.prompt();
  });

  ws.on("close", () => {
    console.log("❌ Disconnected");
    rl.close();
  });
});

const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const featuredRooms = [
  { id: 1, title: "Launch Lounge", description: "Meet founders and creators sharing their latest projects." },
  { id: 2, title: "Community Studio", description: "Collaborate on ideas, events, and shared goals." },
  { id: 3, title: "Chill Hangout", description: "Casual conversation space for new members and friends." }
];

const chatMessages = [
  {
    id: 1,
    name: "PARALLAX Bot",
    message: "Welcome to the chat. Share your thoughts, play nice, and enjoy the flow.",
    timestamp: new Date().toISOString()
  }
];

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "chat.html"));
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "PARALLAX backend is running." });
});

app.get("/api/community", (req, res) => {
  res.json({ community: "PARALLAX", activeRooms: featuredRooms.length, rooms: featuredRooms });
});

app.get("/api/chat/messages", (req, res) => {
  res.json({ messages: chatMessages.slice(-50) });
});

app.post("/api/chat/messages", (req, res) => {
  const { name, message } = req.body;
  if (!name || !message) {
    return res.status(400).json({ error: "Name and message are required." });
  }

  const newMessage = {
    id: chatMessages.length + 1,
    name,
    message,
    timestamp: new Date().toISOString()
  };

  chatMessages.push(newMessage);
  return res.status(201).json(newMessage);
});

app.post("/api/join", (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required to join." });
  }

  return res.status(201).json({
    message: `Welcome to PARALLAX, ${name}!`,
    member: {
      name,
      email,
      joinedAt: new Date().toISOString()
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

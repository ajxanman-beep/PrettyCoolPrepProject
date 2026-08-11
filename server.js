const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const featuredRooms = [
  { id: 1, title: "Launch Lounge", description: "Meet founders and creators sharing their latest projects." },
  { id: 2, title: "Community Studio", description: "Collaborate on ideas, events, and shared goals." },
  { id: 3, title: "Chill Hangout", description: "Casual conversation space for new members and friends." }
];

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "PrettyCool Community backend is running." });
});

app.get("/api/community", (req, res) => {
  res.json({ community: "PrettyCool", activeRooms: featuredRooms.length, rooms: featuredRooms });
});

app.post("/api/join", (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required to join." });
  }

  return res.status(201).json({
    message: `Welcome to PrettyCool, ${name}!`,
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

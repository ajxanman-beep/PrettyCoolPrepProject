const express = require("express");
const path = require("path");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const featuredRooms = [
  { id: 1, title: "Launch Lounge", description: "Meet founders and creators sharing their latest projects." },
  { id: 2, title: "Community Studio", description: "Collaborate on ideas, events, and shared goals." },
  { id: 3, title: "Chill Hangout", description: "Casual conversation space for new members and friends." }
];

const users = {};
const sessions = {};
const chatMessages = [];

const hashPassword = (password) => crypto.createHash("sha256").update(password).digest("hex");

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split("; ").reduce((acc, cookie) => {
    const [name, value] = cookie.split("=");
    if (name && value) acc[name] = value;
    return acc;
  }, {});

const createSession = (username) => {
  const sessionId = crypto.randomBytes(24).toString("hex");
  sessions[sessionId] = { username, createdAt: Date.now() };
  return sessionId;
};

const getSession = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.sessionId;
  return sessionId && sessions[sessionId] ? sessions[sessionId] : null;
};

const setSessionCookie = (res, sessionId) => {
  res.setHeader("Set-Cookie", `sessionId=${sessionId}; HttpOnly; Path=/; SameSite=Lax`);
};

const clearSessionCookie = (res) => {
  res.setHeader("Set-Cookie", "sessionId=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
};

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/chat", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.redirect("/auth");
  }
  res.sendFile(path.join(__dirname, "chat.html"));
});

app.get("/auth", (req, res) => {
  const session = getSession(req);
  if (session) {
    return res.redirect("/chat");
  }
  res.sendFile(path.join(__dirname, "auth.html"));
});

app.get("/api/auth/me", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.json({ username: session.username });
});

app.post("/api/auth/signup", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (users[username]) {
    return res.status(409).json({ error: "Username already exists." });
  }

  users[username] = { username, passwordHash: hashPassword(password) };
  const sessionId = createSession(username);
  setSessionCookie(res, sessionId);
  res.status(201).json({ username });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = users[username];
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const sessionId = createSession(username);
  setSessionCookie(res, sessionId);
  res.json({ username });
});

app.post("/api/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.sessionId;
  if (sessionId) {
    delete sessions[sessionId];
  }
  clearSessionCookie(res);
  res.json({ message: "Logged out." });
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "PARALLAX backend is running." });
});

app.get("/api/community", (req, res) => {
  res.json({ community: "PARALLAX", activeRooms: featuredRooms.length, rooms: featuredRooms });
});

app.get("/api/chat/messages", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.json({ messages: chatMessages.slice(-50) });
});

app.post("/api/chat/messages", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const newMessage = {
    id: chatMessages.length + 1,
    name: session.username,
    message,
    timestamp: new Date().toISOString()
  };

  chatMessages.push(newMessage);
  res.status(201).json(newMessage);
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

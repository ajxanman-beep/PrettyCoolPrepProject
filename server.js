const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { Readable } = require("stream");
const cloudinary = require("cloudinary").v2;
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "parallax",
  api_key: process.env.CLOUDINARY_API_KEY || "586198498726618",
  api_secret: process.env.CLOUDINARY_API_SECRET || "0HFipV4PrdIIastxqdAZSR9dA-M"
});

const featuredRooms = [
  { id: 1, title: "Launch Lounge", description: "Meet founders and creators sharing their latest projects." },
  { id: 2, title: "Community Studio", description: "Collaborate on ideas, events, and shared goals." },
  { id: 3, title: "Chill Hangout", description: "Casual conversation space for new members and friends." }
];

const users = {};
const sessions = {};
const chatMessages = [];
const communityPosts = [];
const communityGames = [];
const communityVideos = [];

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
    return res.redirect(`/auth?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  res.sendFile(path.join(__dirname, "chat.html"));
});

app.get("/community", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.redirect(`/auth?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  res.sendFile(path.join(__dirname, "community.html"));
});

app.get("/auth", (req, res) => {
  const session = getSession(req);
  if (session) {
    const redirectTo = req.query.redirect && req.query.redirect.startsWith("/") ? req.query.redirect : "/chat";
    return res.redirect(redirectTo);
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
  const { username, password, redirect } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (users[username]) {
    return res.status(409).json({ error: "Username already exists." });
  }

  users[username] = { username, passwordHash: hashPassword(password) };
  const sessionId = createSession(username);
  setSessionCookie(res, sessionId);
  const target = redirect && redirect.startsWith("/") ? redirect : "/chat";
  res.status(201).json({ username, redirect: target });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password, redirect } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = users[username];
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const sessionId = createSession(username);
  setSessionCookie(res, sessionId);
  const target = redirect && redirect.startsWith("/") ? redirect : "/chat";
  res.json({ username, redirect: target });
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

app.get("/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.sessionId;
  if (sessionId) {
    delete sessions[sessionId];
  }
  clearSessionCookie(res);
  res.redirect("/auth");
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", message: "PARALLAX backend is running." });
});

app.get("/api/community", (req, res) => {
  res.json({ community: "PARALLAX", activeRooms: featuredRooms.length, rooms: featuredRooms });
});

const streamUpload = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    Readable.from(buffer).pipe(uploadStream);
  });

app.post("/api/uploads", upload.single("file"), async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const result = await streamUpload(req.file.buffer, {
      resource_type: "auto",
      folder: "parallax-community",
      use_filename: true,
      unique_filename: true,
      overwrite: false
    });
    res.status(201).json(result);
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    res.status(500).json({ error: "Upload failed." });
  }
});

app.get("/api/community/posts", (req, res) => {
  res.json({ posts: communityPosts.slice().reverse() });
});

app.post("/api/community/posts", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { title, body, attachmentUrl, attachmentType, linkUrl } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: "Title and body are required." });
  }

  const newPost = {
    id: communityPosts.length + 1,
    author: session.username,
    title,
    body,
    attachmentUrl: attachmentUrl || "",
    attachmentType: attachmentType || "link",
    linkUrl: linkUrl || "",
    likes: 0,
    dislikes: 0,
    comments: [],
    timestamp: new Date().toISOString()
  };

  communityPosts.push(newPost);
  res.status(201).json(newPost);
});

app.post("/api/community/posts/:postId/react", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const post = communityPosts.find((item) => item.id === Number(req.params.postId));
  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }

  const { reaction } = req.body;
  if (reaction === "like") {
    post.likes += 1;
  } else if (reaction === "dislike") {
    post.dislikes += 1;
  } else {
    return res.status(400).json({ error: "Invalid reaction." });
  }

  res.json(post);
});

app.post("/api/community/posts/:postId/comment", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const post = communityPosts.find((item) => item.id === Number(req.params.postId));
  if (!post) {
    return res.status(404).json({ error: "Post not found." });
  }

  const { comment } = req.body;
  if (!comment) {
    return res.status(400).json({ error: "Comment text is required." });
  }

  post.comments.push({ author: session.username, text: comment, timestamp: new Date().toISOString() });
  res.json(post);
});

app.get("/api/community/games", (req, res) => {
  res.json({ games: communityGames.slice().reverse() });
});

app.post("/api/community/games", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { title, description, gameUrl } = req.body;
  if (!title || !description || !gameUrl) {
    return res.status(400).json({ error: "Title, description, and game URL are required." });
  }

  const newGame = {
    id: communityGames.length + 1,
    author: session.username,
    title,
    description,
    gameUrl,
    timestamp: new Date().toISOString()
  };

  communityGames.push(newGame);
  res.status(201).json(newGame);
});

app.get("/api/community/videos", (req, res) => {
  res.json({ videos: communityVideos.slice().reverse() });
});

app.post("/api/community/videos", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { title, description, videoUrl } = req.body;
  if (!title || !description || !videoUrl) {
    return res.status(400).json({ error: "Title, description, and video URL are required." });
  }

  const newVideo = {
    id: communityVideos.length + 1,
    author: session.username,
    title,
    description,
    videoUrl,
    likes: 0,
    shares: 0,
    comments: [],
    timestamp: new Date().toISOString()
  };

  communityVideos.push(newVideo);
  res.status(201).json(newVideo);
});

app.post("/api/community/videos/:videoId/react", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const video = communityVideos.find((item) => item.id === Number(req.params.videoId));
  if (!video) {
    return res.status(404).json({ error: "Video not found." });
  }

  const { reaction } = req.body;
  if (reaction === "like") {
    video.likes += 1;
  } else if (reaction === "share") {
    video.shares += 1;
  } else {
    return res.status(400).json({ error: "Invalid reaction." });
  }

  res.json(video);
});

app.post("/api/community/videos/:videoId/comment", (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const video = communityVideos.find((item) => item.id === Number(req.params.videoId));
  if (!video) {
    return res.status(404).json({ error: "Video not found." });
  }

  const { comment } = req.body;
  if (!comment) {
    return res.status(400).json({ error: "Comment text is required." });
  }

  video.comments.push({ author: session.username, text: comment, timestamp: new Date().toISOString() });
  res.json(video);
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

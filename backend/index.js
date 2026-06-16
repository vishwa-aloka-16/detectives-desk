const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const MONGO_URI = process.env.MONGO_URI;
const READING_DURATION_SECONDS = 90;
const QUESTION_DURATION_SECONDS = 20;
const LEADERBOARD_DURATION_SECONDS = 6;

const defaultCase = {
  slug: "ravenwood-manor",
  title: "The Vanishing at Ravenwood Manor",
  difficulty: "Medium",
  readingTime: READING_DURATION_SECONDS,
  fragments: [
    {
      id: 1,
      type: "witness",
      label: "Witness Statement - Butler, Mr. Hawkins",
      content:
        "I heard a loud crash from the east wing around half past ten. When I arrived, the study window was shattered from the inside. Miss Clara's portrait had been removed from the wall. I noticed muddy boot prints leading toward the garden - small, narrow, not the master's.",
    },
    {
      id: 2,
      type: "newspaper",
      label: "The Ravenwood Gazette - Oct 14",
      content:
        "Prominent collector Lord Ashworth reports a priceless emerald brooch stolen from Ravenwood Manor. Police suspect an inside job as no forced entry was found at any door. The brooch, insured for 40,000 pounds, was last seen at dinner.",
    },
    {
      id: 3,
      type: "note",
      label: "Handwritten Note",
      content:
        "Meet me at the greenhouse. Midnight. Bring what you promised. - V",
    },
    {
      id: 4,
      type: "evidence",
      label: "Evidence Report - Lab Analysis",
      content:
        "Soil sample from boot prints contains rare white clay found only near the old Ravenwood well, 400 meters north of the manor. Fingerprints on the window frame partially match household staff. One unidentified left ring-finger print remains.",
    },
    {
      id: 5,
      type: "file",
      label: "Case File - Lord Ashworth's Statement",
      content:
        "Lord Ashworth stated he retired at 10 PM and heard nothing unusual. However, staff confirm his study light remained on past midnight. He claims the brooch was in the locked cabinet. The cabinet showed no signs of tampering.",
    },
  ],
  questions: [
    {
      id: 1,
      skill: "Inference",
      text: "Based on the evidence, where did the suspect most likely come from before entering the manor?",
      options: [
        "The village market",
        "The old Ravenwood well",
        "The greenhouse",
        "The guest cottage",
      ],
      correctIndex: 1,
      explanation:
        "The lab report links the rare white clay directly to the old Ravenwood well.",
    },
    {
      id: 2,
      skill: "Author's Purpose",
      text: "What does the handwritten note suggest about the theft?",
      options: [
        "It was spontaneous",
        "It was planned in advance",
        "It was accidental",
        "It was committed by the butler",
      ],
      correctIndex: 1,
      explanation:
        "The note arranges a meeting ahead of time, which points to planning and coordination.",
    },
    {
      id: 3,
      skill: "Supporting Details",
      text: "Which detail most clearly contradicts Lord Ashworth's statement?",
      options: [
        "The brooch was insured",
        "The cabinet was not tampered with",
        "His study light stayed on past midnight",
        "No forced entry was found",
      ],
      correctIndex: 2,
      explanation:
        "He claimed to retire at 10 PM, but the staff report says his study remained lit much later.",
    },
  ],
};

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
});

const gameSessionSchema = new mongoose.Schema(
  {
    roomCode: String,
    caseSlug: String,
    startedAt: Date,
    endedAt: Date,
    players: [
      {
        name: String,
        score: Number,
        streak: Number,
      },
    ],
  },
  { timestamps: true }
);

const GameSession =
  mongoose.models.GameSession || mongoose.model("GameSession", gameSessionSchema);

let activeRoom = null;

async function connectDatabase() {
  if (!MONGO_URI) {
    console.log("MongoDB not configured. Running with in-memory room state.");
    return;
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected.");
  } catch (error) {
    console.error("MongoDB connection failed. Continuing without persistence.", error.message);
  }
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function clearRoomTimers(room) {
  if (!room) {
    return;
  }

  ["readingTimer", "questionTimer", "leaderboardTimer"].forEach((key) => {
    if (room[key]) {
      clearTimeout(room[key]);
      room[key] = null;
    }
  });
}

function sortPlayers(players) {
  return [...players].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.joinedAt - right.joinedAt;
  });
}

function buildLeaderboard(room) {
  return sortPlayers(room.players).map((player, index) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    streak: player.streak,
    connected: player.connected,
    rank: index + 1,
  }));
}

function buildViewer(room, socketId) {
  if (room.hostSocketId === socketId) {
    return {
      id: room.hostId,
      name: room.hostName,
      isHost: true,
      score: 0,
      streak: 0,
      hasAnsweredCurrent: false,
    };
  }

  const player = room.players.find((entry) => entry.socketId === socketId);
  if (!player) {
    return null;
  }

  return {
    id: player.id,
    name: player.name,
    isHost: false,
    score: player.score,
    streak: player.streak,
    hasAnsweredCurrent: player.lastAnsweredQuestionIndex === room.currentQuestionIndex,
  };
}

function buildRoomState(room, socketId) {
  const state = {
    code: room.code,
    phase: room.phase,
    hostName: room.hostName,
    viewer: buildViewer(room, socketId),
    players: buildLeaderboard(room),
    caseData: {
      title: room.caseData.title,
      difficulty: room.caseData.difficulty,
      readingTime: room.caseData.readingTime,
      fragments: room.caseData.fragments,
      questionCount: room.caseData.questions.length,
    },
  };

  if (room.phase === "reading") {
    state.readingEndsAt = room.readingEndsAt;
  }

  if (room.phase === "question") {
    const question = room.caseData.questions[room.currentQuestionIndex];
    state.question = {
      id: question.id,
      text: question.text,
      skill: question.skill,
      options: question.options,
      number: room.currentQuestionIndex + 1,
      total: room.caseData.questions.length,
      endsAt: room.questionEndsAt,
      submissionsCount: room.answers.size,
    };
  }

  if (room.phase === "leaderboard") {
    const question = room.caseData.questions[room.currentQuestionIndex];
    state.questionResult = {
      id: question.id,
      text: question.text,
      skill: question.skill,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      number: room.currentQuestionIndex + 1,
      total: room.caseData.questions.length,
      endsAt: room.leaderboardEndsAt,
    };
  }

  if (room.phase === "finished") {
    state.finalResults = {
      leaderboard: buildLeaderboard(room),
      endedAt: room.endedAt,
    };
  }

  return state;
}

async function emitRoomState(room) {
  const sockets = await io.in(room.code).fetchSockets();
  sockets.forEach((socket) => {
    socket.emit("room:update", {
      room: buildRoomState(room, socket.id),
    });
  });
}

async function finishGame(room) {
  clearRoomTimers(room);
  room.phase = "finished";
  room.endedAt = Date.now();
  await emitRoomState(room);

  if (mongoose.connection.readyState === 1) {
    try {
      await GameSession.create({
        roomCode: room.code,
        caseSlug: room.caseData.slug,
        startedAt: new Date(room.startedAt),
        endedAt: new Date(room.endedAt),
        players: room.players.map((player) => ({
          name: player.name,
          score: player.score,
          streak: player.streak,
        })),
      });
    } catch (error) {
      console.error("Failed to save game session.", error.message);
    }
  }
}

async function finishQuestion(room) {
  clearTimeout(room.questionTimer);
  room.questionTimer = null;
  room.phase = "leaderboard";
  room.leaderboardEndsAt = Date.now() + LEADERBOARD_DURATION_SECONDS * 1000;
  await emitRoomState(room);

  room.leaderboardTimer = setTimeout(async () => {
    if (room.currentQuestionIndex + 1 >= room.caseData.questions.length) {
      await finishGame(room);
      return;
    }

    await startQuestion(room, room.currentQuestionIndex + 1);
  }, LEADERBOARD_DURATION_SECONDS * 1000);
}

async function startQuestion(room, questionIndex) {
  clearRoomTimers(room);
  room.phase = "question";
  room.currentQuestionIndex = questionIndex;
  room.questionStartedAt = Date.now();
  room.questionEndsAt = room.questionStartedAt + QUESTION_DURATION_SECONDS * 1000;
  room.answers = new Map();
  await emitRoomState(room);

  room.questionTimer = setTimeout(async () => {
    await finishQuestion(room);
  }, QUESTION_DURATION_SECONDS * 1000);
}

function createRoom(hostSocketId, hostName) {
  return {
    code: generateRoomCode(),
    hostId: `host-${Date.now()}`,
    hostSocketId,
    hostName,
    caseData: defaultCase,
    phase: "lobby",
    players: [],
    currentQuestionIndex: -1,
    startedAt: null,
    endedAt: null,
    answers: new Map(),
    readingTimer: null,
    questionTimer: null,
    leaderboardTimer: null,
    readingEndsAt: null,
    questionEndsAt: null,
    leaderboardEndsAt: null,
  };
}

function closeRoom(reason = "Room closed by host.") {
  if (!activeRoom) {
    return;
  }

  clearRoomTimers(activeRoom);
  io.to(activeRoom.code).emit("room:closed", { message: reason });
  activeRoom = null;
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    activeRoom: activeRoom
      ? {
          code: activeRoom.code,
          phase: activeRoom.phase,
          players: activeRoom.players.length,
        }
      : null,
  });
});

io.on("connection", (socket) => {
  socket.on("host:create-room", async ({ hostName }, callback = () => {}) => {
    if (activeRoom && activeRoom.phase !== "finished") {
      callback({ ok: false, message: "A demo room is already active. Close it first." });
      return;
    }

    activeRoom = createRoom(socket.id, hostName?.trim() || "Lead Detective");
    socket.join(activeRoom.code);
    await emitRoomState(activeRoom);
    callback({ ok: true, roomCode: activeRoom.code });
  });

  socket.on("player:join-room", async ({ roomCode, name }, callback = () => {}) => {
    if (!activeRoom || activeRoom.code !== roomCode) {
      callback({ ok: false, message: "Room code not found." });
      return;
    }

    if (activeRoom.players.length >= 50) {
      callback({ ok: false, message: "The room is full." });
      return;
    }

    if (activeRoom.phase !== "lobby") {
      callback({ ok: false, message: "The case has already started." });
      return;
    }

    const cleanName = (name || "").trim();
    if (!cleanName) {
      callback({ ok: false, message: "Please enter a detective name." });
      return;
    }

    activeRoom.players.push({
      id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      socketId: socket.id,
      name: cleanName,
      score: 0,
      streak: 0,
      connected: true,
      joinedAt: Date.now(),
      lastAnsweredQuestionIndex: -1,
    });

    socket.join(activeRoom.code);
    await emitRoomState(activeRoom);
    callback({ ok: true, roomCode: activeRoom.code });
  });

  socket.on("host:start-game", async (callback = () => {}) => {
    if (!activeRoom || activeRoom.hostSocketId !== socket.id) {
      callback({ ok: false, message: "Only the host can start the game." });
      return;
    }

    if (activeRoom.phase !== "lobby") {
      callback({ ok: false, message: "The game has already started." });
      return;
    }

    activeRoom.phase = "reading";
    activeRoom.startedAt = Date.now();
    activeRoom.readingEndsAt = Date.now() + activeRoom.caseData.readingTime * 1000;
    await emitRoomState(activeRoom);

    activeRoom.readingTimer = setTimeout(async () => {
      await startQuestion(activeRoom, 0);
    }, activeRoom.caseData.readingTime * 1000);

    callback({ ok: true });
  });

  socket.on("player:submit-answer", async ({ choiceIndex }, callback = () => {}) => {
    if (!activeRoom || activeRoom.phase !== "question") {
      callback({ ok: false, message: "No active question right now." });
      return;
    }

    const player = activeRoom.players.find((entry) => entry.socketId === socket.id);
    if (!player) {
      callback({ ok: false, message: "Player not found in this room." });
      return;
    }

    if (activeRoom.answers.has(player.id)) {
      callback({ ok: false, message: "Answer already submitted." });
      return;
    }

    const question = activeRoom.caseData.questions[activeRoom.currentQuestionIndex];
    const responseTime = Math.max(0, Date.now() - activeRoom.questionStartedAt);
    const correct = choiceIndex === question.correctIndex;
    const speedBonus = Math.max(
      0,
      Math.round(((QUESTION_DURATION_SECONDS * 1000 - responseTime) / 1000) * 15)
    );
    const streakBonus = correct && player.streak > 0 ? 150 : 0;
    const points = correct ? 500 + speedBonus + streakBonus : 0;

    activeRoom.answers.set(player.id, {
      choiceIndex,
      correct,
      responseTime,
      points,
    });

    player.score += points;
    player.streak = correct ? player.streak + 1 : 0;
    player.lastAnsweredQuestionIndex = activeRoom.currentQuestionIndex;

    await emitRoomState(activeRoom);
    callback({ ok: true, points, correct });

    if (activeRoom.answers.size >= activeRoom.players.length) {
      await finishQuestion(activeRoom);
    }
  });

  socket.on("host:close-room", (callback = () => {}) => {
    if (!activeRoom || activeRoom.hostSocketId !== socket.id) {
      callback({ ok: false, message: "Only the host can close the room." });
      return;
    }

    closeRoom();
    callback({ ok: true });
  });

  socket.on("disconnect", async () => {
    if (!activeRoom) {
      return;
    }

    if (activeRoom.hostSocketId === socket.id) {
      closeRoom("The host disconnected, so the case room has been closed.");
      return;
    }

    const player = activeRoom.players.find((entry) => entry.socketId === socket.id);
    if (!player) {
      return;
    }

    if (activeRoom.phase === "lobby") {
      activeRoom.players = activeRoom.players.filter((entry) => entry.socketId !== socket.id);
    } else {
      player.connected = false;
    }

    await emitRoomState(activeRoom);
  });
});

connectDatabase().finally(() => {
  server.listen(PORT, () => {
    console.log(`Detective's Desk backend running on http://localhost:${PORT}`);
  });
});

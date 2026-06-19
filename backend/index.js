const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const MONGO_URI = process.env.MONGO_URI;
const MAX_PLAYERS = 50;
const STARTING_HEARTS = 3;
const STARTING_HINTS = 3;
const READING_DURATION_SECONDS = 90;
const QUESTION_DURATION_SECONDS = 25;
const QUESTION_TIMER_ENABLED = true;

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
      content: "Meet me at the greenhouse. Midnight. Bring what you promised. - V",
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
  exercises: [
    {
      id: 1,
      type: "mcq",
      skill: "Inference",
      text: "Based on the evidence, where did the suspect most likely come from before entering the manor?",
      options: ["The village market", "The old Ravenwood well", "The greenhouse", "The guest cottage"],
      correctIndex: 1,
      explanation: "The lab report links the rare white clay directly to the old Ravenwood well.",
      hints: [
        "Focus on the lab report rather than the note.",
        "The clue names a location 400 meters north of the manor.",
        "White clay appears in only one place in the documents.",
      ],
    },
    {
      id: 2,
      type: "fill_word",
      skill: "Vocabulary in Context",
      text: "Complete the note: 'Meet me at the _____. Midnight. Bring what you promised.'",
      prompt: "Type the missing location from the handwritten note.",
      answer: "greenhouse",
      acceptableAnswers: ["the greenhouse", "greenhouse"],
      explanation: "The handwritten note clearly tells the reader to meet at the greenhouse.",
      hints: [
        "Check the short handwritten note.",
        "It is a glass building used for plants.",
        "The missing word begins with 'g'.",
      ],
    },
    {
      id: 3,
      type: "matching",
      skill: "Evidence Pairing",
      text: "Match each clue to the document that reveals it.",
      pairs: [
        { left: "Rare white clay", right: "Evidence Report - Lab Analysis" },
        { left: "Priceless emerald brooch", right: "The Ravenwood Gazette - Oct 14" },
        { left: "Study light stayed on", right: "Lord Ashworth's Statement" },
      ],
      explanation: "Each clue appears in a different source, so careful document tracking matters.",
      hints: [
        "One answer comes from the newspaper, one from the lab, and one from the case file.",
        "The brooch value is discussed only in the newspaper.",
        "The light staying on appears in Lord Ashworth's statement section.",
      ],
    },
    {
      id: 4,
      type: "drag_drop",
      skill: "Sequencing",
      text: "Arrange the investigation clues from earliest report to latest discovery.",
      prompt: "Drag the cards into the order a detective would uncover them.",
      items: [
        "The brooch is last seen at dinner",
        "A crash is heard in the east wing",
        "The study window is found shattered",
        "The lab identifies white clay from the old well",
      ],
      correctOrder: [
        "The brooch is last seen at dinner",
        "A crash is heard in the east wing",
        "The study window is found shattered",
        "The lab identifies white clay from the old well",
      ],
      explanation: "The case starts at dinner, moves to the crash and broken window, then the lab confirms the clay clue.",
      hints: [
        "Start with what happened before the theft was discovered.",
        "The lab result must happen after the scene is examined.",
        "Dinner comes before the crash.",
      ],
    },
    {
      id: 5,
      type: "mcq",
      skill: "Supporting Details",
      text: "Which detail most clearly contradicts Lord Ashworth's statement?",
      options: ["The brooch was insured", "The cabinet was not tampered with", "His study light stayed on past midnight", "No forced entry was found"],
      correctIndex: 2,
      explanation: "He claimed to retire at 10 PM, but staff reported his study remained lit much later.",
      hints: [
        "Compare what Lord Ashworth says with what the staff observed.",
        "Look for the timeline contradiction.",
        "The conflicting clue involves the study after 10 PM.",
      ],
    },
    {
      id: 6,
      type: "fill_word",
      skill: "Close Reading",
      text: "Complete the evidence report detail: the unidentified print was on the left _____ finger.",
      prompt: "Type the missing finger name from the lab report.",
      answer: "ring",
      acceptableAnswers: ["ring finger", "ring"],
      explanation: "The evidence report says the unknown print came from a left ring-finger impression.",
      hints: [
        "Return to the lab analysis document.",
        "It is the finger usually associated with wearing a wedding ring.",
        "The missing word has four letters.",
      ],
    },
    {
      id: 7,
      type: "mcq",
      skill: "Cause and Effect",
      text: "Why does the broken study window seem suspicious rather than a clear sign of forced entry?",
      options: [
        "It was shattered from the inside",
        "It faced the garden path",
        "It was found after midnight",
        "It belonged to Miss Clara",
      ],
      correctIndex: 0,
      explanation: "The butler reports the window was shattered from the inside, which weakens the idea of an outside break-in.",
      hints: [
        "Focus on the butler's exact wording about the window.",
        "The strange part is not that the window broke, but how it broke.",
        "The answer describes the direction of the damage.",
      ],
    },
    {
      id: 8,
      type: "matching",
      skill: "Document Tracking",
      text: "Match each clue to the person or source connected to it.",
      pairs: [
        { left: "Heard the crash in the east wing", right: "Mr. Hawkins" },
        { left: "Asked for a midnight meeting", right: "Handwritten Note" },
        { left: "Reported the brooch stolen", right: "The Ravenwood Gazette" },
      ],
      explanation: "Each clue is tied to a specific witness or source, so matching the evidence correctly matters.",
      hints: [
        "One answer is a witness, one is a note, and one is a newspaper source.",
        "The midnight meeting clue does not come from a person statement.",
        "The crash report belongs to the butler's testimony.",
      ],
    },
    {
      id: 9,
      type: "drag_drop",
      skill: "Reasoning Chain",
      text: "Order the clues from strongest evidence of an inside job to weakest.",
      prompt: "Place the clues in order, starting with the most suspicious sign of inside involvement.",
      items: [
        "No forced entry was found",
        "The window was shattered from the inside",
        "Staff said the study light stayed on",
        "The brooch was insured for 40,000 pounds",
      ],
      correctOrder: [
        "No forced entry was found",
        "The window was shattered from the inside",
        "Staff said the study light stayed on",
        "The brooch was insured for 40,000 pounds",
      ],
      explanation: "Lack of forced entry is the strongest sign, the inside-broken window supports it, the study light is suspicious, and the insurance value is the weakest proof of inside access.",
      hints: [
        "Start with the clue that most directly suggests access to the manor.",
        "Window direction matters more than the insurance amount.",
        "The money detail is interesting, but it is not strong proof of access.",
      ],
    },
  ],
  bonusQuestion: {
    id: "bonus-1",
    type: "mcq",
    skill: "Recovery Round",
    text: "Bonus question: Which clue most strongly suggests the theft may have involved someone inside the manor?",
    options: ["The muddy prints were narrow", "No forced entry was found", "The crash happened at half past ten", "The brooch was insured for 40,000 pounds"],
    correctIndex: 1,
    explanation: "No forced entry strongly implies that someone with access may have been involved.",
    hints: [
      "Think about which clue points to access rather than value or timing.",
      "A locked building with no break-in narrows the possibilities.",
      "The strongest answer is about entry, not motive.",
    ],
  },
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
        heartsRemaining: Number,
        completedExercises: Number,
      },
    ],
  },
  { timestamps: true }
);

const GameSession = mongoose.models.GameSession || mongoose.model("GameSession", gameSessionSchema);

let activeRoom = null;

function clearReadingTimer(room) {
  if (room?.readingTimer) {
    clearTimeout(room.readingTimer);
    room.readingTimer = null;
  }
}

function clearPlayerTaskTimer(player) {
  if (player?.taskTimer) {
    clearTimeout(player.taskTimer);
    player.taskTimer = null;
  }
}

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

function sortPlayers(players) {
  return [...players].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (right.currentExerciseIndex !== left.currentExerciseIndex) {
      return right.currentExerciseIndex - left.currentExerciseIndex;
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
    heartsRemaining: player.heartsRemaining,
    progress: Math.min(player.currentExerciseIndex, room.caseData.exercises.length),
    totalExercises: room.caseData.exercises.length,
    status: getPlayerStatus(room, player),
  }));
}

function sanitizeExercise(exercise) {
  const base = {
    id: exercise.id,
    type: exercise.type,
    skill: exercise.skill,
    text: exercise.text,
    explanation: exercise.explanation,
  };

  if (exercise.type === "mcq") {
    return { ...base, options: exercise.options };
  }

  if (exercise.type === "fill_word") {
    return { ...base, prompt: exercise.prompt };
  }

  if (exercise.type === "matching") {
    return {
      ...base,
      pairs: exercise.pairs.map((pair) => pair.left),
      targets: exercise.pairs.map((pair) => pair.right),
    };
  }

  if (exercise.type === "drag_drop") {
    return { ...base, prompt: exercise.prompt, items: exercise.items };
  }

  return base;
}

function getPlayerStatus(room, player) {
  if (player.heartsRemaining <= 0 && (player.bonusUsed || player.completed) && player.currentExerciseIndex < room.caseData.exercises.length) {
    return "Out";
  }

  if (player.completed) {
    return "Finished";
  }

  if (player.bonusUnlocked) {
    return "Bonus";
  }

  return "Investigating";
}

function buildViewer(room, socketId) {
  if (room.hostSocketId === socketId) {
    return {
      id: room.hostId,
      name: room.hostName,
      isHost: true,
      score: 0,
      streak: 0,
      heartsRemaining: STARTING_HEARTS,
      hintsRemaining: STARTING_HINTS,
      currentExerciseIndex: 0,
      completed: false,
      bonusUnlocked: false,
      canUseBonus: false,
      usedHintIds: [],
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
    heartsRemaining: player.heartsRemaining,
    hintsRemaining: player.hintsRemaining,
    currentExerciseIndex: player.currentExerciseIndex,
    completed: player.completed,
    bonusUnlocked: player.bonusUnlocked,
    canUseBonus: !player.bonusUsed,
    usedHintIds: Object.keys(player.usedHintIds),
    lastResult: player.lastResult,
  };
}

function buildCurrentTask(room, player) {
  if (!player || player.completed) {
    return null;
  }

  if (player.bonusUnlocked) {
    return {
      ...sanitizeExercise(room.caseData.bonusQuestion),
      number: "Bonus",
      total: room.caseData.exercises.length,
      isBonus: true,
      endsAt: player.taskEndsAt,
    };
  }

  const exercise = room.caseData.exercises[player.currentExerciseIndex];
  if (!exercise) {
    return null;
  }

  return {
    ...sanitizeExercise(exercise),
    number: player.currentExerciseIndex + 1,
    total: room.caseData.exercises.length,
    isBonus: false,
    endsAt: player.taskEndsAt,
  };
}

function buildHints(room, player) {
  if (!player || player.completed) {
    return { revealed: [], totalAvailable: 0 };
  }

  const exercise = player.bonusUnlocked ? room.caseData.bonusQuestion : room.caseData.exercises[player.currentExerciseIndex];
  const revealed = (player.usedHintIds[exercise.id] || []).map((hintIndex) => exercise.hints[hintIndex]).filter(Boolean);
  return {
    revealed,
    totalAvailable: exercise.hints.length,
  };
}

function buildRoomState(room, socketId) {
  const viewer = buildViewer(room, socketId);
  const player = room.players.find((entry) => entry.socketId === socketId);

  return {
    code: room.code,
    phase: room.phase,
    hostName: room.hostName,
    readingEndsAt: room.readingEndsAt,
    viewer,
    players: buildLeaderboard(room),
    caseData: {
      title: room.caseData.title,
      difficulty: room.caseData.difficulty,
      readingTime: room.caseData.readingTime,
      fragments: room.caseData.fragments,
      questionCount: room.caseData.exercises.length,
    },
    dashboard: {
      currentTask: player ? buildCurrentTask(room, player) : null,
      hints: player ? buildHints(room, player) : { revealed: [], totalAvailable: 0 },
      bonusQuestionUsed: player ? player.bonusUsed : false,
      gameComplete: player ? player.completed : false,
    },
  };
}

async function emitRoomState(room) {
  const sockets = await io.in(room.code).fetchSockets();
  sockets.forEach((socket) => {
    socket.emit("room:update", {
      room: buildRoomState(room, socket.id),
    });
  });
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
    startedAt: null,
    endedAt: null,
    readingEndsAt: null,
    readingTimer: null,
  };
}

function closeRoom(reason = "Room closed by host.") {
  if (!activeRoom) {
    return;
  }

  clearReadingTimer(activeRoom);
  activeRoom.players.forEach((player) => clearPlayerTaskTimer(player));
  io.to(activeRoom.code).emit("room:closed", { message: reason });
  activeRoom = null;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function checkMatchingAnswer(exercise, answer) {
  if (!answer || typeof answer !== "object") {
    return false;
  }

  return exercise.pairs.every((pair) => answer[pair.left] === pair.right);
}

function checkDragDropAnswer(exercise, answer) {
  if (!Array.isArray(answer) || answer.length !== exercise.correctOrder.length) {
    return false;
  }

  return exercise.correctOrder.every((item, index) => answer[index] === item);
}

function evaluateAnswer(exercise, submission) {
  if (exercise.type === "mcq") {
    return submission?.choiceIndex === exercise.correctIndex;
  }

  if (exercise.type === "fill_word") {
    const value = normalizeText(submission?.text);
    return [exercise.answer, ...(exercise.acceptableAnswers || [])].some((candidate) => normalizeText(candidate) === value);
  }

  if (exercise.type === "matching") {
    return checkMatchingAnswer(exercise, submission?.matches);
  }

  if (exercise.type === "drag_drop") {
    return checkDragDropAnswer(exercise, submission?.order);
  }

  return false;
}

function getCurrentExercise(room, player) {
  return player.bonusUnlocked ? room.caseData.bonusQuestion : room.caseData.exercises[player.currentExerciseIndex];
}

function shouldPlayerReceiveTask(player, room) {
  return !player.completed && room.phase === "playing";
}

function assignNextTaskTimer(room, player) {
  clearPlayerTaskTimer(player);

  if (!shouldPlayerReceiveTask(player, room) || !QUESTION_TIMER_ENABLED) {
    player.taskEndsAt = null;
    return;
  }

  player.taskEndsAt = Date.now() + QUESTION_DURATION_SECONDS * 1000;
  player.taskTimer = setTimeout(async () => {
    if (!activeRoom || activeRoom.code !== room.code || activeRoom.phase !== "playing") {
      return;
    }

    const livePlayer = activeRoom.players.find((entry) => entry.id === player.id);
    if (!livePlayer || livePlayer.completed) {
      return;
    }

    const exercise = getCurrentExercise(activeRoom, livePlayer);
    clearPlayerTaskTimer(livePlayer);
    markPlayerProgress(activeRoom, livePlayer, false, exercise, true);
    assignNextTaskTimer(activeRoom, livePlayer);
    await emitRoomState(activeRoom);

    if (allPlayersFinished(activeRoom)) {
      await finishGame(activeRoom);
    }
  }, QUESTION_DURATION_SECONDS * 1000);
}

function markPlayerProgress(room, player, correct, exercise, timedOut = false) {
  if (correct) {
    const isBonus = player.bonusUnlocked;
    const points = isBonus ? 250 : 400 + player.streak * 75;
    player.score += points;
    player.streak += 1;

    if (isBonus) {
      player.heartsRemaining = Math.min(1, player.heartsRemaining + 1);
      player.bonusUnlocked = false;
      player.bonusUsed = true;
    } else {
      player.currentExerciseIndex += 1;
    }

    if (player.currentExerciseIndex >= room.caseData.exercises.length) {
      player.completed = true;
    }

    player.lastResult = {
      correct: true,
      points,
      explanation: exercise.explanation,
      heartsDelta: 0,
      recoveredHeart: isBonus,
      timedOut,
    };

    return player.lastResult;
  }

  player.streak = 0;
  const isBonus = player.bonusUnlocked;
  player.heartsRemaining = Math.max(0, player.heartsRemaining - 1);
  if (!isBonus) {
    player.currentExerciseIndex += 1;
  }

  const shouldUnlockBonus = !isBonus && player.heartsRemaining === 0 && !player.bonusUsed;

  if (shouldUnlockBonus) {
    player.bonusUnlocked = true;
    player.completed = false;
  } else if (isBonus) {
    player.bonusUnlocked = false;
    player.bonusUsed = true;
    player.completed = true;
  } else if (player.heartsRemaining === 0) {
    player.completed = true;
    player.bonusUnlocked = false;
  }

  if (player.currentExerciseIndex >= room.caseData.exercises.length && !shouldUnlockBonus) {
    player.completed = true;
  }

  player.lastResult = {
    correct: false,
    points: 0,
    explanation: exercise.explanation,
    heartsDelta: -1,
    recoveredHeart: false,
    bonusUnlocked: shouldUnlockBonus,
    timedOut,
  };

  return player.lastResult;
}

function allPlayersFinished(room) {
  return room.players.length > 0 && room.players.every((player) => player.completed);
}

async function finishGame(room) {
  clearReadingTimer(room);
  room.players.forEach((player) => clearPlayerTaskTimer(player));
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
          heartsRemaining: player.heartsRemaining,
          completedExercises: player.currentExerciseIndex,
        })),
      });
    } catch (error) {
      console.error("Failed to save game session.", error.message);
    }
  }
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

    if (activeRoom.players.length >= MAX_PLAYERS) {
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
      heartsRemaining: STARTING_HEARTS,
      hintsRemaining: STARTING_HINTS,
      currentExerciseIndex: 0,
      completed: false,
      bonusUsed: false,
      bonusUnlocked: false,
      usedHintIds: {},
      lastResult: null,
      taskEndsAt: null,
      taskTimer: null,
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

    clearReadingTimer(activeRoom);
    activeRoom.readingTimer = setTimeout(async () => {
      if (!activeRoom) {
        return;
      }

      activeRoom.phase = "playing";
      activeRoom.readingEndsAt = null;
      activeRoom.readingTimer = null;
      activeRoom.players.forEach((player) => assignNextTaskTimer(activeRoom, player));
      await emitRoomState(activeRoom);
    }, activeRoom.caseData.readingTime * 1000);

    callback({ ok: true });
  });

  socket.on("player:submit-answer", async (submission, callback = () => {}) => {
    if (!activeRoom || activeRoom.phase !== "playing") {
      callback({ ok: false, message: "No active case right now." });
      return;
    }

    const player = activeRoom.players.find((entry) => entry.socketId === socket.id);
    if (!player) {
      callback({ ok: false, message: "Player not found in this room." });
      return;
    }

    if (player.completed) {
      callback({ ok: false, message: "Your case run is already complete." });
      return;
    }

    const exercise = getCurrentExercise(activeRoom, player);
    clearPlayerTaskTimer(player);
    const correct = evaluateAnswer(exercise, submission);
    const result = markPlayerProgress(activeRoom, player, correct, exercise);
    assignNextTaskTimer(activeRoom, player);

    await emitRoomState(activeRoom);
    callback({ ok: true, ...result });

    if (allPlayersFinished(activeRoom)) {
      await finishGame(activeRoom);
    }
  });

  socket.on("player:use-hint", async (_payload, callback = () => {}) => {
    if (!activeRoom || activeRoom.phase !== "playing") {
      callback({ ok: false, message: "Hints are not available right now." });
      return;
    }

    const player = activeRoom.players.find((entry) => entry.socketId === socket.id);
    if (!player) {
      callback({ ok: false, message: "Player not found in this room." });
      return;
    }

    if (player.completed) {
      callback({ ok: false, message: "Your case run is already complete." });
      return;
    }

    if (player.hintsRemaining <= 0) {
      callback({ ok: false, message: "No hints remaining." });
      return;
    }

    const exercise = getCurrentExercise(activeRoom, player);
    const revealedHints = player.usedHintIds[exercise.id] || [];
    if (revealedHints.length >= exercise.hints.length) {
      callback({ ok: false, message: "All hints for this exercise are already revealed." });
      return;
    }

    const nextHintIndex = revealedHints.length;
    player.usedHintIds[exercise.id] = [...revealedHints, nextHintIndex];
    player.hintsRemaining -= 1;

    await emitRoomState(activeRoom);
    callback({ ok: true, hint: exercise.hints[nextHintIndex], hintsRemaining: player.hintsRemaining });
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

    if (activeRoom.players.length === 0 && activeRoom.phase !== "lobby") {
      await finishGame(activeRoom);
      return;
    }

    await emitRoomState(activeRoom);
  });
});

connectDatabase().finally(() => {
  server.listen(PORT, () => {
    console.log(`Detective's Desk backend running on http://localhost:${PORT}`);
  });
});

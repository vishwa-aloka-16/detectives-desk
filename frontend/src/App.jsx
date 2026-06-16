import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const SCREENS = {
  LANDING: "landing",
  JOIN: "join",
  HOST_LOBBY: "host_lobby",
  PLAYER_LOBBY: "player_lobby",
  READING: "reading",
  QUESTION: "question",
  LEADERBOARD: "leaderboard",
  CASE_CLOSED: "case_closed",
};

const FRAGMENT_STYLES = {
  witness: { bg: "rgba(23, 31, 36, 0.94)", border: "rgba(91, 129, 148, 0.5)", rotate: "-1.2deg", label: "WITNESS" },
  newspaper: { bg: "rgba(48, 42, 27, 0.95)", border: "rgba(201, 168, 76, 0.45)", rotate: "1deg", label: "PRESS" },
  note: { bg: "rgba(50, 33, 32, 0.96)", border: "rgba(184, 48, 48, 0.45)", rotate: "-2deg", label: "NOTE" },
  evidence: { bg: "rgba(21, 37, 28, 0.95)", border: "rgba(46, 125, 79, 0.45)", rotate: "0.8deg", label: "EVIDENCE" },
  file: { bg: "rgba(33, 28, 36, 0.95)", border: "rgba(212, 188, 142, 0.35)", rotate: "-0.4deg", label: "CASE FILE" },
};

function MagIcon({ size = 24, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function useCountdown(targetTime) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  if (!targetTime) {
    return 0;
  }

  return Math.max(0, Math.ceil((targetTime - now) / 1000));
}

function getScreen(room, role, joined) {
  if (!joined || !room) {
    return null;
  }

  if (room.phase === "lobby") {
    return role === "host" ? SCREENS.HOST_LOBBY : SCREENS.PLAYER_LOBBY;
  }
  if (room.phase === "reading") {
    return SCREENS.READING;
  }
  if (room.phase === "question") {
    return SCREENS.QUESTION;
  }
  if (room.phase === "leaderboard") {
    return SCREENS.LEADERBOARD;
  }
  if (room.phase === "finished") {
    return SCREENS.CASE_CLOSED;
  }

  return null;
}

function LandingScreen({ onHost, onJoin, loading }) {
  return (
    <div className="screen center-screen">
      <div className="ambient-lines">
        {[14, 33, 62, 84].map((top) => (
          <div key={top} className="string-line" style={{ top: `${top}%`, left: 0, right: 0 }} />
        ))}
      </div>

      <div className="landing-shell">
        <div className="case-meta">
          <div className="meta-line" />
          <span>Classroom Demo</span>
          <div className="meta-line" />
        </div>

        <h1 className="title">
          The Detective&apos;s
          <br />
          <span>Desk</span>
        </h1>

        <p className="tagline">&quot;Read between the lines. Solve the case.&quot;</p>

        <div className="hero-icon">
          <MagIcon size={58} />
        </div>

        <div className="action-row">
          <button className="btn btn-primary" type="button" onClick={onHost} disabled={loading}>
            {loading ? "Opening..." : "Open a Case Room"}
          </button>
          <button className="btn btn-outline" type="button" onClick={onJoin}>
            Join Investigation
          </button>
        </div>

        <p className="microcopy">NO LOGIN REQUIRED · UP TO 50 PLAYERS · LIVE LEADERBOARD</p>
      </div>
    </div>
  );
}

function JoinScreen({ code, name, setCode, setName, onBack, onJoin, loading }) {
  return (
    <div className="screen center-screen">
      <div className="panel narrow-panel">
        <button className="btn btn-outline back-btn" type="button" onClick={onBack}>
          Back
        </button>

        <div className="panel-header">
          <MagIcon size={20} color="var(--gold)" />
          <h2>Join Investigation</h2>
        </div>

        <label className="field-label" htmlFor="roomCode">
          Room Code
        </label>
        <input
          id="roomCode"
          className="input input-code"
          placeholder="e.g. HAWK42"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
        />

        <label className="field-label" htmlFor="playerName">
          Detective Name
        </label>
        <input
          id="playerName"
          className="input"
          placeholder="Enter your alias"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <button className="btn btn-primary full-width" type="button" onClick={onJoin} disabled={loading || !code.trim() || !name.trim()}>
          {loading ? "Entering..." : "Enter the Crime Scene"}
        </button>
      </div>
    </div>
  );
}

function PlayerList({ players, highlightId }) {
  return (
    <div className="player-list">
      {players.map((player) => (
        <div key={player.id} className={`player-row ${player.id === highlightId ? "player-row--active" : ""}`}>
          <span className="player-rank">#{player.rank}</span>
          <span className="player-name">{player.name}</span>
          <span className="player-score">{player.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function HostLobbyScreen({ room, onStartGame, onCloseRoom, loading }) {
  return (
    <div className="screen page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">HOST CONTROL PANEL</p>
          <h2>{room.caseData.title}</h2>
        </div>
        <button className="btn btn-outline" type="button" onClick={onCloseRoom}>
          Close Room
        </button>
      </div>

      <div className="host-grid">
        <div className="panel pulse-panel">
          <p className="eyebrow">ROOM CODE</p>
          <div className="room-code">{room.code}</div>
          <p className="subtle">Share this with your classroom detectives.</p>
        </div>

        <div className="panel">
          <p className="eyebrow">CASE FILE</p>
          <p className="case-title">{room.caseData.title}</p>
          <div className="stamp-row">
            <span className="stamp stamp-gold">{room.caseData.difficulty}</span>
            <span className="stamp stamp-green">{room.caseData.questionCount} clues</span>
            <span className="stamp stamp-red">{room.caseData.readingTime}s study</span>
          </div>
          <p className="subtle">Players joined: {room.players.length}</p>
        </div>
      </div>

      <div className="panel">
        <div className="section-head">
          <h3>Investigators in Room</h3>
          <span className="mono-small">{room.players.length}/50</span>
        </div>
        <PlayerList players={room.players} />
      </div>

      <div className="cta-wrap">
        <button className="btn btn-primary" type="button" onClick={onStartGame} disabled={loading}>
          {loading ? "Launching..." : "Start Reading Phase"}
        </button>
      </div>
    </div>
  );
}

function PlayerLobbyScreen({ room, viewerName }) {
  return (
    <div className="screen page-shell">
      <div className="panel centered-panel">
        <p className="eyebrow">ROOM LOCKED IN</p>
        <h2>Welcome, Detective {viewerName}</h2>
        <div className="room-code room-code--small">{room.code}</div>
        <p className="subtle">Stay sharp. The host will open the case when everyone is ready.</p>
      </div>

      <div className="panel">
        <div className="section-head">
          <h3>Investigation Team</h3>
          <span className="mono-small">{room.players.length} joined</span>
        </div>
        <PlayerList players={room.players} highlightId={room.viewer?.id} />
      </div>
    </div>
  );
}

function ReadingScreen({ room }) {
  const timeLeft = useCountdown(room.readingEndsAt);
  const [selectedId, setSelectedId] = useState(null);
  const total = room.caseData.readingTime || 1;
  const pct = Math.max(0, Math.min(1, timeLeft / total));

  return (
    <div className="screen reading-shell">
      <div className="reading-topbar">
        <div>
          <p className="eyebrow">CASE READING PHASE</p>
          <h2>{room.caseData.title}</h2>
        </div>
        <div className="timer-card">
          <div className="timer-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" className="ring-bg" />
              <circle cx="50" cy="50" r="44" className="ring-progress" style={{ strokeDashoffset: 276 * (1 - pct) }} />
            </svg>
            <div>{timeLeft}</div>
          </div>
          <p className="mono-small">STUDY TIME</p>
        </div>
      </div>

      <div className="fragments-grid">
        {room.caseData.fragments.map((fragment, index) => {
          const style = FRAGMENT_STYLES[fragment.type] || FRAGMENT_STYLES.file;
          const isActive = selectedId === fragment.id;
          return (
            <button
              key={fragment.id}
              type="button"
              className="fragment-card"
              style={{
                background: style.bg,
                borderColor: style.border,
                transform: isActive ? "scale(1.02) rotate(0deg)" : `rotate(${style.rotate})`,
                animationDelay: `${index * 0.06}s`,
              }}
              onClick={() => setSelectedId(isActive ? null : fragment.id)}
            >
              <div className="pin" />
              <p className="fragment-tag">{style.label}</p>
              <p className="fragment-label">{fragment.label}</p>
              <p className="fragment-copy">{fragment.content}</p>
              {isActive ? <span className="stamp stamp-red fragment-stamp">Reading</span> : null}
            </button>
          );
        })}
      </div>

      <div className="bottom-hint">CLICK A DOCUMENT TO EXAMINE · QUESTIONS BEGIN WHEN THE TIMER ENDS</div>
    </div>
  );
}

function QuestionScreen({ room, onAnswer, answerState, viewer }) {
  const question = room.question;
  const timeLeft = useCountdown(question?.endsAt);
  const pct = question ? timeLeft / 20 : 0;

  return (
    <div className="screen question-shell">
      <div className="question-header">
        <div className="mono-small">
          CLUE {question.number} / {question.total}
        </div>
        <div className="question-metrics">
          <span>{viewer?.score?.toLocaleString() || 0} pts</span>
          <span>{question.submissionsCount}/{room.players.length} answered</span>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct * 100}%` }} />
      </div>

      <div className="skill-chip">SKILL: {question.skill.toUpperCase()}</div>

      <div className="question-panel">
        <h2>{question.text}</h2>
        <div className="options-grid">
          {question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              className={`option-card ${answerState.choiceIndex === index ? "option-card--selected" : ""}`}
              disabled={answerState.submitted}
              onClick={() => onAnswer(index)}
            >
              <span className="option-letter">{String.fromCharCode(65 + index)}.</span>
              <span>{option}</span>
            </button>
          ))}
        </div>

        {answerState.submitted ? (
          <div className="answer-lock">
            {answerState.correct ? "Answer submitted. Nice deduction." : "Answer submitted. Waiting for the reveal."}
          </div>
        ) : null}
      </div>

      <div className="floating-timer">{timeLeft}</div>
    </div>
  );
}

function LeaderboardScreen({ room, viewer }) {
  const result = room.questionResult;

  return (
    <div className="screen page-shell narrow-page">
      <div className="panel">
        <p className="eyebrow">QUESTION REVIEW</p>
        <h2>{result.text}</h2>
        <p className="subtle">{result.explanation}</p>
        <div className="reveal-list">
          {result.options.map((option, index) => (
            <div key={option} className={`reveal-row ${index === result.correctIndex ? "reveal-row--correct" : ""}`}>
              <span>{String.fromCharCode(65 + index)}.</span>
              <span>{option}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-head">
          <h3>Live Leaderboard</h3>
          <span className="mono-small">Your score: {viewer?.score?.toLocaleString() || 0}</span>
        </div>
        <PlayerList players={room.players} highlightId={viewer?.id} />
      </div>
    </div>
  );
}

function CaseClosedScreen({ room, onRestart }) {
  const viewer = room.viewer;
  const score = viewer?.score || 0;
  const rank = score >= 1800 ? "Master Detective" : score >= 1100 ? "Senior Investigator" : "Field Agent";

  return (
    <div className="screen center-screen">
      <div className="panel narrow-panel centered-panel">
        <div className="closed-stamp">CASE CLOSED</div>
        <h2>Detective {viewer?.name || "Anonymous"}</h2>
        <p className="tagline">Rank: {rank}</p>
        <div className="score-block">
          <p className="eyebrow">FINAL SCORE</p>
          <div className="score-value">{score.toLocaleString()}</div>
          <p className="mono-small">POINTS EARNED</p>
        </div>
        <PlayerList players={room.finalResults?.leaderboard || room.players} highlightId={viewer?.id} />
        <button className="btn btn-primary" type="button" onClick={onRestart}>
          Return to Landing
        </button>
      </div>
    </div>
  );
}

function App() {
  const socketRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [role, setRole] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("Connecting to server...");
  const [hostLoading, setHostLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [entryScreen, setEntryScreen] = useState(SCREENS.LANDING);
  const [answerState, setAnswerState] = useState({
    submitted: false,
    choiceIndex: null,
    correct: false,
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setInfo("Server connected.");
    });

    socket.on("disconnect", () => {
      setInfo("Disconnected from server.");
    });

    socket.on("room:update", ({ room: nextRoom }) => {
      setRoom(nextRoom);
      setJoined(true);
      setError("");
      setActionLoading(false);
      if (nextRoom.phase !== "question") {
        setAnswerState({ submitted: false, choiceIndex: null, correct: false });
      }
    });

    socket.on("room:closed", ({ message }) => {
      setError(message);
      setRoom(null);
      setJoined(false);
      setRole(null);
      setEntryScreen(SCREENS.LANDING);
      setActionLoading(false);
      setHostLoading(false);
      setJoinLoading(false);
      setAnswerState({ submitted: false, choiceIndex: null, correct: false });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const activeScreen = useMemo(() => getScreen(room, role, joined), [room, role, joined]);

  const handleHostCreate = () => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    setHostLoading(true);
    setError("");
    socket.emit("host:create-room", { hostName: "Lead Detective" }, (response) => {
      setHostLoading(false);
      if (!response.ok) {
        setError(response.message);
        return;
      }

      setRole("host");
      setJoined(true);
    });
  };

  const handleJoinRoom = () => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    setJoinLoading(true);
    setError("");
    socket.emit("player:join-room", { roomCode: joinCode.trim(), name: joinName.trim() }, (response) => {
      setJoinLoading(false);
      if (!response.ok) {
        setError(response.message);
        return;
      }

      setRole("player");
      setJoined(true);
    });
  };

  const handleStartGame = () => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    setActionLoading(true);
    socket.emit("host:start-game", (response) => {
      if (!response.ok) {
        setActionLoading(false);
        setError(response.message);
      }
    });
  };

  const handleCloseRoom = () => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    socket.emit("host:close-room", () => {});
  };

  const handleAnswer = (choiceIndex) => {
    const socket = socketRef.current;
    if (!socket || answerState.submitted) {
      return;
    }

    setAnswerState({ submitted: true, choiceIndex, correct: false });
    socket.emit("player:submit-answer", { choiceIndex }, (response) => {
      if (!response.ok) {
        setAnswerState({ submitted: false, choiceIndex: null, correct: false });
        setError(response.message);
        return;
      }

      setAnswerState({ submitted: true, choiceIndex, correct: response.correct });
    });
  };

  const resetClientState = () => {
    setJoined(false);
    setRole(null);
    setRoom(null);
    setEntryScreen(SCREENS.LANDING);
    setJoinCode("");
    setJoinName("");
    setError("");
    setAnswerState({ submitted: false, choiceIndex: null, correct: false });
  };

  return (
    <div className="app-shell">
      {!joined && entryScreen === SCREENS.LANDING ? <LandingScreen onHost={handleHostCreate} onJoin={() => setEntryScreen(SCREENS.JOIN)} loading={hostLoading} /> : null}
      {!joined && entryScreen === SCREENS.JOIN ? (
        <JoinScreen
          code={joinCode}
          name={joinName}
          setCode={setJoinCode}
          setName={setJoinName}
          onBack={() => setEntryScreen(SCREENS.LANDING)}
          onJoin={handleJoinRoom}
          loading={joinLoading}
        />
      ) : null}
      {joined && room && activeScreen === SCREENS.HOST_LOBBY ? <HostLobbyScreen room={room} onStartGame={handleStartGame} onCloseRoom={handleCloseRoom} loading={actionLoading} /> : null}
      {joined && room && activeScreen === SCREENS.PLAYER_LOBBY ? <PlayerLobbyScreen room={room} viewerName={room.viewer?.name} /> : null}
      {joined && room && activeScreen === SCREENS.READING ? <ReadingScreen room={room} /> : null}
      {joined && room && activeScreen === SCREENS.QUESTION ? <QuestionScreen room={room} onAnswer={handleAnswer} answerState={answerState} viewer={room.viewer} /> : null}
      {joined && room && activeScreen === SCREENS.LEADERBOARD ? <LeaderboardScreen room={room} viewer={room.viewer} /> : null}
      {joined && room && activeScreen === SCREENS.CASE_CLOSED ? <CaseClosedScreen room={room} onRestart={resetClientState} /> : null}

      <div className="status-rail">
        <span>{info}</span>
        {error ? <span className="status-error">{error}</span> : null}
      </div>
    </div>
  );
}

export default App;

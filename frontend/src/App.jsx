import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";
import detectiveMagnifier from "./assets/detetive magnifing galssSearch.png";
import detectiveNotebook from "./assets/detective writing bookSearch.png";
import detectiveTorch from "./assets/detective torch and gunSearch.png";
import detectiveStanding from "./assets/detective standingSearch.png";
import detectiveSneaking from "./assets/detective sneakingSearch.png";
import detectiveCamera from "./assets/detective camara shootingSearch.png";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const SCREENS = {
  LANDING: "landing",
  JOIN: "join",
  HOST_LOBBY: "host_lobby",
  PLAYER_LOBBY: "player_lobby",
  READING: "reading",
  PLAYING: "playing",
  CASE_CLOSED: "case_closed",
};

const FRAGMENT_STYLES = {
  witness: { bg: "#ffffff", border: "#d7e8cc", rotate: "-1deg", label: "WITNESS" },
  newspaper: { bg: "#fffbea", border: "#f3dfa0", rotate: "1.2deg", label: "PRESS" },
  note: { bg: "#fff5f5", border: "#ffd1d1", rotate: "-1.6deg", label: "NOTE" },
  evidence: { bg: "#f2fff1", border: "#bfe58f", rotate: "0.8deg", label: "EVIDENCE" },
  file: { bg: "#f8fff5", border: "#d7e8cc", rotate: "-0.3deg", label: "CASE FILE" },
};

function MagIcon({ size = 24, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function HeartIcon({ broken = false, size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      {broken ? (
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4C8.24 4 9.91 4.81 11 6.09L8.2 10.2l3 1.5-2.4 4.4L12 21.35Zm1.06-5.04 1.68-3.1-2.8-1.42 2.73-4a4.49 4.49 0 0 1 2.83-3.55A4.5 4.5 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54l-.39.27Z" />
      ) : (
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 0 1 6.5 4C8.24 4 9.91 4.81 11 6.09A4.99 4.99 0 0 1 15.5 4 4.5 4.5 0 0 1 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" />
      )}
    </svg>
  );
}

function TrophyIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v1a4 4 0 0 1-4 4h-1" />
      <path d="M7 5H4v1a4 4 0 0 0 4 4h1" />
    </svg>
  );
}

function BookIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}

function HintIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.75c.66.47 1 1.04 1 1.75V17h6v-.5c0-.71.34-1.28 1-1.75A7 7 0 0 0 12 2Z" />
    </svg>
  );
}

function CloseIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

  if (room.phase === "playing") {
    return SCREENS.PLAYING;
  }

  if (room.phase === "finished") {
    return SCREENS.CASE_CLOSED;
  }

  return null;
}

function Modal({ title, icon, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card panel" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {icon}
            <strong>{title}</strong>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function CircularTimer({ secondsLeft, total, danger = false }) {
  const size = 56;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const pct = total ? Math.max(0, secondsLeft / total) : 0;

  return (
    <div className={`circle-timer ${danger ? "circle-timer--danger" : ""}`}>
      <svg width={size} height={size} viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} className="circle-timer-bg" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          className="circle-timer-fill"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference * (1 - pct),
          }}
        />
      </svg>
      <span>{secondsLeft}</span>
    </div>
  );
}

function LandingScreen({ onHost, onJoin, loading }) {
  return (
    <div className="screen center-screen">
      <div className="landing-shell">
        <div className="hero-illustration-row">
          <img className="hero-illustration hero-illustration--left" src={detectiveStanding} alt="" />
          <img className="hero-illustration hero-illustration--right" src={detectiveMagnifier} alt="" />
        </div>
        <div className="case-meta">
          <div className="meta-line" />
          <span>Classroom Game</span>
          <div className="meta-line" />
        </div>

        <h1 className="title">
          Detective Desk
          <br />
          <span>Quest</span>
        </h1>

        <p className="tagline">Read the clues, race the clock, and climb the leaderboard.</p>

        <div className="hero-icon">
          <MagIcon size={62} color="var(--green)" />
        </div>

        <div className="action-row">
          <button className="btn btn-primary" type="button" onClick={onHost} disabled={loading}>
            {loading ? "Opening..." : "Open a Room"}
          </button>
          <button className="btn btn-outline" type="button" onClick={onJoin}>
            Join Game
          </button>
        </div>

        <p className="microcopy">SELF-PACED QUESTIONS · LIVE RANKING · HEARTS + HINTS</p>
      </div>
    </div>
  );
}

function JoinScreen({ code, name, setCode, setName, onBack, onJoin, loading }) {
  return (
    <div className="screen center-screen">
      <div className="panel narrow-panel">
        <div className="card-illustration-wrap card-illustration-wrap--top">
          <img className="card-illustration" src={detectiveNotebook} alt="" />
        </div>
        <button className="btn btn-outline back-btn" type="button" onClick={onBack}>
          Back
        </button>

        <div className="panel-header">
          <MagIcon size={20} color="var(--green)" />
          <h2>Join Investigation</h2>
        </div>

        <label className="field-label" htmlFor="roomCode">
          Room Code
        </label>
        <input id="roomCode" className="input input-code" placeholder="e.g. HAWK42" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />

        <label className="field-label" htmlFor="playerName">
          Detective Name
        </label>
        <input id="playerName" className="input" placeholder="Enter your alias" value={name} onChange={(event) => setName(event.target.value)} />

        <button className="btn btn-primary full-width" type="button" onClick={onJoin} disabled={loading || !code.trim() || !name.trim()}>
          {loading ? "Entering..." : "Enter the Room"}
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
          <div>
            <div className="player-name">{player.name}</div>
            <div className="player-subline">
              {player.progress}/{player.totalExercises} clues · {player.status}
            </div>
          </div>
          <div className="player-meta">
            <span className="player-score">{player.score.toLocaleString()}</span>
            <span className="player-hearts-inline">
              {Array.from({ length: player.heartsRemaining }).map((_, index) => (
                <HeartIcon key={index} size={12} color="var(--red)" />
              ))}
            </span>
          </div>
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
          <div className="card-illustration-wrap card-illustration-wrap--inline">
            <img className="card-illustration card-illustration--medium" src={detectiveTorch} alt="" />
          </div>
          <p className="eyebrow">ROOM CODE</p>
          <div className="room-code">{room.code}</div>
          <p className="subtle">Share this code with your class.</p>
        </div>

        <div className="panel">
          <p className="eyebrow">CASE FILE</p>
          <p className="case-title">{room.caseData.title}</p>
          <div className="stamp-row">
            <span className="stamp stamp-gold">{room.caseData.difficulty}</span>
            <span className="stamp stamp-green">{room.caseData.questionCount} clues</span>
            <span className="stamp stamp-red">{room.caseData.readingTime}s reading</span>
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
        <p className="subtle">Everyone reads first, then each player works through questions at their own pace.</p>
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

function DocumentBoard({ fragments, onOpenFragment }) {
  return (
    <div className="fragments-grid compact-fragments">
      {fragments.map((fragment, index) => {
        const style = FRAGMENT_STYLES[fragment.type] || FRAGMENT_STYLES.file;
        return (
          <button
            key={fragment.id}
            type="button"
            className="fragment-card"
            style={{
              background: style.bg,
              borderColor: style.border,
              transform: `rotate(${style.rotate})`,
              animationDelay: `${index * 0.05}s`,
            }}
            onClick={() => onOpenFragment(fragment)}
          >
            <div className="pin" />
            <p className="fragment-tag">{style.label}</p>
            <p className="fragment-label">{fragment.label}</p>
            <p className="fragment-copy">{fragment.content}</p>
          </button>
        );
      })}
    </div>
  );
}

function ReadingPhaseScreen({ room, role, onCloseRoom, onOpenFragment }) {
  const timeLeft = useCountdown(room.readingEndsAt);
  const total = room.caseData.readingTime || 1;
  const showPlayerReadingExtras = role === "host";

  return (
    <div className="screen dashboard-shell">
      <div className="dashboard-topbar">
        <div>
          <p className="eyebrow">READING PHASE</p>
          <h2>{room.caseData.title}</h2>
        </div>
        {role === "host" ? (
          <button className="btn btn-outline" type="button" onClick={onCloseRoom}>
            Close Room
          </button>
        ) : null}
      </div>

      <div className="reading-phase-banner panel">
        <div>
          <p className="eyebrow">STUDY THE DOCUMENTS</p>
          <h3>Start investigating the documents when the timer end case beings!</h3>
        </div>
        <img className="banner-illustration banner-illustration--front" src={detectiveCamera} alt="" />
        <CircularTimer secondsLeft={timeLeft} total={total} danger={timeLeft <= 5} />
      </div>

      <div className="dashboard-grid">
        <div className="reading-pane">
          {showPlayerReadingExtras ? (
            <div className="panel panel-soft">
              <p className="eyebrow">OPEN THE CLUES</p>
              <p className="subtle">Tap any document to zoom in and read it clearly.</p>
            </div>
          ) : null}
          <DocumentBoard fragments={room.caseData.fragments} onOpenFragment={onOpenFragment} />
        </div>
        {showPlayerReadingExtras ? (
          <div className="dashboard-sidebar">
            <div className="panel">
              <div className="section-head">
                <h3>Leaderboard</h3>
                <span className="mono-small">{room.players.length} players</span>
              </div>
              <PlayerList players={room.players} highlightId={room.viewer?.id} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TopStatusBar({ rank, hearts, brokenHeart, hints, progressPct }) {
  return (
    <div className="top-status-bar panel">
      <div className="status-pill">
        <TrophyIcon color="var(--yellow)" />
        <span>
          <strong>#{rank}</strong>
        </span>
      </div>

      <div className="status-pill">
        <span className={`status-heart-icon ${brokenHeart !== null ? "status-heart-icon--breaking" : ""}`}>
          <HeartIcon color="var(--red)" />
        </span>
        <span>
          <strong>{hearts}</strong>
        </span>
      </div>

      <div className="status-pill">
        <HintIcon color="var(--yellow)" />
        <span>
          <strong>{hints}</strong>
        </span>
      </div>

      <div className="status-pill">
        <span>
          <strong>{progressPct}%</strong>
        </span>
      </div>
    </div>
  );
}

function ExerciseCard({ task, submissionState, onSubmit, disabled, hintsRemaining, onUseHint, revealedHints }) {
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [fillText, setFillText] = useState("");
  const [matches, setMatches] = useState({});
  const [dragOrder, setDragOrder] = useState([]);
  const [draggingItem, setDraggingItem] = useState(null);
  const timeLeft = useCountdown(task?.endsAt);
  const showTaskTimer = Boolean(task?.endsAt);

  useEffect(() => {
    setSelectedChoice(null);
    setFillText("");
    setMatches({});
    setDragOrder(task?.type === "drag_drop" ? task.items : []);
    setDraggingItem(null);
  }, [task?.id, task?.isBonus, task?.type, task?.items]);

  if (!task) {
    return (
      <div className="panel task-panel">
        <p className="eyebrow">STATUS</p>
        <h2>Case path complete</h2>
        <p className="subtle">You have reached the end of your investigation.</p>
      </div>
    );
  }

  const submitDisabled = disabled || submissionState.loading;

  const submitMcq = () => {
    if (selectedChoice === null) {
      return;
    }
    onSubmit({ choiceIndex: selectedChoice });
  };

  const submitFillWord = () => {
    if (!fillText.trim()) {
      return;
    }
    onSubmit({ text: fillText });
  };

  const submitMatching = () => {
    if (Object.keys(matches).length !== task.pairs.length) {
      return;
    }
    onSubmit({ matches });
  };

  const moveDragItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= dragOrder.length || fromIndex === toIndex) {
      return;
    }

    const next = [...dragOrder];
    const [item] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, item);
    setDragOrder(next);
  };

  const handleDragStart = (item) => {
    if (submitDisabled) {
      return;
    }
    setDraggingItem(item);
  };

  const handleDropOnItem = (targetItem) => {
    if (!draggingItem || draggingItem === targetItem) {
      return;
    }

    const fromIndex = dragOrder.indexOf(draggingItem);
    const toIndex = dragOrder.indexOf(targetItem);
    moveDragItem(fromIndex, toIndex);
    setDraggingItem(null);
  };

  return (
    <div className="panel task-panel">
      <div className="task-header-row">
        <span className={`skill-chip ${task.isBonus ? "skill-chip--bonus" : ""}`}>{task.isBonus ? "BONUS" : `CLUE ${task.number}/${task.total}`}</span>
        {showTaskTimer ? <CircularTimer secondsLeft={timeLeft} total={15} danger={timeLeft <= 5} /> : null}
      </div>

      <h2>{task.text}</h2>

      {task.type === "mcq" ? (
        <div className="options-grid">
          {task.options.map((option, index) => (
            <button key={option} type="button" className={`option-card ${selectedChoice === index ? "option-card--selected" : ""}`} disabled={submitDisabled} onClick={() => setSelectedChoice(index)}>
              <span className="option-letter">{String.fromCharCode(65 + index)}</span>
              <span>{option}</span>
            </button>
          ))}
        </div>
      ) : null}

      {task.type === "fill_word" ? (
        <>
          <p className="task-prompt">{task.prompt}</p>
          <input className="input" value={fillText} onChange={(event) => setFillText(event.target.value)} disabled={submitDisabled} placeholder="Type your answer" />
        </>
      ) : null}

      {task.type === "matching" ? (
        <div className="matching-grid">
          {task.pairs.map((leftItem) => (
            <label key={leftItem} className="matching-row">
              <span>{leftItem}</span>
              <select className="input matching-select" value={matches[leftItem] || ""} onChange={(event) => setMatches((current) => ({ ...current, [leftItem]: event.target.value }))} disabled={submitDisabled}>
                <option value="">Match to a document</option>
                {task.targets.map((target) => (
                  <option key={target} value={target}>
                    {target}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {task.type === "drag_drop" ? (
        <>
          <p className="task-prompt">{task.prompt}</p>
          <div className="drag-stack">
            {dragOrder.map((item, index) => (
              <div
                key={item}
                className={`drag-row ${draggingItem === item ? "drag-row--dragging" : ""}`}
                draggable={!submitDisabled}
                onDragStart={() => handleDragStart(item)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDropOnItem(item)}
                onDragEnd={() => setDraggingItem(null)}
              >
                <span className="drag-index">{index + 1}</span>
                <span className="drag-handle" aria-hidden="true">
                  ::
                </span>
                <span className="drag-text">{item}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="task-actions-row">
        {task.type === "mcq" ? (
          <button className="btn btn-primary task-submit" type="button" onClick={submitMcq} disabled={submitDisabled || selectedChoice === null}>
            Submit Answer
          </button>
        ) : null}
        {task.type === "fill_word" ? (
          <button className="btn btn-primary task-submit" type="button" onClick={submitFillWord} disabled={submitDisabled || !fillText.trim()}>
            Check Word
          </button>
        ) : null}
        {task.type === "matching" ? (
          <button className="btn btn-primary task-submit" type="button" onClick={submitMatching} disabled={submitDisabled || Object.keys(matches).length !== task.pairs.length}>
            Submit Matches
          </button>
        ) : null}
        {task.type === "drag_drop" ? (
          <button className="btn btn-primary task-submit" type="button" onClick={() => onSubmit({ order: dragOrder })} disabled={submitDisabled}>
            Lock Order
          </button>
        ) : null}

        <button className="btn btn-outline task-hint-btn" type="button" onClick={onUseHint} disabled={submitDisabled || hintsRemaining <= 0}>
          Use Hint ({hintsRemaining})
        </button>
      </div>

      {revealedHints.length > 0 ? (
        <div className="hint-list">
          {revealedHints.map((hint, index) => (
            <div key={`${hint}-${index}`} className="hint-card">
              <span className="hint-index">Hint {index + 1}</span>
              <p>{hint}</p>
            </div>
          ))}
        </div>
      ) : null}

      {submissionState.message ? <div className={`result-banner ${submissionState.correct ? "result-banner--good" : "result-banner--bad"}`}>{submissionState.message}</div> : null}
    </div>
  );
}

function FeedbackBanner({ submissionState }) {
  if (!submissionState.message) {
    return null;
  }

  return <div className={`feedback-banner ${submissionState.correct ? "feedback-banner--good" : "feedback-banner--bad"}`}>{submissionState.message}</div>;
}

function TransitionOverlay({ overlay }) {
  if (!overlay) {
    return null;
  }

  return (
    <div className={`transition-overlay transition-overlay--${overlay.kind}`}>
      <div className="transition-overlay__card">
        <div className="transition-overlay__image-wrap">
          <img className="transition-overlay__image" src={overlay.image} alt="" />
        </div>
        <div className="transition-overlay__text">
          <p className="transition-overlay__eyebrow">{overlay.eyebrow}</p>
          <h2>{overlay.title}</h2>
          {overlay.subtitle ? <p>{overlay.subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

function HostDashboard({ room, onCloseRoom, onOpenFragment }) {
  return (
    <div className="screen dashboard-shell">
      <div className="dashboard-topbar">
        <div>
          <p className="eyebrow">HOST OVERVIEW</p>
          <h2>{room.caseData.title}</h2>
        </div>
        <button className="btn btn-outline" type="button" onClick={onCloseRoom}>
          Close Room
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="reading-pane">
          <div className="panel panel-soft">
            <p className="eyebrow">CASE EVIDENCE</p>
            <h3>Tap a document to inspect it</h3>
          </div>
          <DocumentBoard fragments={room.caseData.fragments} onOpenFragment={onOpenFragment} />
        </div>
        <div className="dashboard-sidebar">
          <div className="panel">
            <p className="eyebrow">CASE MODE</p>
            <h3>Self-paced investigation</h3>
            <p className="subtle">Players move independently while the room leaderboard updates live.</p>
          </div>
          <div className="panel">
            <div className="section-head">
              <h3>Leaderboard</h3>
              <span className="mono-small">{room.players.length} players</span>
            </div>
            <PlayerList players={room.players} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerDashboard({ room, onSubmitAnswer, onUseHint, submissionState, lostHeartBurst, onOpenFragment }) {
  const viewer = room.viewer;
  const task = room.dashboard?.currentTask;
  const isLocked = room.dashboard?.gameComplete || viewer?.completed;
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showReadings, setShowReadings] = useState(false);
  const playerRank = room.players.find((player) => player.id === viewer?.id)?.rank || "-";
  const progressCount = Math.min(viewer?.currentExerciseIndex || 0, room.caseData.questionCount);
  const progressPct = room.caseData.questionCount ? Math.round((progressCount / room.caseData.questionCount) * 100) : 0;

  return (
    <div className="screen play-screen">
      <div className="play-shell">
        <TopStatusBar
          rank={playerRank}
          hearts={viewer?.heartsRemaining || 0}
          brokenHeart={lostHeartBurst}
          hints={viewer?.hintsRemaining || 0}
          progressPct={progressPct}
        />

        <div className="game-title-banner">
          <div className="game-title-banner__copy">
            <h1>{room.caseData.title}</h1>
          </div>
          <button type="button" className="game-title-banner__book" onClick={() => setShowReadings(true)} aria-label="Open readings">
            <BookIcon size={24} color="#ffffff" />
          </button>
        </div>

        <div className="play-card-wrap">
          <div className="play-illustration-row">
            <img className="play-illustration" src={detectiveSneaking} alt="" />
          </div>
          <ExerciseCard
            task={task}
            submissionState={submissionState}
            onSubmit={onSubmitAnswer}
            disabled={isLocked}
            hintsRemaining={viewer?.hintsRemaining || 0}
            onUseHint={onUseHint}
            revealedHints={room.dashboard?.hints?.revealed || []}
          />
        </div>
      </div>

      <FeedbackBanner submissionState={submissionState} />

      {showLeaderboard ? (
        <Modal title="Leaderboard" icon={<TrophyIcon color="var(--yellow)" />} onClose={() => setShowLeaderboard(false)}>
          <PlayerList players={room.players} highlightId={viewer?.id} />
        </Modal>
      ) : null}

      {showReadings ? (
        <Modal title="Case Readings" icon={<BookIcon color="var(--blue)" />} onClose={() => setShowReadings(false)}>
          <DocumentBoard
            fragments={room.caseData.fragments}
            onOpenFragment={(fragment) => {
              setShowReadings(false);
              onOpenFragment(fragment);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function CaseClosedScreen({ room, onRestart }) {
  const viewer = room.viewer;
  const score = viewer?.score || 0;
  const rank = score >= 1800 ? "Master Detective" : score >= 1100 ? "Senior Investigator" : "Field Agent";

  return (
    <div className="screen center-screen">
      <div className="panel narrow-panel centered-panel results-card">
        <div className="results-illustration-row">
          <img className="results-illustration" src={detectiveStanding} alt="" />
          <img className="results-illustration" src={detectiveMagnifier} alt="" />
        </div>
        <div className="closed-stamp">CASE CLOSED</div>
        <h2>Detective {viewer?.name || "Anonymous"}</h2>
        <p className="tagline">Rank: {rank}</p>
        <div className="results-metrics">
          <div className="score-block">
            <p className="eyebrow">FINAL SCORE</p>
            <div className="score-value">{score.toLocaleString()}</div>
          </div>
          <div className="score-block">
            <p className="eyebrow">HEARTS LEFT</p>
            <div className="score-value score-value--small">{viewer?.heartsRemaining || 0}</div>
          </div>
        </div>
        <div className="panel panel-soft">
          <div className="section-head">
            <h3>Top Detectives</h3>
            <span className="mono-small">Final board</span>
          </div>
          <PlayerList players={room.players} highlightId={viewer?.id} />
        </div>
        <button className="btn btn-primary" type="button" onClick={onRestart}>
          Return to Landing
        </button>
      </div>
    </div>
  );
}

function App() {
  const socketRef = useRef(null);
  const suppressNextHeartOverlayRef = useRef(false);
  const lastPhaseRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [role, setRole] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("Connecting to server...");
  const [hostLoading, setHostLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [entryScreen, setEntryScreen] = useState(SCREENS.LANDING);
  const [lostHeartBurst, setLostHeartBurst] = useState(null);
  const [openFragment, setOpenFragment] = useState(null);
  const [overlayQueue, setOverlayQueue] = useState([]);
  const [activeOverlay, setActiveOverlay] = useState(null);
  const [submissionState, setSubmissionState] = useState({
    loading: false,
    correct: null,
    message: "",
  });

  const enqueueOverlay = (overlay) => {
    setOverlayQueue((current) => [...current, overlay]);
  };

  useEffect(() => {
    if (activeOverlay || overlayQueue.length === 0) {
      return;
    }

    const [nextOverlay, ...rest] = overlayQueue;
    setActiveOverlay(nextOverlay);
    setOverlayQueue(rest);
  }, [activeOverlay, overlayQueue]);

  useEffect(() => {
    if (!activeOverlay) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setActiveOverlay(null);
    }, activeOverlay.duration ?? 1000);

    return () => window.clearTimeout(timeout);
  }, [activeOverlay]);

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
      let shouldShowTimeoutMessage = false;
      let shouldClearSubmissionState = false;
      let shouldShowHeartOverlay = false;
      let shouldShowBonusOverlay = false;
      let shouldShowNextQuestionOverlay = false;

      setRoom((currentRoom) => {
        const previousHearts = currentRoom?.viewer?.heartsRemaining;
        const nextHearts = nextRoom?.viewer?.heartsRemaining;
        const previousTaskId = currentRoom?.dashboard?.currentTask?.id;
        const nextTaskId = nextRoom?.dashboard?.currentTask?.id;
        const lastResult = nextRoom?.viewer?.lastResult;
        const nextTaskIsBonus = nextRoom?.dashboard?.currentTask?.isBonus;
        const nextTaskExists = Boolean(nextTaskId);

        if (lastResult?.timedOut && previousTaskId !== nextTaskId) {
          shouldShowTimeoutMessage = true;
        } else if (previousTaskId !== nextTaskId) {
          shouldClearSubmissionState = true;
        }

        if (typeof previousHearts === "number" && typeof nextHearts === "number" && nextHearts < previousHearts) {
          setLostHeartBurst(nextHearts);
          window.setTimeout(() => setLostHeartBurst(null), 700);
          if (suppressNextHeartOverlayRef.current) {
            suppressNextHeartOverlayRef.current = false;
          } else {
            shouldShowHeartOverlay = true;
          }
        }

        if (previousTaskId && previousTaskId !== nextTaskId && nextTaskExists) {
          if (nextTaskIsBonus) {
            shouldShowBonusOverlay = true;
          } else if (!lastResult?.timedOut) {
            shouldShowNextQuestionOverlay = true;
          }
        }

        return nextRoom;
      });

      if (shouldShowHeartOverlay) {
        enqueueOverlay({
          kind: "heart",
          eyebrow: "HEART BROKEN",
          title: "One heart lost",
          subtitle: "Stay focused and keep going.",
          image: detectiveTorch,
          duration: 1000,
        });
      }

      if (shouldShowBonusOverlay) {
        enqueueOverlay({
          kind: "bonus",
          eyebrow: "BONUS ROUND",
          title: "Bonus question unlocked",
          subtitle: "Answer correctly to win one heart back.",
          image: detectiveStanding,
          duration: 1000,
        });
      } else if (shouldShowNextQuestionOverlay) {
        enqueueOverlay({
          kind: "next",
          eyebrow: "NEXT QUESTION",
          title: "New clue unlocked",
          subtitle: "Get ready for the next challenge.",
          image: detectiveMagnifier,
          duration: 1000,
        });
      }

      if (shouldShowTimeoutMessage) {
        setSubmissionState({
          loading: false,
          correct: false,
          message: "Time's up. One heart lost.",
        });
      } else if (shouldClearSubmissionState) {
        setSubmissionState({ loading: false, correct: null, message: "" });
      }

      setJoined(true);
      setError("");
      setActionLoading(false);
      setHintLoading(false);
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
      setHintLoading(false);
      setOpenFragment(null);
      setOverlayQueue([]);
      setActiveOverlay(null);
      setSubmissionState({ loading: false, correct: null, message: "" });
      setLostHeartBurst(null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const nextPhase = room?.phase ?? null;
    const previousPhase = lastPhaseRef.current;

    if (nextPhase === "reading" && previousPhase !== "reading") {
      enqueueOverlay({
        kind: "reading",
        eyebrow: "READING PHASE",
        title: "Let's Start Reading",
        subtitle: "Study the clues carefully before the questions begin.",
        image: detectiveNotebook,
        duration: 2000,
      });
    }

    if (previousPhase === "reading" && nextPhase === "playing") {
      enqueueOverlay({
        kind: "solve",
        eyebrow: "CASE ACTIVE",
        title: "Let's Solve This Mystery",
        subtitle: "The reading time is over. Start uncovering the truth.",
        image: detectiveTorch,
        duration: 2000,
      });
    }

    lastPhaseRef.current = nextPhase;
  }, [room?.phase]);

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

  const handleSubmitAnswer = (payload) => {
    const socket = socketRef.current;
    if (!socket || submissionState.loading) {
      return;
    }

    setSubmissionState({ loading: true, correct: null, message: "" });
    setError("");
    socket.emit("player:submit-answer", payload, (response) => {
      if (!response.ok) {
        setSubmissionState({ loading: false, correct: null, message: "" });
        setError(response.message);
        return;
      }

      let message = response.correct ? `Nice deduction. +${response.points} points.` : "Not quite. One heart lost.";
      if (!response.correct && !response.timedOut) {
        message = "Wrong answer. Moving to the next clue.";
      }
      if (response.bonusUnlocked) {
        message = "Final lead unlocked. Solve the bonus to recover a heart.";
      }
      if (response.recoveredHeart) {
        message = "Bonus solved. One heart restored.";
      }

      if (!response.correct) {
        suppressNextHeartOverlayRef.current = true;
        enqueueOverlay({
          kind: "heart",
          eyebrow: "HEART BROKEN",
          title: "Wrong answer",
          subtitle: "That clue is gone and one heart is lost.",
          image: detectiveTorch,
          duration: 1000,
        });
      }

      setSubmissionState({
        loading: false,
        correct: response.correct,
        message,
      });

      if (response.correct && response.points > 0) {
        enqueueOverlay({
          kind: "points",
          eyebrow: "POINTS GAINED",
          title: `+${response.points}`,
          subtitle: "Sharp detective work.",
          image: detectiveCamera,
          duration: 1000,
        });
      }
    });
  };

  const handleUseHint = () => {
    const socket = socketRef.current;
    if (!socket || hintLoading) {
      return;
    }

    setHintLoading(true);
    setError("");
    socket.emit("player:use-hint", {}, (response) => {
      setHintLoading(false);
      if (!response.ok) {
        setError(response.message);
      }
    });
  };

  const resetClientState = () => {
    lastPhaseRef.current = null;
    setJoined(false);
    setRole(null);
    setRoom(null);
    setEntryScreen(SCREENS.LANDING);
    setJoinCode("");
    setJoinName("");
    setError("");
    setOpenFragment(null);
    setOverlayQueue([]);
    setActiveOverlay(null);
    setSubmissionState({ loading: false, correct: null, message: "" });
    setLostHeartBurst(null);
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
      {joined && room && activeScreen === SCREENS.READING ? <ReadingPhaseScreen room={room} role={role} onCloseRoom={handleCloseRoom} onOpenFragment={setOpenFragment} /> : null}
      {joined && room && activeScreen === SCREENS.PLAYING && role === "host" ? <HostDashboard room={room} onCloseRoom={handleCloseRoom} onOpenFragment={setOpenFragment} /> : null}
      {joined && room && activeScreen === SCREENS.PLAYING && role === "player" ? (
        <PlayerDashboard room={room} onSubmitAnswer={handleSubmitAnswer} onUseHint={handleUseHint} submissionState={submissionState} lostHeartBurst={lostHeartBurst} onOpenFragment={setOpenFragment} />
      ) : null}
      {joined && room && activeScreen === SCREENS.CASE_CLOSED ? <CaseClosedScreen room={room} onRestart={resetClientState} /> : null}

      {openFragment ? (
        <Modal title={openFragment.label} icon={<BookIcon color="var(--blue)" />} onClose={() => setOpenFragment(null)}>
          <div className="fragment-modal-copy">
            <p className="fragment-tag">{(FRAGMENT_STYLES[openFragment.type] || FRAGMENT_STYLES.file).label}</p>
            <p>{openFragment.content}</p>
          </div>
        </Modal>
      ) : null}

      <TransitionOverlay overlay={activeOverlay} />

      <div className="status-rail">
        <span>{info}</span>
        {error ? <span className="status-error">{error}</span> : null}
      </div>
    </div>
  );
}

export default App;

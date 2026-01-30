import React, { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { api, setAuthToken, refreshToken } from "../api";
import { useNavigate } from "react-router-dom";
import { FiSend, FiPlus, FiTrash2 } from "react-icons/fi";

/* ================= TYPES ================= */

interface ChatMessage {
  text: string;
  from: "user" | "bot";
  isTyping?: boolean;
  createdAt?: string;
}

interface ChatSession {
  id: string;
  title?: string;
  createdAt: string;
}

/* ================= COMPONENT ================= */

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= AUTH & FETCH SESSIONS ================= */
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        navigate("/");
        return;
      }

      setAuthToken(token);

      try {
        const res = await api.get("/chat/history");
        if (Array.isArray(res.data)) {
          setSessions(res.data);
          if (res.data.length > 0) {
            setActiveSessionId(res.data[0]  );
          }
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.response?.status === 401) {
          const newToken = await refreshToken();
          if (newToken) {
            setAuthToken(newToken);
            try {
              const retryRes = await api.get("/chat/history");
              if (Array.isArray(retryRes.data)) {
                setSessions(retryRes.data);
                if (retryRes.data.length > 0) {
                  setActiveSessionId(retryRes.data[0]);
                }
              }
            } catch (err) {
              console.error("Retry failed after token refresh", err);
              navigate("/");
            }
          } else {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            navigate("/");
          }
        } else {
          console.error("Failed to fetch sessions", err);
        }
      }
    };

    initAuth();
  }, [navigate]);

  /* ================= FETCH CHAT MESSAGES ================= */
  useEffect(() => {
    if (!activeSessionId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]); // Clear old messages when session changes

    const fetchChat = async () => {
      try {
        const res = await api.get(`/chat/history/${activeSessionId}`);
        if (!Array.isArray(res.data)) return;

        const history: ChatMessage[] = res.data.flatMap((item: any) => {
          const msgs: ChatMessage[] = [];
          if (item.user_message)
            msgs.push({
              text: item.user_message,
              from: "user",
              createdAt: item.createdAt,
            });
          if (item.bot_message)
            msgs.push({
              text: item.bot_message,
              from: "bot",
              createdAt: item.createdAt,
            });
          return msgs;
        });

        setMessages(history);

        // Auto rename session title based on first user message
        if (history.length && history[0].from === "user") {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId
                ? { ...s, title: history[0].text }
                : s
            )
          );
        }
      } catch (err) {
        console.error("Failed to fetch chat", err);
      }
    };

    fetchChat();
  }, [activeSessionId]);

  /* ================= NEW CHAT SESSION ================= */
  const createNewSession = async () => {
    try {
      const res = await api.post("/chat/createSession", null, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      setSessions((prev) => [res.data, ...prev]);
      setActiveSessionId(res.data.id);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create session", err);
    }
  };

  /* ================= DELETE SESSION ================= */
  const deleteSession = async (sessionId: string) => {
    if (!window.confirm("Are you sure you want to delete this chat session?")) return;

    try {
      await api.delete(`/chat/history/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      setSessions((prev) => prev.filter((s) => s !== sessionId));

      if (activeSessionId === sessionId) {
        const remainingSessions = sessions.filter((s) => s !== sessionId);
        if (remainingSessions.length > 0) {
          setActiveSessionId(remainingSessions[0]);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  /* ================= SEND MESSAGE ================= */
  const sendMessage = async () => {
    if (!input.trim() || !activeSessionId) return;

    const userMsg: ChatMessage = {
      text: input,
      from: "user",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Add typing indicator
    setMessages((prev) => [
      ...prev,
      { text: "Typing...", from: "bot", isTyping: true },
    ]);

    try {
      const res = await api.post("/chat", {
        message: input,
        id: activeSessionId,
      });

      setMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        {
          text: res.data.reply,
          from: "bot",
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        {
          text: "Error sending message",
          from: "bot",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  /* ================= UTILS ================= */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setAuthToken(null);
    navigate("/");
  };

  /* ================= RENDER ================= */
  return (
    <div style={styles.layout}>
      {/* ===== SIDEBAR ===== */}
      <aside style={styles.sidebar}>
        <button style={styles.newChatBtn} onClick={createNewSession}>
          <FiPlus size={16} /> New chat
        </button>

        <div style={styles.sessionList}>
          {sessions.map((s) => (
            <div
              key={s}
              style={{
                ...styles.sessionItem,
                background: s === activeSessionId ? "#343541" : "transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{ cursor: "pointer", flex: 1 }}
                onClick={() => {
                  if (s !== activeSessionId) {
                    setMessages([]);
                    setActiveSessionId(s);
                  }
                }}
              >
                {s.title || "New chat"}
              </span>

              <button
                onClick={() => deleteSession(s)}
                style={styles.deleteButton}
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ===== CHAT AREA ===== */}
      <main style={styles.container}>
        <header style={styles.header}>
          <h3>Chat</h3>
          <button style={styles.logout} onClick={handleLogout}>
            Logout
          </button>
        </header>

        <section style={styles.chatBox}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.message,
                alignSelf: msg.from === "user" ? "flex-end" : "flex-start",
                background: msg.from === "user" ? "#4f46e5" : "#e5e5ea",
                color: msg.from === "user" ? "#fff" : "#000",
                fontStyle: msg.isTyping ? "italic" : "normal",
                opacity: msg.isTyping ? 0.7 : 1,
              }}
            >
              <div>{msg.text}</div>
              {msg.createdAt && (
                <div
                  style={{
                    fontSize: "10px",
                    marginTop: "2px",
                    textAlign: "right",
                    opacity: 0.6,
                  }}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </section>

        <footer style={styles.inputContainer}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            style={styles.input}
          />
          <button onClick={sendMessage} style={styles.sendButton}>
            <FiSend />
          </button>
        </footer>
      </main>
    </div>
  );
};

/* ================= STYLES ================= */

const styles: { [key: string]: React.CSSProperties } = {
  layout: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Inter', sans-serif",
    background: "#1f1f2e",
    color: "#fff",
  },

  /* ===== SIDEBAR ===== */
  sidebar: {
    width: "280px",
    background: "linear-gradient(180deg, #2c2c3e, #1a1a28)",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "2px 0 10px rgba(0,0,0,0.3)",
    borderRight: "1px solid #333",
  },
  newChatBtn: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(90deg, #6c5ce7, #a29bfe)",
    color: "#fff",
    fontWeight: 500,
    cursor: "pointer",
    marginBottom: "15px",
    transition: "transform 0.2s",
  },
  sessionList: {
    overflowY: "auto",
    flex: 1,
    marginTop: "10px",
  },
  sessionItem: {
    padding: "12px 15px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginBottom: "8px",
    transition: "all 0.2s",
  },
  deleteButton: {
    background: "transparent",
    border: "none",
    color: "#ff6b6b",
    cursor: "pointer",
    fontWeight: "bold",
    marginLeft: "8px",
    display: "flex",
    alignItems: "center",
  },

  /* ===== CHAT AREA ===== */
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#f5f6fa",
  },
  header: {
    padding: "16px",
    background: "#fff",
    borderBottom: "1px solid #ddd",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: 600,
    fontSize: "18px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  },
  logout: {
    border: "none",
    background: "#ef4444",
    color: "#fff",
    padding: "8px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 500,
    transition: "background 0.2s",
  },
  chatBox: {
    flex: 1,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
    background: "#e8e8f0",
  },
  message: {
    padding: "12px 18px",
    borderRadius: "20px",
    maxWidth: "70%",
    wordWrap: "break-word",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
  inputContainer: {
    display: "flex",
    padding: "14px 16px",
    background: "#fff",
    borderTop: "1px solid #ddd",
  },
  input: {
    flex: 1,
    padding: "14px 18px",
    borderRadius: "25px",
    border: "1px solid #ccc",
    outline: "none",
    fontSize: "14px",
    transition: "border-color 0.2s",
  },
  sendButton: {
    marginLeft: "12px",
    padding: "14px",
    borderRadius: "50%",
    border: "none",
    background: "linear-gradient(135deg, #6c5ce7, #a29bfe)",
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s",
  },
};

export default Chat;

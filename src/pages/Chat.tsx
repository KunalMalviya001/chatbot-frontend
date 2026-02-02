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
  _id: string;
  title?: string;
  createdAt: string;
  chat_history?: { user_message?: string; bot_message?: string }[];
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
          
          // Retrieve the active session ID from localStorage on page load
          const storedSessionId = localStorage.getItem("activeSessionId");
          if (storedSessionId) {
            setActiveSessionId(storedSessionId);
          } else if (res.data.length > 0) {
            // If no stored session, default to the first session
            setActiveSessionId(res.data[0]._id);
          }
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          const newToken = await refreshToken();
          if (newToken) {
            setAuthToken(newToken);
            const retryRes = await api.get("/chat/history");
            if (Array.isArray(retryRes.data)) {
              setSessions(retryRes.data);
            }
          } else {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            navigate("/");
          }
        }
      }
    };

    initAuth();
  }, [navigate]);

  /* ================= FETCH CHAT + SESSIONS ================= */
  useEffect(() => {
    const fetchChat = async () => {
      if (!activeSessionId) return;

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
    };

    fetchChat();
  }, [activeSessionId]);

  /* ================= NEW SESSION ================= */
  const createNewSession = async () => {
    const res = await api.post("/chat/createSession", null, {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    });

    // Set and persist the new session as active
    setActiveSessionId(res.data._id);
    localStorage.setItem("activeSessionId", res.data._id);  // Persist active session in localStorage
    setMessages([]); // Clear messages

    // Auto refresh after creating a new session
    window.location.reload();
  };

  /* ================= DELETE SESSION ================= */
  const deleteSession = async (sessionId: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this session?");
    if (!confirmDelete) return;

    try {
      await api.delete(`/chat/history/${sessionId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });

      // Update state without refreshing the page
      setSessions((prevSessions) => prevSessions.filter((session) => session._id !== sessionId));

      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        localStorage.removeItem("activeSessionId"); // Clear the active session from localStorage
      }
    } catch (err) {
      console.error("Error deleting session:", err);
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

    setMessages((prev) => [...prev, { text: "Typing...", from: "bot", isTyping: true }]);

    await api.post("/chat", {
      message: input,
      id: activeSessionId,
    });

    // Refresh after sending the message
    window.location.reload();
  };

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <button style={styles.newChatBtn} onClick={createNewSession}>
          <FiPlus size={16} /> New chat
        </button>

        <div style={styles.sessionList}>
          {sessions.map((s) => (
            <div
              key={s._id}
              style={{
                ...styles.sessionItem,
                background: s._id === activeSessionId ? "#343541" : "transparent",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{ cursor: "pointer", flex: 1 }}
                onClick={() => {
                  setActiveSessionId(s._id);
                  localStorage.setItem("activeSessionId", s._id);  // Persist active session
                }}
              >
                {s.chat_history?.[0]?.user_message || "New chat"}
              </span>

              <button onClick={() => deleteSession(s._id)} style={styles.deleteButton}>
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main style={styles.container}>
        <header style={styles.header}>
          <h3>Chat</h3>
          <button
            style={styles.logout}
            onClick={() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("activeSessionId"); // Clear the active session on logout
              setAuthToken(null);
              navigate("/");
            }}
          >
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
                <div style={{ fontSize: "10px", marginTop: "2px", textAlign: "right", opacity: 0.6 }}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
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

export default Chat;

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
    backgroundColor: "#4f46e5",
    color: "#fff",
    fontWeight: 500,
    cursor: "pointer",
    marginBottom: "15px",
  },
  sessionList: {
    overflowY: "auto",
    flex: 1,
  },
  sessionItem: {
    padding: "12px 15px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    marginBottom: "8px",
  },
  deleteButton: {
    background: "transparent",
    border: "none",
    color: "#ff6b6b",
    cursor: "pointer",
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
  },
  logout: {
    background: "#ef4444",
    padding: "8px 16px",
    borderRadius: "8px",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },
  chatBox: {
    flex: 1,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
  },
  message: {
    padding: "12px 18px",
    borderRadius: "20px",
    maxWidth: "70%",
    wordWrap: "break-word",
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
  },
  sendButton: {
    marginLeft: "12px",
    padding: "14px",
    borderRadius: "50%",
    background: "#4f46e5",
    color: "#fff",
    cursor: "pointer",
  },
};


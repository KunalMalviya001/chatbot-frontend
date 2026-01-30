import React, { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { api, setAuthToken } from "../api";
import { useNavigate } from "react-router-dom";
import { FiSend } from "react-icons/fi";

interface ChatMessage {
  text: string;
  from: "user" | "bot";
  isTyping?: boolean;
  createdAt?: string;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check auth token, set it, and fetch chat history
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/");
      return;
    }

    setAuthToken(token); // set Bearer token for all requests

    const fetchChatHistory = async () => {
      try {
        const res = await api.get("/chat"); // GET chat history
        // console.log("API response:", res.data);

        if (Array.isArray(res.data)) {
          // Transform API response into ChatMessage[]
          const history: ChatMessage[] = res.data
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .flatMap((item: any) => {
              const msgs: ChatMessage[] = [];
              if (item.user_message)
                msgs.push({ text: item.user_message, from: "user", createdAt: item.createdAt });
              if (item.bot_message)
                msgs.push({ text: item.bot_message, from: "bot", createdAt: item.createdAt });
              return msgs;
            })
            .sort((a: ChatMessage, b: ChatMessage) => {
              // Sort chronologically
              const aTime = new Date(a.createdAt || 0).getTime();
              const bTime = new Date(b.createdAt || 0).getTime();
              return aTime - bTime;
            });

          setMessages(history);
        } else {
          console.warn("Unexpected chat history format", res.data);
        }
      } catch (err) {
        console.error("Failed to fetch chat history:", err);
      }
    };

    fetchChatHistory();
  }, [navigate]);

  // Send message to backend
  const sendMessage = async () => {
    if (!input.trim()) return;

    // 1️⃣ Add user message
    const userMessage: ChatMessage = { text: input, from: "user", createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // 2️⃣ Add typing indicator
    const typingMessage: ChatMessage = { text: "Typing...", from: "bot", isTyping: true };
    setMessages((prev) => [...prev, typingMessage]);

    try {
      const res = await api.post("/chat", { message: input });

      // 3️⃣ Replace typing indicator with bot response
      const botMessage: ChatMessage = {
        text: res.data.reply,
        from: "bot",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev.filter((m) => !m.isTyping), botMessage]);
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => !m.isTyping),
        { text: "Error sending message", from: "bot", createdAt: new Date().toISOString() },
      ]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setAuthToken(null); // remove token from axios headers
    navigate("/");
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Chat Bot</h2>
        <button style={styles.logout} onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div style={styles.chatBox}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
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
                {formatTime(msg.createdAt)}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputContainer}>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.sendButton}>
          <FiSend size={20} />
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: "600px",
    margin: "50px auto",
    display: "flex",
    flexDirection: "column",
    height: "80vh",
    border: "1px solid #ccc",
    borderRadius: "12px",
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px",
    background: "#4f46e5",
    color: "#fff",
  },
  logout: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "8px",
    background: "#fff",
    color: "#4f46e5",
    cursor: "pointer",
    fontWeight: "bold",
  },
  chatBox: {
    flex: 1,
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflowY: "auto",
    background: "#f0f2f5",
  },
  message: {
    padding: "10px 15px",
    borderRadius: "20px",
    maxWidth: "70%",
    wordBreak: "break-word",
    transition: "all 0.3s",
  },
  inputContainer: {
    display: "flex",
    padding: "10px",
    borderTop: "1px solid #ccc",
    background: "#fff",
  },
  input: {
    flex: 1,
    padding: "12px 15px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    outline: "none",
    fontSize: "16px",
  },
  sendButton: {
    marginLeft: "10px",
    padding: "12px 16px",
    borderRadius: "50%",
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export default Chat;

import React, { useState, useEffect, type KeyboardEvent, useRef } from "react";
import { api, setAuthToken } from "../api";
import { useNavigate } from "react-router-dom";

interface ChatMessage {
  text: string;
  from: "user" | "bot";
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) navigate("/");
    else setAuthToken(token);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input) return;
    const newMessages = [...messages, { text: input, from: "user" }];
    setMessages(newMessages);
    setInput("");

    try {
      const res = await api.post("/chat", { message: input });
      setMessages([...newMessages, { text: res.data.reply, from: "bot" }]);
    } catch {
      setMessages([...newMessages, { text: "Error sending message", from: "bot" }]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setAuthToken(null);
    navigate("/");
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
            }}
          >
            {msg.text}
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
          Send
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
  },
  inputContainer: {
    display: "flex",
    padding: "10px",
    borderTop: "1px solid #ccc",
    background: "#fff",
  },
  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "20px",
    border: "1px solid #ccc",
    outline: "none",
    fontSize: "16px",
  },
  sendButton: {
    marginLeft: "10px",
    padding: "12px 20px",
    borderRadius: "20px",
    border: "none",
    background: "#4f46e5",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
  },
};

export default Chat;

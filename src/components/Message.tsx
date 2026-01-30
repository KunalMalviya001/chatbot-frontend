interface MessageProps {
  text: string;
  from: "user" | "bot";
}

export default function Message({ text, from }: MessageProps) {
  return (
    <div
      style={{
        textAlign: from === "user" ? "right" : "left",
        margin: "10px 0",
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: "10px",
          borderRadius: "10px",
          background: from === "user" ? "#a0e1e0" : "#eee",
        }}
      >
        {text}
      </span>
    </div>
  );
}

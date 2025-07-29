import React, { useState, FormEvent } from "react";
import axios from "axios";

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [reply, setReply] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Now uses the Vite proxy at /api/chat/…
      const res = await axios.get<{ response: string }>(
        `/api/chat/${encodeURIComponent(prompt)}`
      );
      setReply(res.data.response);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chat with FastAPI AI</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your question..."
          className="flex-1 border rounded px-3 py-2"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </form>

      {error && <p className="text-red-500 mb-2">Error: {error}</p>}

      {reply && (
        <div className="bg-gray-100 p-3 rounded">
          <h2 className="font-semibold mb-1">Response:</h2>
          <p>{reply}</p>
        </div>
      )}
    </div>
  );
};

export default App;

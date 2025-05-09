import React, { useState, useRef, useEffect } from 'react';

export default function Chatbox() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const chatContainer = useRef(null);

  const handleSubmitFn = async () => {
    if (message.trim()) {
      const userMsg = { sender: 'user', text: message.trim() };
      setChatHistory(prev => [...prev, userMsg]);
  
      // send message to backend to trigger tool
      await fetch('http://localhost:3001/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
  
      // no reply here — it comes via SSE
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmitFn();
    }
  };

  const handleClearChat = () => {
    setChatHistory([]);
  };

  useEffect(() => {
    let retryTimeout;
    const connectToStream = () => {
      const source = new EventSource('http://localhost:3001/stream');
  
      source.onmessage = (event) => {
        const text = event.data;
        setChatHistory(prev => [...prev, { sender: 'bot', text }]);
      };
  
      source.onerror = (event) => {
        console.error('Error with EventSource:', event);
        if (event.target.readyState === EventSource.CLOSED) {
          // Retry logic after 3 seconds
          retryTimeout = setTimeout(connectToStream, 3000);
        }
      };
  
      return source;
    };
  
    const source = connectToStream();
  
    return () => {
      clearTimeout(retryTimeout);
      source.close();
    };
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Left Column */}
      <div className="w-[20%] bg-red-200 p-4 fixed h-screen">
        <div className="flex justify-between items-center">
          <h1 className="md:text-2xl font-bold">VENN</h1>
          <button
            onClick={handleClearChat}
            className="md:text-xl font-bold"
          >
            Clear
          </button>
        </div>
        <div className="border-b-4 border-black mt-2"></div>
      </div>

      {/* Right Column */}
      <div className="w-[80%] flex flex-col ml-[20%]">
        <div className="flex flex-col h-screen overflow-y-auto">
          {/* Chat history container */}
          <div>
            {chatHistory.length === 0 && (
              <h1 className="font-bold md:text-2xl text-center m-2">
                What can I help with?
              </h1>
            )}
          </div>
          <div
            ref={chatContainer}
            className="flex-1 overflow-y-auto p-4 text-white"
            style={{ maxHeight: 'calc(100vh - 100px)' }}
          >
            <ul className="space-y-2">
              {chatHistory.map((msg, index) => (
                <li
                  key={index}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${msg.sender === 'user'
                      ? 'bg-gray-600 text-right'
                      : 'bg-gray-800'
                      }`}
                  >
                    {msg.text}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Input section */}
          <div className="flex items-center p-4 bg-white rounded-lg space-y-5">
            <input
              className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
            />
            <button
              className="mb-5 ml-2 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={handleSubmitFn}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
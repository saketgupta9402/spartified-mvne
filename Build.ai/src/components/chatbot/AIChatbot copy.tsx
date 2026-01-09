import 'src/theme/styles/tableStyle.css';

import axios from 'axios';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import React, { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MicIcon from '@mui/icons-material/Mic';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MicOffIcon from '@mui/icons-material/MicOff';
import DownloadIcon from '@mui/icons-material/Download';

import config from 'src/config-global';

import labels from 'src/sections/locales/language.json';

import LoadingComponent from '../loader/loader';
/// <reference lib="dom" />

type SpeechRecognitionAlternativeType = {
  new (): {
    lang: string;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onresult: ((event: any) => void) | null;
  };
};

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionAlternativeType;
    webkitSpeechRecognition: SpeechRecognitionAlternativeType;
  }
}

// Define the type for API response data and user messages
interface ChatMessage {
  sender: 'user' | 'bot';
  text?: string;
  tableData?: any[];
}

// Define a mapping of predefined queries to API endpoints
const apiMappings: { [key: string]: string } = {
  'top 10 sims by bill': `${config.api_base_url}/top10_sims_by_bill`,
  'top rate plan by usage': `${config.api_base_url}/total-usage-per-plan`,
  'top network by usage': `${config.api_base_url}/aggregate-usage`,
  'total bill': `${config.api_base_url}/billing-total`,
  'total sims': `${config.api_base_url}/sim-total`,
  'billing summary': `${config.api_base_url}/billing-summary`,
  'sim count per account': `${config.api_base_url}/accounts-by-sim-count`,
  'top accounts by usage': `${config.api_base_url}/top-accounts-by-usage`,
  'top accounts by bill': `${config.api_base_url}/top-accounts-by-bill`,
  'account total trend': `${config.api_base_url}/account-total-history`,
  'sim total trend': `${config.api_base_url}/sim-total-history`,
  'account billing trend': `${config.api_base_url}/billing-history`,
  'cdr records trend': `${config.api_base_url}/cdr-records-history`,
  'rate plan details': `${config.api_base_url}/get_rate_plan_details`,
  'rate plan list': `${config.api_base_url}/get_rate_plan_details`,
  'top 10 sims by usage': `${config.api_base_url}/top10_sims_by_usage`,
  'top 10 sims': `${config.api_base_url}/top10_sims_by_usage`,
};

const suggestedQuestions = [
  'Top 10 sims by bill',
  'Top rate plan by usage',
  'Top network by usage',
  'Total bill',
  'Total SIMs',
  'Billing summary',
];

const loadingMessages = [
  'We are analysing...',
  'Forming a query...',
  'Now retrieving data...',
  'Here is the response',
];

export function AIChatbot() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [chatMessages]);

  // Common keywords to remove before matching
  const queryPrefixes = [
    'show me',
    'show me the',
    'can you show',
    'could you find',
    'tell me',
    'get me',
    'give me',
    'please provide',
    'i need',
    'quiero ver',
    'montrez-moi',
    'mostrame',
    'gib mir',
  ];

  const isSubmitted = useRef(false); // Add a ref to track submission status

  const handleSpeechRecognition = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
  
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
  
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = true; // Allow real-time speech updates
  
    recognition.onstart = () => {
      setIsListening(true);
      isSubmitted.current = false;
    };
  
    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
  
      for (let i = 0; i < event.results.length; i += 1) {
        const {transcript} = event.results[i][0];
        if (event.results[i].isFinal) {
          finalTranscript += `${transcript  } `;
        } else {
          interimTranscript += `${transcript  } `;
        }
      }
  
      // Display real-time text while speaking
      setUserInput(finalTranscript + interimTranscript);
    };
  
    recognition.onend = () => {
      setIsListening(false);
  
      // Ensure final recognized text is submitted as a query
      setTimeout(() => {
        setUserInput((prevInput) => {
          if (prevInput.trim() !== "" && isSubmitted.current === false) {
            isSubmitted.current = true;
            handleQuerySubmit(prevInput);
          }
          return ""; // Clear input field after submission
        });
      }, 500);
    };
  
    recognition.start();
  };  

  // Function to clean input query
  const cleanQuery = (input: string): string => {
    let query = input.toLowerCase().trim();
    // Remove common query prefixes
    queryPrefixes.forEach((prefix) => {
      if (query.startsWith(prefix)) {
        query = query.replace(prefix, '').trim();
      }
    });

    return query;
  };

  // Function to find the best match
  const findBestMatch = (input: string): string | null => {
    const cleanedInput = cleanQuery(input);
    return apiMappings[cleanedInput] || null;
  };

  const handleQuerySubmit = async (input: string): Promise<void> => {
    if (!input.trim()) return;

    setChatMessages((prev) => [...prev, { sender: 'user', text: input }]);

    setUserInput('');

    setIsLoading(true);

    const apiUrl = findBestMatch(input);

    try {
      if (apiUrl) {
        const response = await axios.get(apiUrl);

        setChatMessages((prev) => [...prev, { sender: 'bot', tableData: response.data }]);
      } else {
        // Handle streaming response for AI analysis
        const response = await fetch(`${config.api_base_url}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: input }),
        });

        if (!response.body) {
          throw new Error('No response body from server.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botMessage = '';

        setChatMessages((prev) => [...prev, { sender: 'bot', text: '' }]);

        const updateMessage = (text: string) => {
          setChatMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.sender === 'bot') {
              return [...prev.slice(0, -1), { sender: 'bot', text }];
            }
            return prev;
          });
        };

        const processStream = async () => {
          const { done, value } = await reader.read();
          if (done) return;

          const text = decoder.decode(value, { stream: true });
          botMessage += text;
          updateMessage(botMessage);

          // Process the table data progressively
          try {
            const tableData = JSON.parse(botMessage).response; // Assuming the response key holds the array
            setChatMessages((prev) => [
              ...prev.slice(0, -1), // Keep the latest bot message
              { sender: 'bot', tableData }, // Update the table data progressively
            ]);
          } catch (error) {
            // Continue reading if data is incomplete
          }

          await processStream();
        };

        try {
          await processStream();
        } finally {
          reader.releaseLock();
        }
      }
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: 'An error occurred. Please try again.' },
      ]);
    }
    setIsLoading(false);
  };

  const exportChatHistory = () => {
    const chatHistory = chatMessages
      .map((msg) => {
        if (msg.sender === 'bot' && msg.tableData) {
          // Extract column names dynamically
          const headers = Object.keys(msg.tableData[0]);

          // Determine the maximum width for each column based on the longest value
          const columnWidths = headers.map((header) => {
            const maxDataWidth = Math.max(
              ...(msg.tableData || []).map((row) => (row[header] ? String(row[header]).length : 0))
            );
            return Math.max(header.length, maxDataWidth) + 2; // Add padding for better spacing
          });

          // Format table header with dynamic spacing
          const formattedHeaders = headers
            .map((header, index) => header.padEnd(columnWidths[index]))
            .join(' | ');
          const separator = headers.map((_, index) => '-'.repeat(columnWidths[index])).join('-|-');

          // Format table rows with dynamic column spacing
          const tableDataString = msg.tableData
            .map((row) =>
              headers
                .map((header, index) => String(row[header] || '').padEnd(columnWidths[index]))
                .join(' | ')
            )
            .join('\n');

          // Construct the final table format
          const formattedTable = [
            `+${'-'.repeat(formattedHeaders.length + 2)}+`, // Top border
            `| ${formattedHeaders} |`, // Column headers
            `| ${separator} |`, // Separator line
            tableDataString
              .split('\n')
              .map((row) => `| ${row} |`)
              .join('\n'), // Data rows
            `+${'-'.repeat(formattedHeaders.length + 2)}+`, // Bottom border
          ].join('\n');

          return `bot:\n${formattedTable}`; // Include formatted table in export
        }
        return `${msg.sender}: ${msg.text || 'No data available'}`;
      })
      .join('\n');

    // Create and download the text file
    const blob = new Blob([chatHistory], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_history.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card sx={{ p: 3, mt: 1, position: 'relative' }}>
      <Tooltip title="Export Chat History" arrow placement="top">
        <IconButton
          sx={{ position: 'absolute', top: 16, right: 16 }}
          onClick={exportChatHistory}
          aria-label="Export Chat History"
        >
          <DownloadIcon />
        </IconButton>
      </Tooltip>
      <Typography variant="h6" sx={{ mb: 1, pt: 0 }}>
        Billing AI Chatbot
      </Typography>
      <Box sx={{ maxHeight: '400px', overflowY: 'auto', mb: 2 }} ref={chatContainerRef}>
        {chatMessages.map((msg, index) => (
          <Box key={index} sx={{ textAlign: msg.sender === 'user' ? 'right' : 'left', mb: 2 }}>
            {msg.text && (
              <Box
                sx={{
                  display: 'inline-block',
                  p: 2,
                  borderRadius: 1,
                  maxWidth: '80%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  bgcolor: msg.sender === 'user' ? '#e3f2fd' : '#f5f5f5',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <ReactMarkdown className="markdown-table" remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </Box>
            )}
            {msg.tableData && msg.tableData.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <table className="table">
                  <thead>
                    <tr>
                      {Object.keys(msg.tableData[0]).map((key, keyIndex) => (
                        <th key={keyIndex}>
                          {labels.labels[key as keyof typeof labels.labels] ||
                            key.replace('_', ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {msg.tableData.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {Object.values(row).map((value, valueIndex) => (
                          <td key={valueIndex}>
                            {typeof value === 'string' || typeof value === 'number' ? value : 'N/A'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
          </Box>
        ))}

        {/* Show loading spinner when bot is processing */}
        <LoadingComponent isLoading={isLoading} loadingMessages={loadingMessages} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {suggestedQuestions.map((question, index) => (
          <Button
            key={index}
            variant="outlined"
            type="button"
            onClick={() => handleQuerySubmit(question)}
          >
            {question}
          </Button>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask about usage, billing, plans, or networks..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleQuerySubmit(userInput);
          }}
        />
        {/* Mic Button with Animation */}
        <Tooltip title={isListening ? 'Listening...' : 'Click to Speak'}>
          <IconButton
            onClick={handleSpeechRecognition}
            sx={{
              backgroundColor: isListening ? '#0080ff' : 'transparent',
              color: isListening ? 'white' : 'inherit',
              animation: isListening ? 'pulse 1.5s infinite' : 'none',
              transition: 'all 0.3s ease-in-out',
            }}
          >
            {isListening ? <MicIcon /> : <MicOffIcon />}
          </IconButton>
        </Tooltip>

        {/* Mic Animation Style */}
        <style>
          {`
          @keyframes pulse {
            0% { box-shadow: 0 0 5px rgba(0, 0, 255, 0.5); }
            50% { box-shadow: 0 0 15px rgba(0, 0, 255, 1); }
            100% { box-shadow: 0 0 5px rgba(0, 0, 255, 0.5); }
          }
        `}
        </style>
        <Button variant="contained" type="button" onClick={() => handleQuerySubmit(userInput)}>
          Send
        </Button>
      </Box>
    </Card>
  );
}
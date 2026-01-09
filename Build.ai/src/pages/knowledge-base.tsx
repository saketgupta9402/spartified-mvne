import React, { useRef, useState, useEffect } from 'react';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';

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
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import RefreshIcon from '@mui/icons-material/Refresh';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import UploadFileIcon from '@mui/icons-material/UploadFile'; // New import
import { fetchKnowledgeBaseResponse, uploadKnowledgeBaseDocument } from 'src/services/knowledge-baseService';
import config from 'src/config-global';
import { v4 as uuidv4 } from 'uuid';

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

interface ChatMessage {
  sender: 'user' | 'bot';
  text?: string;
  tableData?: any[];
  id: string;
}

const languageMap: { [key: string]: string } = {
  'en-US': 'en-US',
  'es-ES': 'es-ES',
  'fr-FR': 'fr-FR',
  'de-DE': 'de-DE',
  'pt-PT': 'pt-PT',
};

const tableResponseMessages: { [key: string]: string } = {
  'en-US': 'See the results in the table below.',
  'es-ES': 'Vea los resultados en la tabla a continuación.',
  'fr-FR': 'Voir les résultats dans le tableau ci-dessous.',
  'de-DE': 'Sieh dir die Ergebnisse in der Tabelle unten an.',
  'pt-PT': 'Veja os resultados na tabela abaixo.',
};

const formatResponseText = (text: string): string => {
  const listPattern = /(\d+\.\s+)/g;
  let formattedText = text.replace(listPattern, '\n$1');
  formattedText = formattedText.replace(/(\.\s+)([A-Z][a-z]+)/g, '$1\n$2');
  formattedText = formattedText.replace(/\n\s*\n/g, '\n\n').trim();
  return formattedText;
};

const speakText = (text: string, isEnabled: boolean, lang: string) => {
  if (!isEnabled || !window.speechSynthesis || !text.trim()) {
    if (!window.speechSynthesis) console.error('SpeechSynthesis not supported in this browser.');
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang })));

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  const matchingVoice = voices.find(voice => voice.lang === lang || voice.lang.startsWith(lang.split('-')[0]));
  if (matchingVoice) {
    utterance.voice = matchingVoice;
    console.log('Using voice:', { name: matchingVoice.name, lang: matchingVoice.lang });
  } else {
    console.warn(`No voice found for language: ${lang}. Falling back to default.`);
  }

  utterance.rate = 1.0;
  utterance.volume = 1.0;
  utterance.onend = () => console.log('Speech finished:', { text, lang });
  utterance.onerror = (event) => console.error('SpeechSynthesis error:', event.error);

  console.log('Speaking:', { text, lang });
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

// Suppress arrow-body-style for this multi-statement function
// eslint-disable-next-line arrow-body-style
const loadVoices = () => {
  return new Promise<void>((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        resolve();
      };
    }
  });
};

export default function KnowledgeBaseChatbot() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const savedChat = sessionStorage.getItem('knowledgeBaseChatHistory');
    return savedChat ? JSON.parse(savedChat).map((msg: ChatMessage) => ({ ...msg, id: msg.id || uuidv4() })) : [];
  });

  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US');
  const [knowledgeContent, setKnowledgeContent] = useState<string>(''); // Changed to string
  const [file, setFile] = useState<File | null>(null); // New state for file upload
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isSubmitted = useRef(false);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [chatMessages]);

  useEffect(() => {
    sessionStorage.setItem('knowledgeBaseChatHistory', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    loadVoices();
    const fetchKnowledgeContent = async () => {
      try {
        const response = await fetch(`${config.api_base_url}/knowledge-base-info`);
        const data = await response.text();
        setKnowledgeContent(data);
      } catch (error) {
        console.error('Error fetching knowledge content:', error);
        setKnowledgeContent('Failed to load knowledge base content.');
      }
    };
    fetchKnowledgeContent();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpeechRecognition = () => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = selectedLanguage;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      isSubmitted.current = false;
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const { transcript } = event.results[i][0];
        if (event.results[i].isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interimTranscript += `${transcript} `;
        }
      }
      setUserInput(finalTranscript + interimTranscript);
    };

    recognition.onend = () => {
      setIsListening(false);
      setTimeout(() => {
        setUserInput((prevInput) => {
          if (prevInput.trim() !== '' && !isSubmitted.current) {
            isSubmitted.current = true;
            handleQuerySubmit(prevInput);
          }
          return '';
        });
      }, 500);
    };

    recognition.start();
  };

  const handleQuerySubmit = async (input: string = userInput) => {
    if (!input.trim()) return;

    const newUserMessage: ChatMessage = { sender: 'user', text: input, id: uuidv4() };
    setChatMessages((prev) => [...prev, newUserMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const conversationHistory = chatMessages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text || (msg.tableData ? JSON.stringify(msg.tableData) : ''),
      }));

      const response = await fetch(`${config.api_base_url}/knowledge_base`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          history: conversationHistory,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error('No response body from server.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botMessage = '';
      const botMessageId = uuidv4();

      setChatMessages((prev) => [...prev, { sender: 'bot', text: '', id: botMessageId }]);

      const processStream = async () => {
        const { done, value } = await reader.read();
        if (done) {
          const formattedText = formatResponseText(botMessage);
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId ? { sender: 'bot', text: formattedText, id: msg.id } : msg
            )
          );
          if (isSpeaking) speakText(formattedText, isSpeaking, selectedLanguage);
          return;
        }

        const chunk = decoder.decode(value, { stream: true });
        botMessage += chunk;
        const formattedText = formatResponseText(botMessage);
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, text: formattedText } : msg
          )
        );
        await processStream();
      };

      await processStream();
    } catch (error) {
      console.error('Error in handleQuerySubmit:', error);
      const errorMsg = 'Error retrieving response. Please try again.';
      setChatMessages((prev) => [...prev, { sender: 'bot', text: errorMsg, id: uuidv4() }]);
      if (isSpeaking) speakText(errorMsg, isSpeaking, selectedLanguage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      alert('Please select a file to upload.');
      return;
    }

    try {
      setIsLoading(true);
      await uploadKnowledgeBaseDocument(file);
      alert('File uploaded and processed successfully!');
      setKnowledgeContent('Knowledge base updated with new document.');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsLoading(false);
      setFile(null);
    }
  };

  const exportChatHistory = () => {
    const chatHistory = chatMessages
      .map((msg) => {
        if (msg.sender === 'bot' && msg.tableData) {
          const headers = Object.keys(msg.tableData[0]);
          const columnWidths = headers.map((header) =>
            Math.max(
              header.length,
              ...(msg.tableData || []).map((row) => (row[header] ? String(row[header]).length : 0))
            ) + 2
          );
          const formattedHeaders = headers.map((header, index) => header.padEnd(columnWidths[index])).join(' | ');
          const separator = headers.map((_, index) => '-'.repeat(columnWidths[index])).join('-|-');
          const tableDataString = msg.tableData
            .map((row) =>
              headers.map((header, index) => String(row[header] || '').padEnd(columnWidths[index])).join(' | ')
            )
            .join('\n');
          const formattedTable = [
            `+${'-'.repeat(formattedHeaders.length + 2)}+`,
            `| ${formattedHeaders} |`,
            `| ${separator} |`,
            tableDataString.split('\n').map((row) => `| ${row} |`).join('\n'),
            `+${'-'.repeat(formattedHeaders.length + 2)}+`,
          ].join('\n');
          return `bot:\n${formattedTable}`;
        }
        return `${msg.sender}: ${msg.text || 'No data available'}`;
      })
      .join('\n\n');

    const blob = new Blob([chatHistory], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge_base_chat_history.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNewChatClick = () => {
    if (chatMessages.length > 0) {
      setOpenDialog(true);
    } else {
      handleNewChat();
    }
  };

  const handleNewChat = () => {
    setChatMessages([]);
    window.speechSynthesis.cancel();
    sessionStorage.removeItem('knowledgeBaseChatHistory');
  };

  const handleDialogConfirm = (exportFirst: boolean) => {
    if (exportFirst) {
      exportChatHistory();
    }
    handleNewChat();
    setOpenDialog(false);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

  const toggleSpeech = () => {
    setIsSpeaking((prev) => {
      if (prev) window.speechSynthesis.cancel();
      return !prev;
    });
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', p: 2, gap: 2 }}>
      <Card sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', minWidth: { xs: 300, md: 400 }, width: '50%' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Knowledge Base Chatbot</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.paper', py: 1 }}>
          <Select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="en-US">English</MenuItem>
            <MenuItem value="es-ES">Spanish</MenuItem>
            <MenuItem value="fr-FR">French</MenuItem>
            <MenuItem value="de-DE">German</MenuItem>
            <MenuItem value="pt-PT">Portuguese</MenuItem>
          </Select>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Upload Document" arrow>
              <IconButton component="label">
                <UploadFileIcon />
                <input
                  type="file"
                  hidden
                  accept=".pdf,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </IconButton>
            </Tooltip>
            <Button variant="contained" onClick={handleFileUpload} disabled={!file || isLoading}>
              Process Document
            </Button>
            <Tooltip title={isSpeaking ? 'Stop Reading Aloud' : 'Read Aloud'} arrow>
              <IconButton onClick={toggleSpeech}>
                {isSpeaking ? <VolumeUpIcon /> : <VolumeOffIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Export Chat History" arrow>
              <IconButton onClick={exportChatHistory}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Start New Chat" arrow>
              <IconButton onClick={handleNewChatClick}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', mb: 2 }} ref={chatContainerRef}>
          {chatMessages.map((msg) => (
            <Box key={msg.id} sx={{ textAlign: msg.sender === 'user' ? 'right' : 'left', mb: 2 }}>
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                </Box>
              )}
              {msg.tableData && msg.tableData.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        {Object.keys(msg.tableData[0]).map((key) => (
                          <th key={key} style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5', textAlign: 'left' }}>
                            {key.replace('_', ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.tableData.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value, valueIndex) => (
                            <td key={valueIndex} style={{ border: '1px solid #ddd', padding: '8px' }}>
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
          {isLoading && <Typography>Loading...</Typography>}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Ask about the knowledge base..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuerySubmit(); }}
          />
          <Tooltip title={isListening ? 'Listening...' : 'Click to Speak'}>
            <IconButton
              onClick={handleSpeechRecognition}
              sx={{
                bgcolor: isListening ? '#0080ff' : 'transparent',
                color: isListening ? 'white' : 'inherit',
                '&:hover': { bgcolor: isListening ? '#0070e0' : 'rgba(0, 0, 0, 0.04)' },
                ...(isListening && { animation: 'pulse 1.5s infinite', boxShadow: '0 0 5px rgba(0, 0, 255, 0.5)' }),
              }}
            >
              {isListening ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
          </Tooltip>
          <Button variant="contained" onClick={() => handleQuerySubmit()} disabled={isLoading}>
            Send
          </Button>
        </Box>
        <Box component="style" sx={{ '@keyframes pulse': { '0%': { boxShadow: '0 0 5px rgba(0, 0, 255, 0.5)' }, '50%': { boxShadow: '0 0 15px rgba(0, 0, 255, 1)' }, '100%': { boxShadow: '0 0 5px rgba(0, 0, 255, 0.5)' } } }} />
      </Card>

      <Box sx={{ flex: 1, p: 3, overflowY: 'auto', minWidth: { xs: 300, md: 400 }, width: '50%', bgcolor: '#f9f9f9', borderRadius: 1, height: '100vh' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>AI Chatbot Knowledge Base</Typography>
        <Box sx={{ borderBottom: '1px solid #ccc', mb: 2 }} />
        {knowledgeContent ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{knowledgeContent}</ReactMarkdown>
        ) : (
          <Typography variant="body2" sx={{ mb: 2 }}>Loading knowledge base content...</Typography>
        )}
      </Box>

      <Dialog open={openDialog} onClose={handleDialogClose} aria-labelledby="new-chat-dialog-title" aria-describedby="new-chat-dialog-description">
        <DialogTitle id="new-chat-dialog-title">Start a New Chat?</DialogTitle>
        <DialogContent>
          <DialogContentText id="new-chat-dialog-description">
            Would you like to export your current chat history before starting a new chat? If you don’t export it, the current history will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDialogConfirm(false)} color="primary">No, Clear Now</Button>
          <Button onClick={() => handleDialogConfirm(true)} color="primary" autoFocus>Yes, Export First</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
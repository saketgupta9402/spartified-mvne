import 'src/theme/styles/tableStyle.css';
import 'src/theme/styles/appStyle.css';

import axios from 'axios';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import React, { useRef, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, PieChart, Pie, Cell, Legend, TooltipProps, LineChart, Line, AreaChart, Area } from 'recharts';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MicIcon from '@mui/icons-material/Mic';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ClearIcon from '@mui/icons-material/Clear';
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

import config from 'src/config-global';
import labels from 'src/sections/locales/language.json';

import BarChartIcon from '@mui/icons-material/BarChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import LandscapeIcon from '@mui/icons-material/Landscape'; // Fallback for AreaChartIcon
// Note: If AreaChartIcon is available in your @mui/icons-material version, use:

import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LoadingComponent from '../loader/loader';

// Define types for SpeechRecognition
type SpeechRecognitionAlternativeType = {
  new(): {
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

interface DropZoneData {
  tableData: any[] | null;
}

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
  'top 3 accounts by usage': `${config.api_base_url}/top-accounts-usage`,
  'top 3 accounts by bill': `${config.api_base_url}/top-accounts-bill`,
};

const suggestedQuestions = [
  'Top 10 sims by bill',
  'Top rate plan by usage',
  'Top network by usage',
  'Total bill',
  'Total SIMs',
  'Billing summary',
  'Top 3 accounts by usage',
  'Top 3 accounts by bill',
];

const loadingMessages = [
  'We are analysing...',
  'Forming a query...',
  'Now retrieving data...',
  'Here is the response',
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4444'];

// Multilingual query prefixes
const queryPrefixes: { [lang: string]: string[] } = {
  eng: ['show me', 'show me the', 'can you show', 'could you find', 'tell me', 'get me', 'give me', 'please provide', 'i need'],
  spa: ['muéstrame', 'dime', 'puedes mostrar', 'encuentra', 'dame', 'por favor proporciona', 'necesito'],
  fra: ['montre-moi', 'dis-moi', 'peux-tu montrer', 'trouve', 'donne-moi', 'fournis-moi', 'j\'ai besoin'],
  deu: ['zeig mir', 'sag mir', 'kannst du zeigen', 'finde', 'gib mir', 'bitte gib', 'ich brauche'],
  por: ['mostra-me', 'diz-me', 'podes mostrar', 'encontra', 'dá-me', 'por favor fornece', 'preciso'],
};

// Language code mapping (ISO 639-1 for TTS)
const languageMap: { [key: string]: string } = {
  'en-US': 'en-US',
  'es-ES': 'es-ES',
  'fr-FR': 'fr-FR',
  'de-DE': 'de-DE',
  'pt-PT': 'pt-PT',
};

// Table response messages by language for TTS
const tableResponseMessages: { [lang: string]: string } = {
  'en-US': 'See the results in the table below.',
  'es-ES': 'Vea los resultados en la tabla a continuación.',
  'fr-FR': 'Voir les résultats dans le tableau ci-dessous.',
  'de-DE': 'Sieh dir die Ergebnisse in der Tabelle unten an.',
  'pt-PT': 'Veja os resultados na tabela abaixo.',
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const excludeKeys = new Set<string>([
    'fill', 'stroke', 'strokeWidth', 'payload', 'value', 'name', 'dataKey', 'cx', 'cy',
  ]);

  const allData = Object.entries(data)
    .filter(([key]) => !excludeKeys.has(key))
    .map(([key, value]) => ({
      key: key.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: typeof value === 'object' && value !== null ? JSON.stringify(value) : value ?? 'N/A',
    }));

  return (
    <Box sx={{ bgcolor: 'white', p: 1, border: '1px solid #ccc', borderRadius: 1, minWidth: 150 }}>
      {allData.length > 0 ? (
        allData.map(({ key, value }) => (
          <Typography key={key} variant="body2">
            {`${key}: ${value}`}
          </Typography>
        ))
      ) : (
        <Typography variant="body2" color="text.secondary">
          No data available
        </Typography>
      )}
    </Box>
  );
};

// Function to load voices and return a promise with ESLint suppression
// eslint-disable-next-line arrow-body-style
const loadVoices = () => {
  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        resolve(window.speechSynthesis.getVoices());
      };
    }
  });
};

// Function to speak text using SpeechSynthesis with corrected voice selection
const speakText = (text: string, isEnabled: boolean, lang: string) => {
  if (!isEnabled || !window.speechSynthesis || !text.trim()) {
    if (!window.speechSynthesis) console.error('SpeechSynthesis not supported in this browser.');
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  console.log('Available voices at speak time:', voices.map(v => ({ name: v.name, lang: v.lang })));

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  let matchingVoice: SpeechSynthesisVoice | undefined;

  // Special case for French: prefer 'Amélie (fr-CA)' if available
  if (lang === 'fr-FR') {
    matchingVoice = voices.find(voice => voice.name === 'Amélie' && voice.lang === 'fr-CA');
    if (!matchingVoice) {
      matchingVoice = voices.find(voice => voice.lang === 'fr-FR') ||
        voices.find(voice => voice.lang.startsWith('fr-'));
    }
  } else {
    // For all other languages, match exact language first, then prefix
    matchingVoice = voices.find(voice => voice.lang === lang) ||
      voices.find(voice => voice.lang.startsWith(lang.split('-')[0]));
  }

  if (matchingVoice) {
    utterance.voice = matchingVoice;
    console.log('Selected voice:', { name: matchingVoice.name, lang: matchingVoice.lang });
  } else {
    console.warn(`No voice found for language: ${lang}. Falling back to default.`);
    const fallbackVoice = voices.find(voice => voice.lang === 'en-US');
    if (fallbackVoice) {
      utterance.voice = fallbackVoice;
      utterance.lang = 'en-US';
      console.log('Falling back to:', { name: fallbackVoice.name, lang: 'en-US' });
    } else {
      console.error('No fallback voice available. TTS aborted.');
      return;
    }
  }

  utterance.rate = 1.0;
  utterance.volume = 1.0;
  utterance.onstart = () => console.log('Speech started:', { text, lang });
  utterance.onend = () => console.log('Speech finished:', { text, lang });
  utterance.onerror = (event) => console.error('SpeechSynthesis error:', event.error);

  console.log('Speaking:', { text, lang });
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  setTimeout(() => {
    if (!window.speechSynthesis.speaking) {
      console.warn('TTS completed but may not have been audible. Check system audio settings.');
    }
  }, text.length * 50 + 500);
};

export function AIChatbot() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const savedChat = sessionStorage.getItem('chatHistory');
    return savedChat ? JSON.parse(savedChat).map((msg: ChatMessage) => ({ ...msg, id: msg.id || uuidv4() })) : [];
  });
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [barChartData, setBarChartData] = useState<DropZoneData>({ tableData: null });
  const [pieChartData, setPieChartData] = useState<DropZoneData>({ tableData: null });
  const [lineChartData, setLineChartData] = useState<DropZoneData>({ tableData: null });
  const [areaChartData, setAreaChartData] = useState<DropZoneData>({ tableData: null });
  const [card1Data, setCard1Data] = useState<DropZoneData>({ tableData: null });
  const [card2Data, setCard2Data] = useState<DropZoneData>({ tableData: null });
  const [card3Data, setCard3Data] = useState<DropZoneData>({ tableData: null });
  const [card4Data, setCard4Data] = useState<DropZoneData>({ tableData: null });
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const barChartContainerRef = useRef<HTMLDivElement | null>(null);
  const pieChartContainerRef = useRef<HTMLDivElement | null>(null);
  const lineChartContainerRef = useRef<HTMLDivElement | null>(null);
  const areaChartContainerRef = useRef<HTMLDivElement | null>(null);
  const card1ContainerRef = useRef<HTMLDivElement | null>(null);
  const card2ContainerRef = useRef<HTMLDivElement | null>(null);
  const card3ContainerRef = useRef<HTMLDivElement | null>(null);
  const card4ContainerRef = useRef<HTMLDivElement | null>(null);
  const isSubmitted = useRef(false);

  const [barChartDimensions, setBarChartDimensions] = useState({ width: 300, height: 250 });
  const [pieChartDimensions, setPieChartDimensions] = useState({ width: 300, height: 250 });
  const [lineChartDimensions, setLineChartDimensions] = useState({ width: 300, height: 250 });
  const [areaChartDimensions, setAreaChartDimensions] = useState({ width: 300, height: 250 });

  const [barChartHovered, setBarChartHovered] = useState<boolean>(false);
  const [pieChartHovered, setPieChartHovered] = useState<boolean>(false);
  const [lineChartHovered, setLineChartHovered] = useState<boolean>(false);
  const [areaChartHovered, setAreaChartHovered] = useState<boolean>(false);

  const [card1Hovered, setCard1Hovered] = useState<boolean>(false);
  const [card2Hovered, setCard2Hovered] = useState<boolean>(false);
  const [card3Hovered, setCard3Hovered] = useState<boolean>(false);
  const [card4Hovered, setCard4Hovered] = useState<boolean>(false);

  useEffect(() => {
    loadVoices().then((voices) => {
      console.log('Voices preloaded successfully:', voices.map(v => ({ name: v.name, lang: v.lang })));
    }).catch((error) => {
      console.error('Failed to preload voices:', error);
    });
  }, []);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
    console.log('Chat messages updated:', chatMessages);
  }, [chatMessages]);

  useEffect(() => {
    sessionStorage.setItem('chatHistory', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    const updateDimensions = () => {
      const containerWidth = window.innerWidth;
      const containerHeight = window.innerHeight - 64;
      const chartWidth = (containerWidth * (isMinimized ? 0.92 : 0.5) - 32) / 2; // Divide by 2 for 50% width each

      if (barChartContainerRef.current) {
        const { height } = barChartContainerRef.current.getBoundingClientRect();
        setBarChartDimensions({
          width: Math.min(Math.max(chartWidth - 40, 150), 300),
          height: Math.min(Math.max(height - 60, 150), containerHeight * 0.45),
        });
      }
      if (pieChartContainerRef.current) {
        const { height } = pieChartContainerRef.current.getBoundingClientRect();
        setPieChartDimensions({
          width: Math.min(Math.max(chartWidth - 40, 150), 300),
          height: Math.min(Math.max(height - 60, 150), containerHeight * 0.45),
        });
      }
      if (lineChartContainerRef.current) {
        const { height } = lineChartContainerRef.current.getBoundingClientRect();
        setLineChartDimensions({
          width: Math.min(Math.max(chartWidth - 40, 150), 300),
          height: Math.min(Math.max(height - 60, 150), containerHeight * 0.45),
        });
      }
      if (areaChartContainerRef.current) {
        const { height } = areaChartContainerRef.current.getBoundingClientRect();
        setAreaChartDimensions({
          width: Math.min(Math.max(chartWidth - 40, 150), 300),
          height: Math.min(Math.max(height - 60, 150), containerHeight * 0.45),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [barChartData, pieChartData, lineChartData, areaChartData, isMinimized]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chatContainerRef.current) return;
    const startX = e.pageX - chatContainerRef.current.scrollLeft;
    const scrollLeft = chatContainerRef.current.scrollLeft;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.pageX - startX;
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollLeft = scrollLeft - x;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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

  const cleanQuery = (input: string, lang: string): string => {
    let query = input.toLowerCase().trim();
    const prefixes = queryPrefixes[lang.split('-')[0]] || queryPrefixes.eng;
    prefixes.forEach((prefix) => {
      if (query.startsWith(prefix)) {
        query = query.replace(prefix, '').trim();
      }
    });
    return query;
  };

  const findBestMatch = (input: string, inputLang: string): string | null => {
    const detectedLang = inputLang.split('-')[0];
    const cleanedInput = cleanQuery(input, detectedLang);
    return apiMappings[cleanedInput] || null;
  };

  const handleQuerySubmit = async (input: string): Promise<void> => {
    if (!input.trim()) return;

    const inputLang = selectedLanguage;
    const userMessage: ChatMessage = { sender: 'user', text: input, id: uuidv4() }; // Fixed line
    console.log('User query submitted:', input);
    setChatMessages((prev) => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const apiUrl = findBestMatch(input, inputLang);
      const botMessageId = uuidv4();

      if (apiUrl) {
        console.log('Fetching API response from:', apiUrl);
        const response = await axios.get(apiUrl);
        const botResponse = response.data;
        console.log('API response received:', botResponse);

        const botMessage: ChatMessage = {
          sender: 'bot',
          text: typeof botResponse === 'string' ? botResponse : undefined,
          tableData: Array.isArray(botResponse) ? botResponse : undefined,
          id: botMessageId,
        };
        setChatMessages((prev) => [...prev, botMessage]);
        console.log('API bot message added:', botMessage);

        const audioText = typeof botResponse === 'string' ? botResponse : tableResponseMessages[inputLang];
        if (isSpeaking) {
          speakText(audioText, isSpeaking, inputLang);
        }
      } else {
        console.log('Starting stream for query:', input);
        const botMessage: ChatMessage = { sender: 'bot', text: '', id: botMessageId };
        setChatMessages((prev) => [...prev, botMessage]);

        const response = await fetch(`${config.api_base_url}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: input,
            history: chatMessages.map((msg) => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text || (msg.tableData ? JSON.stringify(msg.tableData) : ''),
            })),
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body from server.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';

        const processStream = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            console.log('Stream completed, final text:', accumulatedText);
            try {
              const parsed = JSON.parse(accumulatedText);
              if (Array.isArray(parsed)) {
                console.log('Parsed as table data:', parsed);
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId ? { ...msg, text: undefined, tableData: parsed } : msg
                  )
                );
                if (isSpeaking) {
                  speakText(tableResponseMessages[inputLang], isSpeaking, inputLang);
                }
              } else {
                console.log('Parsed as text:', accumulatedText);
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === botMessageId ? { ...msg, text: accumulatedText } : msg
                  )
                );
                if (isSpeaking) {
                  speakText(accumulatedText, isSpeaking, inputLang);
                }
              }
            } catch (error) {
              console.log('Treated as text (non-JSON):', accumulatedText);
              setChatMessages((prev) =>
                prev.map((msg) =>
                  msg.id === botMessageId ? { ...msg, text: accumulatedText } : msg
                )
              );
              if (isSpeaking) {
                speakText(accumulatedText, isSpeaking, inputLang);
              }
            }
            return;
          }

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          console.log('Stream chunk received:', chunk);
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId ? { ...msg, text: accumulatedText } : msg
            )
          );

          await processStream();
        };

        await processStream();
      }
    } catch (error) {
      const errorMsg = 'An error occurred. Please try again.';
      console.error('Error in handleQuerySubmit:', error);
      setChatMessages((prev) => [
        ...prev,
        { sender: 'bot', text: errorMsg, id: uuidv4() },
      ]);
      if (isSpeaking) {
        speakText(errorMsg, isSpeaking, inputLang);
      }
    } finally {
      setIsLoading(false);
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
      .join('\n');

    const blob = new Blob([chatHistory], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_history.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, msg: ChatMessage) => {
    if (msg.tableData) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: msg.id, tableData: msg.tableData }));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'bar' | 'pie' | 'line' | 'area' | 'card1' | 'card2' | 'card3' | 'card4') => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (data.tableData) {
      switch (type) {
        case 'bar':
          setBarChartData({ tableData: data.tableData });
          break;
        case 'pie':
          setPieChartData({ tableData: data.tableData });
          break;
        case 'line':
          setLineChartData({ tableData: data.tableData });
          break;
        case 'area':
          setAreaChartData({ tableData: data.tableData });
          break;
        case 'card1':
          setCard1Data({ tableData: data.tableData });
          break;
        case 'card2':
          setCard2Data({ tableData: data.tableData });
          break;
        case 'card3':
          setCard3Data({ tableData: data.tableData });
          break;
        case 'card4':
          setCard4Data({ tableData: data.tableData });
          break;
        default:
          break;
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleNewChat = () => {
    setChatMessages([]);
    setBarChartData({ tableData: null });
    setPieChartData({ tableData: null });
    setLineChartData({ tableData: null });
    setAreaChartData({ tableData: null });
    setCard1Data({ tableData: null });
    setCard2Data({ tableData: null });
    setCard3Data({ tableData: null });
    setCard4Data({ tableData: null });
    window.speechSynthesis.cancel();
    sessionStorage.removeItem('chatHistory');
  };

  const handleNewChatClick = () => {
    if (chatMessages.length > 0) {
      setOpenDialog(true);
    } else {
      handleNewChat();
    }
  };

  const handleDialogConfirm = (exportFirst: boolean) => {
    if (exportFirst) exportChatHistory();
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

  const hasChatStarted = chatMessages.some((msg) => msg.sender === 'user');

  const toggleMinimize = () => {
    setIsMinimized((prev) => {
      console.log('isMinimized toggling to:', !prev);
      return !prev;
    });
  };

  const getChartKeys = (data: any[]) => {
    if (!data || data.length === 0) return { nameKey: '', valueKey: '' };

    const keys = Object.keys(data[0]);
    const hasUniqueValues = (key: string) => new Set(data.map(row => row[key])).size > 1;

    // Prioritize 'Account Name' or similar string-based keys for nameKey
    const nameKey = keys.find(key =>
      (key.toLowerCase().includes('account_name') ||
        key.toLowerCase().includes('account') ||
        key.toLowerCase().includes('name')) &&
      hasUniqueValues(key) &&
      typeof data[0][key] === 'string'
    ) || keys.find(key => typeof data[0][key] === 'string' && hasUniqueValues(key)) || keys[0];

    // Prioritize numeric fields like 'Total Bill ($)' or 'number of_sims' for valueKey
    const valueKey = keys.find(key =>
      (key.toLowerCase().includes('bill') ||
        key.toLowerCase().includes('usage') ||
        key.toLowerCase().includes('number') ||
        key.toLowerCase().includes('count')) &&
      hasUniqueValues(key) &&
      typeof data[0][key] === 'number'
    ) || keys.find(key => typeof data[0][key] === 'number' && hasUniqueValues(key)) || keys[1] || keys[0];

    // Ensure nameKey and valueKey are different
    if (nameKey === valueKey) {
      const otherKeys = keys.filter(k => k !== nameKey);
      const fallbackValueKey = otherKeys.find(key =>
        (typeof data[0][key] === 'number' || key.toLowerCase().includes('bill')) && hasUniqueValues(key)
      ) || otherKeys[0] || nameKey;
      console.log(`getChartKeys: nameKey=${nameKey}, valueKey=${fallbackValueKey}`);
      return { nameKey, valueKey: fallbackValueKey };
    }

    console.log(`getChartKeys: nameKey=${nameKey}, valueKey=${valueKey}`);
    return { nameKey, valueKey };
  };

  const getCardData = (data: any[] | null) => {
    if (!data || data.length === 0) return { figure: '', description: '' };

    const keys = Object.keys(data[0]);
    const descriptionKey = keys[0]; // Use the first key as the heading
    const figure = data[0][descriptionKey] !== undefined ? data[0][descriptionKey].toString() : 'N/A';
    const description = labels.labels[descriptionKey as keyof typeof labels.labels] || descriptionKey.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

    return { figure, description };
  };

  const clearCard1Data = () => setCard1Data({ tableData: null });
  const clearCard2Data = () => setCard2Data({ tableData: null });
  const clearCard3Data = () => setCard3Data({ tableData: null });
  const clearCard4Data = () => setCard4Data({ tableData: null });
  const clearBarChartData = () => setBarChartData({ tableData: null });
  const clearPieChartData = () => setPieChartData({ tableData: null });
  const clearLineChartData = () => setLineChartData({ tableData: null });
  const clearAreaChartData = () => setAreaChartData({ tableData: null });

  return (
    <Box sx={{ display: 'flex', height: '100vh', p: 2, gap: 2, flexWrap: 'nowrap' }}>
      <Card
        sx={{
          flex: 1,
          p: isMinimized ? 1 : 3,
          display: 'flex',
          flexDirection: 'column',
          minWidth: isMinimized ? 40 : { xs: 300, md: 400 },
          width: isMinimized ? '40px' : '50%',
          transition: 'width 0.3s ease, padding 0.3s ease, min-width 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease',
          overflowY: 'auto',
          bgcolor: isMinimized ? 'rgba(255, 255, 255, 0.9)' : 'background.paper',
          boxShadow: isMinimized ? '0 4px 8px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
          borderRight: isMinimized ? '1px solid rgba(0, 0, 0, 0.12)' : 'none',
          '&:hover': isMinimized ? { bgcolor: 'rgba(255, 255, 255, 1)', boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)' } : {},
        }}
      >
        <Box sx={{
          display: 'flex',
          flexDirection: isMinimized ? 'column' : 'row',
          justifyContent: isMinimized ? 'center' : 'space-between',
          alignItems: 'center',
          mb: isMinimized ? 0 : 2,
          minHeight: isMinimized ? 120 : 40,
          height: isMinimized ? '100%' : 'auto',
          position: isMinimized ? 'relative' : 'static',
        }}>
          <Typography
            variant="h6"
            sx={{
              display: isMinimized ? 'block' : 'block',
              transform: isMinimized ? 'rotate(-90deg)' : 'none',
              position: isMinimized ? 'absolute' : 'static',
              bottom: isMinimized ? 8 : 'auto',
              whiteSpace: 'nowrap',
              color: isMinimized ? 'text.secondary' : 'text.primary',
              fontSize: isMinimized ? '0.8rem' : '1.25rem',
            }}
          >
            {isMinimized ? 'Chat' : 'Billing AI Chatbot'}
          </Typography>
          <Tooltip title={isMinimized ? 'Maximize Chatbot' : 'Minimize Chatbot'}>
            {isMinimized ? (
              <IconButton
                onClick={toggleMinimize}
                sx={{
                  transform: isMinimized ? 'scale(1.1)' : 'none',
                  '&:hover': isMinimized ? { bgcolor: 'action.hover', transform: 'scale(1.2)' } : {},
                  transition: 'transform 0.2s ease, background-color 0.2s ease',
                }}
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
            ) : (
              <IconButton onClick={toggleMinimize}>
                <ArrowBackIcon />
              </IconButton>
            )}
          </Tooltip>
        </Box>
        <Box sx={{ display: isMinimized ? 'none' : 'block' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
              /* position: 'sticky', */
              top: 0,
              zIndex: 1,
              bgcolor: 'background.paper',
              position: isMinimized ? 'absolute' : 'static',
              py: 1
            }}
          >
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
            <Box sx={{ display: 'flex', gap: 0 }}>
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
          <Box
            ref={chatContainerRef}
            sx={{
              flexGrow: 1,
              maxHeight: 'calc(100vh - 300px)',
              overflowY: 'auto',
              overflowX: 'auto',
              position: 'relative',
              cursor: 'grab',
              px: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: chatMessages.length === 0 ? 'center' : 'flex-start',
              alignItems: 'center',
            }}
            onMouseDown={handleMouseDown}
          >
            {!hasChatStarted && !isLoading && (
              <>
                <Typography variant="body2" sx={{ fontSize: '0.9rem', textAlign: 'center', mb: 2 }}>
                  Hello! I am the Billing AI Chatbot. I can help you with questions related to usage, billing, plans,
                  networks, and more. Select your language above for audio responses and try asking something like `Top 10 SIMs by bill` or use the suggested questions below!
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
                  {suggestedQuestions.map((question, index) => (
                    <Button key={index} variant="outlined" size="small" onClick={() => handleQuerySubmit(question)}>
                      {question}
                    </Button>
                  ))}
                </Box>
              </>
            )}
            {chatMessages.map((msg) => (
              <Box
                key={msg.id}
                sx={{ textAlign: msg.sender === 'user' ? 'right' : 'left', mb: 2, maxWidth: '100%', width: '100%' }}
              >
                {msg.text && (
                  <Box
                    sx={{
                      display: 'inline-block',
                      p: 2,
                      borderRadius: 1,
                      maxWidth: '80%',
                      bgcolor: msg.sender === 'user' ? '#e3f2fd' : '#f5f5f5',
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                  </Box>
                )}
                {msg.tableData && msg.tableData.length > 0 && (
                  <Box sx={{ mt: 2 }} draggable onDragStart={(e) => handleDragStart(e, msg)}>
                    <table className="table" style={{ userSelect: 'text' }}>
                      <thead>
                        <tr>
                          {Object.keys(msg.tableData[0]).map((key) => (
                            <th key={key}>{labels.labels[key as keyof typeof labels.labels] || key.replace('_', ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.tableData.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {Object.values(row).map((value, valueIndex) => (
                              <td key={valueIndex}>{typeof value === 'string' || typeof value === 'number' ? value : 'N/A'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                )}
              </Box>
            ))}
            <LoadingComponent isLoading={isLoading} loadingMessages={loadingMessages} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            {suggestedQuestions.map((question, index) => (
              <Button key={index} variant="outlined" size="small" onClick={() => handleQuerySubmit(question)}>
                {question}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField
              fullWidth
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask about usage, billing, plans, or networks..."
              onKeyDown={(e) => e.key === 'Enter' && handleQuerySubmit(userInput)}
              InputProps={{ sx: { fontSize: '0.9rem' } }}
            />
            <Tooltip title={isListening ? 'Listening...' : 'Click to Speak'}>
              <IconButton
                onClick={handleSpeechRecognition}
                sx={{ bgcolor: isListening ? '#0080ff' : 'transparent', color: isListening ? 'white' : 'inherit' }}
              >
                {isListening ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
            </Tooltip>
            <Button variant="contained" onClick={() => handleQuerySubmit(userInput)}>Send</Button>
          </Box>
        </Box>
      </Card>

      <Box sx={{
        flex: isMinimized ? 9 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: { xs: 300, md: 350 },
        width: isMinimized ? '92%' : '50%',
        transition: 'width 0.3s ease, flex 0.3s ease',
      }}>
        {/* Top Row: 4 Small Cards */}
        <Box sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: 2,
          width: '100%',
          mb: 2,
        }}>
          {[
            { ref: card1ContainerRef, data: card1Data, type: 'card1' as const, clearData: clearCard1Data, isHovered: card1Hovered, setHovered: setCard1Hovered },
            { ref: card2ContainerRef, data: card2Data, type: 'card2' as const, clearData: clearCard2Data, isHovered: card2Hovered, setHovered: setCard2Hovered },
            { ref: card3ContainerRef, data: card3Data, type: 'card3' as const, clearData: clearCard3Data, isHovered: card3Hovered, setHovered: setCard3Hovered },
            { ref: card4ContainerRef, data: card4Data, type: 'card4' as const, clearData: clearCard4Data, isHovered: card4Hovered, setHovered: setCard4Hovered },
          ].map(({ ref, data, type, clearData, isHovered, setHovered }, index) => (
            <Card
              key={index}
              ref={ref}
              sx={{
                flex: '1 1 25%',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0,
                height: 120,
                position: 'relative', // For positioning Clear button
              }}
              onDrop={(e) => handleDrop(e, type)}
              onDragOver={handleDragOver}
              onMouseEnter={() => setHovered(true)} // Add hover state
              onMouseLeave={() => setHovered(false)} // Add hover state
            >
              {data.tableData && (
                <IconButton
                  onClick={clearData}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    p: 0.5,
                    bgcolor: 'rgba(0, 0, 0, 0.05)',
                    '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.1)' },
                    visibility: isHovered ? 'visible' : 'hidden', // Show only on hover
                  }}
                >
                  <ClearIcon sx={{ fontSize: '1rem', color: '#6E6E73' }} />
                </IconButton>
              )}
              {data.tableData ? (
                <>
                  {(() => {
                    const { figure, description } = getCardData(data.tableData);
                    return (
                      <>
                        <Typography
                          variant="h4"
                          sx={{
                            fontWeight: 600,
                            fontSize: '1.5rem',
                            lineHeight: 1.2,
                          }}
                        >
                          {figure}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: '0.875rem',
                            color: '#6E6E73',
                            textAlign: 'center',
                            mt: 0.5,
                          }}
                        >
                          {description}
                        </Typography>
                      </>
                    );
                  })()}
                </>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.875rem',
                    color: '#6E6E73',
                    textAlign: 'center',
                  }}
                >
                  Drop a table here to display data
                </Typography>
              )}
            </Card>
          ))}
        </Box>

        {/* Bottom Row: 2x2 Grid of Charts */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, flex: 1, justifyContent: 'space-between' }}>
          <Card
            ref={barChartContainerRef}
            sx={{
              flex: '1 1 48%',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start', // ← KEY: allows content to expand
              overflow: 'visible',          // ← KEY: no clipping
              minHeight: 200,
              height: 'auto',               // ← Don't fix a height
              position: 'relative',
            }}
            onDrop={(e) => handleDrop(e, 'bar')}
            onDragOver={handleDragOver}
            onMouseEnter={() => setBarChartHovered(true)}
            onMouseLeave={() => setBarChartHovered(false)}
          >
            {barChartData.tableData && (
              <IconButton
                onClick={clearBarChartData}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  p: 0.5,
                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.1)' },
                  visibility: barChartHovered ? 'visible' : 'hidden',
                }}
              >
                <ClearIcon sx={{ fontSize: '1rem', color: '#6E6E73' }} />
              </IconButton>
            )}
            {!barChartData.tableData && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Tooltip title="Bar Chart">
                  <BarChartIcon
                    sx={{
                      fontSize: '1.5rem',
                      color: '#6E6E73',
                      '&:hover': {
                        color: '#0088FE',
                        transform: 'scale(1.2)',
                        transition: 'color 0.2s ease, transform 0.2s ease',
                      },
                    }}
                  />
                </Tooltip>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontSize: '0.875rem',
                    color: '#6E6E73',
                  }}
                >
                  Drop Table Here for Bar Chart
                </Typography>
              </Box>
            )}
            {barChartData.tableData && barChartDimensions.width > 0 && barChartDimensions.height > 0 ? (() => {
              const { nameKey, valueKey } = getChartKeys(barChartData.tableData);
              if (!nameKey || !valueKey) {
                return (
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.875rem', color: '#6E6E73', textAlign: 'center' }}
                  >
                    Invalid data for chart
                  </Typography>
                );
              }
              const xAxisTitle = nameKey.replace(/[_$]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const yAxisTitle = valueKey.replace(/[_$]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const margins = { top: 20, right: 20, bottom: 50, left: 60 };

              return (
                <BarChart
                  width={barChartDimensions.width}
                  height={barChartDimensions.height}
                  data={barChartData.tableData}
                  margin={margins}
                >
                  <XAxis dataKey={nameKey} tick={{ fontSize: 12, fill: '#000000' }} />
                  <text
                    x={barChartDimensions.width / 2}
                    y={barChartDimensions.height - 10}
                    textAnchor="middle"
                    fill="#6E6E73"
                    fontSize="12"
                  >
                    {xAxisTitle}
                  </text>
                  <YAxis width={50} tickMargin={5} tick={{ fontSize: 12, fill: '#000000' }} />
                  <text
                    x={20}
                    y={barChartDimensions.height / 2}
                    textAnchor="middle"
                    fill="#6E6E73"
                    transform={`rotate(-90, 20, ${barChartDimensions.height / 2})`}
                    fontSize="12"
                  >
                    {yAxisTitle}
                  </text>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey={valueKey}>
                    {barChartData.tableData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              );
            })() : null}
            {!barChartData.tableData && (
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  color: '#6E6E73',
                  textAlign: 'center',
                }}
              >
                Drag a table from the chat to visualize as a bar chart
              </Typography>
            )}
          </Card>

          <Card
            ref={pieChartContainerRef}
            sx={{
              flex: '1 1 48%',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start', // ← KEY: allows content to expand
              overflow: 'visible',          // ← KEY: no clipping
              minHeight: 200,
              height: 'auto',               // ← Don't fix a height
              position: 'relative',
            }}
            onDrop={(e) => handleDrop(e, 'pie')}
            onDragOver={handleDragOver}
            onMouseEnter={() => setPieChartHovered(true)}
            onMouseLeave={() => setPieChartHovered(false)}
          >
            {pieChartData.tableData && (
              <IconButton
                onClick={clearPieChartData}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  p: 0.5,
                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.1)' },
                  visibility: pieChartHovered ? 'visible' : 'hidden',
                }}
              >
                <ClearIcon sx={{ fontSize: '1rem', color: '#6E6E73' }} />
              </IconButton>
            )}
            {!pieChartData.tableData && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Tooltip title="Pie Chart">
                  <PieChartIcon
                    sx={{
                      fontSize: '1.5rem',
                      color: '#6E6E73',
                      '&:hover': {
                        color: '#00C49F',
                        transform: 'scale(1.2)',
                        transition: 'color 0.2s ease, transform 0.2s ease',
                      },
                    }}
                  />
                </Tooltip>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontSize: '0.875rem',
                    color: '#6E6E73',
                  }}
                >
                  Drop Table Here for Pie Chart
                </Typography>
              </Box>
            )}
            {pieChartData.tableData && pieChartDimensions.width > 0 && pieChartDimensions.height > 0 ? (() => {
              const { nameKey, valueKey } = getChartKeys(pieChartData.tableData);
              if (!nameKey || !valueKey) {
                return (
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.875rem', color: '#6E6E73', textAlign: 'center' }}
                  >
                    Invalid data for chart
                  </Typography>
                );
              }
              const maxRadius = Math.min(pieChartDimensions.width, pieChartDimensions.height) * 0.3;

              return (
                <PieChart width={pieChartDimensions.width} height={pieChartDimensions.height}>
                  <Pie
                    data={pieChartData.tableData}
                    dataKey={valueKey}
                    nameKey={nameKey}
                    cx="50%"
                    cy="50%"
                    outerRadius={maxRadius}
                    label={{ fontSize: 12, fill: '#000000' }}
                    paddingAngle={5}
                  >
                    {pieChartData.tableData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ padding: 15, fontSize: '12px', color: '#000000' }} />
                </PieChart>
              );
            })() : null}
            {!pieChartData.tableData && (
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  color: '#6E6E73',
                  textAlign: 'center',
                }}
              >
                Drag a table from the chat to visualize as a pie chart
              </Typography>
            )}
          </Card>

          <Card
            ref={lineChartContainerRef}
            sx={{
              flex: '1 1 48%',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start', // ← KEY: allows content to expand
              overflow: 'visible',          // ← KEY: no clipping
              minHeight: 200,
              height: 'auto',               // ← Don't fix a height
              position: 'relative',
            }}
            onDrop={(e) => handleDrop(e, 'line')}
            onDragOver={handleDragOver}
            onMouseEnter={() => setLineChartHovered(true)}
            onMouseLeave={() => setLineChartHovered(false)}
          >
            {lineChartData.tableData && (
              <IconButton
                onClick={clearLineChartData}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  p: 0.5,
                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.1)' },
                  visibility: lineChartHovered ? 'visible' : 'hidden',
                }}
              >
                <ClearIcon sx={{ fontSize: '1rem', color: '#6E6E73' }} />
              </IconButton>
            )}
            {!lineChartData.tableData && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Tooltip title="Line Chart">
                  <ShowChartIcon
                    sx={{
                      fontSize: '1.5rem',
                      color: '#6E6E73',
                      '&:hover': {
                        color: '#FFBB28',
                        transform: 'scale(1.2)',
                        transition: 'color 0.2s ease, transform 0.2s ease',
                      },
                    }}
                  />
                </Tooltip>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontSize: '0.875rem',
                    color: '#6E6E73',
                  }}
                >
                  Drop Table Here for Line Chart
                </Typography>
              </Box>
            )}
            {lineChartData.tableData && lineChartDimensions.width > 0 && lineChartDimensions.height > 0 ? (() => {
              const { nameKey, valueKey } = getChartKeys(lineChartData.tableData);
              if (!nameKey || !valueKey) {
                return (
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.875rem', color: '#6E6E73', textAlign: 'center' }}
                  >
                    Invalid data for chart
                  </Typography>
                );
              }
              const xAxisTitle = nameKey.replace(/[_$]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const yAxisTitle = valueKey.replace(/[_$]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const margins = { top: 20, right: 20, bottom: 50, left: 60 };

              return (
                <LineChart
                  width={lineChartDimensions.width}
                  height={lineChartDimensions.height}
                  data={lineChartData.tableData}
                  margin={margins}
                >
                  <XAxis dataKey={nameKey} tick={{ fontSize: 12, fill: '#000000' }} />
                  <text
                    x={lineChartDimensions.width / 2}
                    y={lineChartDimensions.height - 10}
                    textAnchor="middle"
                    fill="#6E6E73"
                    fontSize="12"
                  >
                    {xAxisTitle}
                  </text>
                  <YAxis width={50} tickMargin={5} tick={{ fontSize: 12, fill: '#000000' }} />
                  <text
                    x={20}
                    y={lineChartDimensions.height / 2}
                    textAnchor="middle"
                    fill="#6E6E73"
                    transform={`rotate(-90, 20, ${lineChartDimensions.height / 2})`}
                    fontSize="12"
                  >
                    {yAxisTitle}
                  </text>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey={valueKey} stroke={COLORS[0]} strokeWidth={2} />
                </LineChart>
              );
            })() : null}
            {!lineChartData.tableData && (
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  color: '#6E6E73',
                  textAlign: 'center',
                }}
              >
                Drag a table from the chat to visualize as a line chart
              </Typography>
            )}
          </Card>

          <Card
            ref={areaChartContainerRef}
            sx={{
              flex: '1 1 48%',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start', // ← KEY: allows content to expand
              overflow: 'visible',          // ← KEY: no clipping
              minHeight: 200,
              height: 'auto',               // ← Don't fix a height
              position: 'relative',
            }}
            onDrop={(e) => handleDrop(e, 'area')}
            onDragOver={handleDragOver}
            onMouseEnter={() => setAreaChartHovered(true)}
            onMouseLeave={() => setAreaChartHovered(false)}
          >
            {areaChartData.tableData && (
              <IconButton
                onClick={clearAreaChartData}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  p: 0.5,
                  bgcolor: 'rgba(0, 0, 0, 0.05)',
                  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.1)' },
                  visibility: areaChartHovered ? 'visible' : 'hidden',
                }}
              >
                <ClearIcon sx={{ fontSize: '1rem', color: '#6E6E73' }} />
              </IconButton>
            )}
            {!areaChartData.tableData && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Tooltip title="Area Chart">
                  <LandscapeIcon
                    sx={{
                      fontSize: '1.5rem',
                      color: '#6E6E73',
                      '&:hover': {
                        color: '#FF8042',
                        transform: 'scale(1.2)',
                        transition: 'color 0.2s ease, transform 0.2s ease',
                      },
                    }}
                  />
                </Tooltip>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontSize: '0.875rem',
                    color: '#6E6E73',
                  }}
                >
                  Drop Table Here for Area Chart
                </Typography>
              </Box>
            )}
            {areaChartData.tableData && areaChartDimensions.width > 0 && areaChartDimensions.height > 0 ? (() => {
              const { nameKey, valueKey } = getChartKeys(areaChartData.tableData);
              if (!nameKey || !valueKey) {
                return (
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.875rem', color: '#6E6E73', textAlign: 'center' }}
                  >
                    Invalid data for chart
                  </Typography>
                );
              }
              const xAxisTitle = nameKey.replace(/[_$]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const yAxisTitle = valueKey.replace(/[_$]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const margins = { top: 20, right: 20, bottom: 50, left: 60 };

              return (
                <AreaChart
                  width={areaChartDimensions.width}
                  height={areaChartDimensions.height}
                  data={areaChartData.tableData}
                  margin={margins}
                >
                  <XAxis dataKey={nameKey} tick={{ fontSize: 12, fill: '#000000' }} />
                  <text
                    x={areaChartDimensions.width / 2}
                    y={areaChartDimensions.height - 10}
                    textAnchor="middle"
                    fill="#6E6E73"
                    fontSize="12"
                  >
                    {xAxisTitle}
                  </text>
                  <YAxis width={50} tickMargin={5} tick={{ fontSize: 12, fill: '#000000' }} />
                  <text
                    x={20}
                    y={areaChartDimensions.height / 2}
                    textAnchor="middle"
                    fill="#6E6E73"
                    transform={`rotate(-90, 20, ${areaChartDimensions.height / 2})`}
                    fontSize="12"
                  >
                    {yAxisTitle}
                  </text>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={valueKey}
                    stroke={COLORS[0]}
                    fill={COLORS[0]}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              );
            })() : null}
            {!areaChartData.tableData && (
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  color: '#6E6E73',
                  textAlign: 'center',
                }}
              >
                Drag a table from the chat to visualize as an area chart
              </Typography>
            )}
          </Card>
        </Box>
      </Box>

      <Dialog open={openDialog} onClose={handleDialogClose}>
        <DialogTitle>Start a New Chat?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.9rem' }}>
            Would you like to export your current chat history before starting a new chat? If you don’t export it, the current history will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDialogConfirm(false)} color="primary" size="small">No, Clear Now</Button>
          <Button onClick={() => handleDialogConfirm(true)} color="primary" size="small" autoFocus>Yes, Export First</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

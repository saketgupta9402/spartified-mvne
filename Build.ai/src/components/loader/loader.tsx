import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';

// Define the prop types
interface LoadingComponentProps {
  isLoading: boolean;
  loadingMessages: string[]; // Array of loading messages
}

const LoadingComponent: React.FC<LoadingComponentProps> = ({ isLoading, loadingMessages }) => {
  const [currentMessage, setCurrentMessage] = useState(loadingMessages[0]);

  useEffect(() => {
    if (isLoading) {
      const messageTimeouts: NodeJS.Timeout[] = [];
      
      loadingMessages.forEach((message, index) => {
        const timeout = setTimeout(() => setCurrentMessage(message), index * 3000);
        messageTimeouts.push(timeout);
      });
      return () => {
        messageTimeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
    return () => {}
  }, [isLoading, loadingMessages]);

  return (
    isLoading && (
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <div className="spinner-container">
          <div className="spinner-circle spinner-1"/>
          <div className="spinner-circle spinner-2"/>
          <div className="spinner-circle spinner-3"/>
        </div>
        <Typography variant="body1" sx={{ mt: 2 }}>
          {currentMessage}
        </Typography>
      </Box>
    )
  );
}

export default LoadingComponent;

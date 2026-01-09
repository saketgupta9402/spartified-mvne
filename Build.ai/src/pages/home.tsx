// src/pages/home.tsx
import { Helmet } from 'react-helmet-async';
import { styled } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

import { CONFIG } from 'src/config-global';
import { OverviewAnalyticsView } from 'src/sections/overview/view'; // Adjust path as needed

// Styled container for the dashboard
const AppleContainer = styled(Box)(({ theme }) => ({
  backgroundColor: '#F5F5F7', // Light gray background
  minHeight: '100vh',
  padding: theme.spacing(2),
}));

// Styled Typography for headers
const AppleHeader = styled(Typography)(({ theme }) => ({
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontWeight: 600,
  color: '#1D1D1F', // Dark gray
  marginBottom: theme.spacing(2),
}));

export default function Page() {
  return (
    <>
      <Helmet>
        <title>{`Dashboard - ${CONFIG.appName}`}</title>
        <meta
          name="description"
          content="The starting point for your next project with Minimal UI Kit, built on the newest version of Material-UI ©, ready to be customized to your style"
        />
        <meta name="keywords" content="react,material,kit,application,dashboard,admin,template" />
      </Helmet>

      <AppleContainer>
        {/* <AppleHeader variant="h4">Dashboard</AppleHeader> */}
        <OverviewAnalyticsView />
      </AppleContainer>
    </>
  );
}

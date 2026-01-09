import { useLocation } from 'react-router-dom';

import HomeIcon from '@mui/icons-material/Home';
import { Button, Toolbar, useTheme } from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { Loyalty, Assistant, Inventory, Villa, Money } from '@mui/icons-material';

import { LayoutSection } from 'src/layouts/core/layout-section';

export function NavigationPopover() {
  const location = useLocation();
  const theme = useTheme(); // Access theme values

  const getButtonStyles = (path: string) => ({
    backgroundColor: location.pathname === path ? theme.palette.action.hover : 'transparent',
    color: theme.palette.text.primary, // Keep text and icon color black
    borderRadius: theme.shape.borderRadius,
    fontWeight: location.pathname === path ? 'bold' : 'normal', // Bold when selected
    transition: 'background-color 0.3s ease', // Smooth transition
    '&:hover': {
      backgroundColor: theme.palette.action.hover, // Apply the same hover effect for consistency
    },
    '& .MuiSvgIcon-root': {
      fontWeight: location.pathname === path ? 'bold' : 'normal', // Bold icon when selected
    },
  });

  return (
    <LayoutSection>
      <Toolbar>
        <Button href="/" startIcon={<HomeIcon />} sx={getButtonStyles('/')}>
          Dashboard
        </Button>
        &nbsp;
        <Button href="/analytics" startIcon={<AnalyticsIcon />} sx={getButtonStyles('/analytics')}>
          Billing Analytics
        </Button>
        &nbsp;
        <Button href="/accounts" startIcon={<Villa />} sx={getButtonStyles('/accounts')}>
          Onboarding
        </Button>
        <Button href="/rate-plan" startIcon={<Money />} sx={getButtonStyles('/rate-plan')}>
          Rate Plans
        </Button>
        &nbsp;
        <Button href="/wholesale" startIcon={<Loyalty />} sx={getButtonStyles('/wholesale')}>
          Wholesale
        </Button>
        &nbsp;
        <Button href="/chatbot" startIcon={<Assistant />} sx={getButtonStyles('/chatbot')}>
          Chatbot AI
        </Button>
        &nbsp;
        <Button href="/knowledge-base" startIcon={<Inventory />} sx={getButtonStyles('/knowledge-base')}>
          KnowledgeBase
        </Button>
        &nbsp;
      </Toolbar>
    </LayoutSection>
  );
}
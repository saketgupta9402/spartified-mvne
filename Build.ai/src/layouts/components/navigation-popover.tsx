import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import HomeIcon from '@mui/icons-material/Home';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import {
  Button,
  Toolbar,
  useTheme,
  Menu,
  MenuItem,
} from '@mui/material';
import { Loyalty, Assistant, Inventory, Villa, Money } from '@mui/icons-material';

import { LayoutSection } from 'src/layouts/core/layout-section';

import { useNavigationContext } from './navigation-context';

// ----------------------------------------------------------------------

type TabItem = {
  title: string;
  path: string;
  icon: React.ReactElement;
};

const TABS: TabItem[] = [
  { title: 'Dashboard', path: '/', icon: <HomeIcon /> },
  { title: 'Billing Analytics', path: '/analytics', icon: <AnalyticsIcon /> },
  { title: 'Onboarding', path: '/accounts', icon: <Villa /> },
  { title: 'Rate Plans', path: '/rate-plan', icon: <Money /> },
  { title: 'Wholesale', path: '/wholesale', icon: <Loyalty /> },
  { title: 'Chatbot AI', path: '/chatbot', icon: <Assistant /> },
  { title: 'KnowledgeBase', path: '/knowledge-base', icon: <Inventory /> },
];

export function NavigationPopover() {
  const location = useLocation();
  const theme = useTheme();
  const { hiddenTabs, hideTab } = useNavigationContext();

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    tabTitle: string;
  } | null>(null);

  const handleContextMenu = (event: React.MouseEvent, title: string) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
          mouseX: event.clientX + 2,
          mouseY: event.clientY - 6,
          tabTitle: title,
        }
        : null
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleHideTab = () => {
    if (contextMenu) {
      hideTab(contextMenu.tabTitle);
      handleCloseContextMenu();
    }
  };

  const getButtonStyles = (path: string) => ({
    backgroundColor: location.pathname === path ? theme.palette.action.hover : 'transparent',
    color: theme.palette.text.primary,
    borderRadius: theme.shape.borderRadius,
    fontWeight: location.pathname === path ? 'bold' : 'normal',
    transition: 'background-color 0.3s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '& .MuiSvgIcon-root': {
      fontWeight: location.pathname === path ? 'bold' : 'normal',
    },
  });

  const visibleTabs = TABS.filter((tab) => !hiddenTabs.includes(tab.title));

  return (
    <LayoutSection>
      <Toolbar>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {visibleTabs.map((tab) => (
            <Button
              key={tab.title}
              href={tab.path}
              startIcon={tab.icon}
              sx={getButtonStyles(tab.path)}
              onContextMenu={(e) => handleContextMenu(e, tab.title)}
            >
              {tab.title}
            </Button>
          ))}
        </div>

        {/* Right-click Context Menu */}
        <Menu
          open={contextMenu !== null}
          onClose={handleCloseContextMenu}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
          }
        >
          <MenuItem onClick={handleHideTab}>Hide Tab</MenuItem>
        </Menu>
      </Toolbar>
    </LayoutSection>
  );
}

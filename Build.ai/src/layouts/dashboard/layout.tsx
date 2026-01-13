import React, { useState } from 'react';
import type { Theme, SxProps, Breakpoint } from '@mui/material/styles';

import Box from '@mui/material/Box';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Button, Tooltip, IconButton, Menu, MenuItem, Typography } from '@mui/material';

import { _langs } from 'src/_mock';

import { Iconify } from 'src/components/iconify';

import { Main } from './main';
import { LayoutSection } from '../core/layout-section';
import { HeaderSection } from '../core/header-section';
import { AccountPopover } from '../components/account-popover';
import { LanguagePopover } from '../components/language-popover';
import { NavigationPopover } from '../components/navigation-popover';
import { useNavigationContext } from '../components/navigation-context';

// ----------------------------------------------------------------------

export type DashboardLayoutProps = {
  sx?: SxProps<Theme>;
  children: React.ReactNode;
  header?: {
    sx?: SxProps<Theme>;
  };
};

export function DashboardLayout({ sx, children, header }: DashboardLayoutProps) {
  const layoutQuery: Breakpoint = 'lg';

  const { hiddenTabs, showTab } = useNavigationContext();

  const [anchorElRestore, setAnchorElRestore] = useState<null | HTMLElement>(null);

  const handleOpenRestoreMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElRestore(event.currentTarget);
  };

  const handleCloseRestoreMenu = () => {
    setAnchorElRestore(null);
  };

  const handleRestoreTab = (title: string) => {
    showTab(title);
    if (hiddenTabs.length <= 1) {
      handleCloseRestoreMenu();
    }
  };

  return (
    <LayoutSection
      /** **************************************
       * First Header
       *************************************** */
      headerSection={
        <HeaderSection
          layoutQuery={layoutQuery}
          slotProps={{
            container: {
              maxWidth: false,
              sx: { px: { [layoutQuery]: 0 } },
            },
          }}
          sx={header?.sx}
          slots={{
            leftArea: (
              <Box gap={2} display="flex" alignItems="center">
                <Box
                  component="img"
                  src="/assets/icons/Logo.svg"
                  alt="Global Reach AI Logo"
                  sx={{
                    paddingLeft: 3,
                    height: 50,
                    width: 'auto',
                    objectFit: 'contain',
                    filter: 'brightness(1.1)',
                  }}
                />
                <Box
                  component="span"
                  sx={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    fontFamily:
                      '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: '#000000',
                    letterSpacing: '0.5px',
                  }}
                >
                  Insight AI
                </Box>
              </Box>
            ),
            rightArea: (
              <Box gap={1} display="flex" alignItems="center">
                {hiddenTabs.length > 0 && (
                  <>
                    <Tooltip title="Show Hidden Tabs">
                      <IconButton onClick={handleOpenRestoreMenu} color="primary">
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>

                    <Menu
                      anchorEl={anchorElRestore}
                      open={Boolean(anchorElRestore)}
                      onClose={handleCloseRestoreMenu}
                      PaperProps={{
                        sx: { width: 200, maxHeight: 300 },
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ p: 1.5, color: 'text.secondary' }}>
                        Hidden Tabs
                      </Typography>
                      {hiddenTabs.map((title) => (
                        <MenuItem key={title} onClick={() => handleRestoreTab(title)}>
                          {title}
                        </MenuItem>
                      ))}
                    </Menu>
                  </>
                )}

                <LanguagePopover data={_langs} />
                <AccountPopover
                  data={[
                    {
                      label: 'Home',
                      href: '/',
                      icon: <Iconify width={22} icon="solar:home-angle-bold-duotone" />,
                    },
                    {
                      label: 'Profile',
                      href: '#',
                      icon: <Iconify width={22} icon="solar:shield-keyhole-bold-duotone" />,
                    },
                    {
                      label: 'Settings',
                      href: '#',
                      icon: <Iconify width={22} icon="solar:settings-bold-duotone" />,
                    },
                  ]}
                />
              </Box>
            ),
          }}
        />
      }
      navigationSection={
        <HeaderSection
          layoutQuery={layoutQuery}
          slotProps={{
            container: {
              maxWidth: false,
              sx: { px: { [layoutQuery]: 0 } },
            },
          }}
          sx={header?.sx}
          slots={{
            leftArea: (
              <Box>
                <NavigationPopover />
              </Box>
            ),
          }}
        />
      }
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        ...sx,
      }}
    >
      <Main style={{ flex: 1 }}>{children}</Main>
    </LayoutSection>
  );
}

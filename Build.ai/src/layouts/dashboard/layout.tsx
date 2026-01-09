import type { Theme, SxProps, Breakpoint } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { _langs } from 'src/_mock'; // Moved up to comply with import/order
import { Iconify } from 'src/components/iconify';
import { Button } from '@mui/material';
import { Inventory } from '@mui/icons-material';
import { Main } from './main';
import { LayoutSection } from '../core/layout-section';
import { HeaderSection } from '../core/header-section';
import { AccountPopover } from '../components/account-popover';
import { LanguagePopover } from '../components/language-popover';
import { NavigationPopover } from '../components/navigation-popover';

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

  function getButtonStyles(arg0: string): SxProps<Theme> | undefined {
    throw new Error('Function not implemented.');
  }

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
                {/* Logo with increased size and clarity */}
                <Box
                  component="img"
                  src="/assets/icons/Logo.svg" // Replace with your logo path
                  alt="Global Reach AI Logo"
                  sx={{
                    paddingLeft: 3,
                    height: 50, // Keeping existing size
                    width: 'auto',
                    objectFit: 'contain', // Ensures logo scales properly
                    filter: 'brightness(1.1)', // Slight brightness boost for clarity
                  }}
                />
                {/* Text "Global Reach AI" styled professionally */}
                <Box
                  component="span"
                  sx={{
                    fontSize: '2rem', // Keeping existing font size
                    fontWeight: 'bold', // Keeping bold
                    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', // Keeping font family
                    color: '#000000', // Keeping black color
                    letterSpacing: '0.5px', // Keeping spacing
                    // textTransform: 'uppercase', // Keeping uppercase
                  }}
                >
                  Insight AI
                </Box>
                {/* Text "Powered by" styled professionally */}
                {/* <Box
                  component="span"
                  sx={{
                    paddingTop: 1,
                    fontSize: '0.8rem', // Keeping existing font size
                    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', // Keeping font family
                    color: '#000000', // Keeping black color
                    letterSpacing: '0.5px', // Keeping spacing
                    // textTransform: 'uppercase', // Keeping uppercase
                  }}
                >
                  powered by
                </Box> */}
                {/* Additional logo_spartified.png to the right */}
                {/* <Box
                  component="img"
                  src="logo_spartified.png" // Path to the new logo
                  alt="Spartified Logo"
                  sx={{
                    paddingTop: 1,
                    height: 35, // Matching the size of the first logo
                    width: 'auto',
                    objectFit: 'contain', // Ensures logo scales properly
                    filter: 'brightness(1.1)', // Consistent brightness boost
                  }}
                /> */}
              </Box>
            ),
            rightArea: (
              <Box gap={1} display="flex" alignItems="center">
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
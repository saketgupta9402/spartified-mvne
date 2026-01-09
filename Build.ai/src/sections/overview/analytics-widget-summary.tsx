// src/sections/overview/analytics-widget-summary.tsx
import type { CardProps } from '@mui/material/Card';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { fShortenNumber, fPercent } from 'src/utils/format-number'; // Added fPercent for percentages
import { Iconify } from 'src/components/iconify'; // For trend icons

type Props = CardProps & {
  title: string;
  total: number;
  subtitle: string; // Prop for the subtitle (e.g., "This Month")
  percent?: number; // Optional prop for trend percentage (for SIMs, Accounts, and CDRs)
  sx?: object; // Keep sx for flexibility
};

export function AnalyticsWidgetSummary({ title, total, subtitle, percent, sx, ...other }: Props) {
  const renderTrending = percent !== undefined && (
    <Box
      sx={{
        mt: 0.5, // Add margin above trend for spacing
        gap: 0.5,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Iconify
        width={16} // Smaller icon size for compactness
        icon={percent < 0 ? 'eva:trending-down-fill' : 'eva:trending-up-fill'}
        sx={{ color: '#0071E3' }} // Apple blue for trend icon
      />
      <Typography
        variant="caption"
        sx={{
          fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#0071E3', // Apple blue for trend text
        }}
      >
        {percent > 0 && '+'}{fPercent(percent)}
      </Typography>
    </Box>
  );

  return (
    <Card
      sx={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px', // Slightly more rounded corners
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)', // Subtle shadow
        p: 2, // Reduced padding for compactness
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start', // Left-aligned as per previous request
        minHeight: 120, // Increased height to accommodate trend
        ...sx,
      }}
      {...other}
    >
      <Box sx={{ textAlign: 'left', width: '100%' }}>
        <Typography
          variant="h2" // Large figure size
          sx={{
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: 700,
            color: '#000000',
            mb: 0.5, // Reduced margin for compactness
            lineHeight: 1.2, // Ensure taller text fits nicely
          }}
        >
          {['Total Bill'].includes(title) ? `$${fShortenNumber(total)}` : fShortenNumber(total)}
        </Typography>
        <Typography
          variant="body1" // Same font size as title
          sx={{
            fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '1rem', // Explicitly set font size to match title
            color: '#6E6E73', // Gray for the subtitle (second line)
            mb: 0.5, // Reduced margin for compactness
          }}
        >
          {subtitle}
        </Typography>
        {/* {renderTrending} */}
        <Typography
          variant="body2" // Same font size as subtitle
          sx={{
            fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '1rem', // Explicitly set font size to match subtitle
            color: '#000000', // Black for the title (last line)
            fontWeight: 500,
          }}
        >
          {title}
        </Typography>
      </Box>
    </Card>
  );
}

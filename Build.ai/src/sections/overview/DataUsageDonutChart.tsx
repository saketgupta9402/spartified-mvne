import type { CardProps } from '@mui/material/Card';
import type { ChartOptions } from 'src/components/chart';

import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';
import Box from '@mui/material/Box';

import { fNumber } from 'src/utils/format-number';

import { Chart, useChart, ChartLegends } from 'src/components/chart';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title?: string;
  subheader?: string;
  chart: {
    colors?: string[];
    series: {
      label: string;
      value: number;
    }[];
    options?: ChartOptions;
  };
};

export function DataUsageDonutChart({ title, subheader, chart, ...other }: Props) {
  const theme = useTheme();

  const chartSeries = chart.series.map((item) => item.value);

  // Define a modern color palette
  const chartColors = chart.colors ?? [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF',
    '#62D96B', '#D162D9', '#F57C00', '#8E44AD', '#2ECC71', '#1ABC9C', '#E67E22',
  ];

  const chartOptions = useChart({
    chart: { sparkline: { enabled: true } },
    colors: chartColors,
    labels: chart.series.map((item) => item.label),
    stroke: { width: 0 },
    dataLabels: { 
      enabled: true, 
      dropShadow: { enabled: false },
      style: {
        fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeight: 600,
        colors: ['#FFFFFF'], // Changed to white
      },
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${fNumber(value)} GB`,
        title: { formatter: (seriesName: string) => `${seriesName} GB` },
      },
    },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            name: { 
              show: true,
              fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
              color: '#1D1D1F',
            },
            value: { 
              show: true, 
              formatter: (val: string) => `${fNumber(Number(val))} GB`,
              fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
              color: '#1D1D1F',
            },
            total: {
              show: true,
              label: 'Total',
              formatter: (w: any) => `${fNumber(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0))} GB`,
              fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
              color: '#1D1D1F',
            },
          },
        },
      },
    },
    ...chart.options,
  });

  return (
    <Card {...other}>
      <CardHeader
        title={title}
        subheader={subheader}
        titleTypographyProps={{
          sx: {
            fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: 600,
            color: '#1D1D1F',
          },
        }}
        subheaderTypographyProps={{
          sx: {
            fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '1rem', // Explicitly set font size to match title
            color: '#6E6E73',
          },
        }}
      />

      <Chart
        type="donut"
        series={chartSeries}
        options={chartOptions}
        width={{ xs: 240, xl: 260 }}
        height={{ xs: 240, xl: 260 }}
        sx={{ my: 3.5, mx: 'auto' }}
      />

      <Divider sx={{ borderStyle: 'dashed' }} />

      {/* Legends with Scrollbar */}
      <Box sx={{ p: 1 }}>
        <Box
          sx={{
            height: '40px', // Fixed height for consistency across all cases
            overflowY: 'auto', // Scrollbar appears when content exceeds height
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'transparent', // Default: scrollbar is subtle
              borderRadius: '4px',
            },
            '&:hover::-webkit-scrollbar-thumb': {
              backgroundColor: theme.palette.grey[500], // Highlight on hover
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'transparent',
            },
          }}
        >
          <ChartLegends
            labels={chartOptions?.labels}
            colors={chartOptions?.colors}
            sx={{
              justifyContent: 'center',
              '& .MuiTypography-root': { // Target the legend text
                fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontWeight: 600,
                color: '#1D1D1F',
              },
            }}
          />
        </Box>
      </Box>
    </Card>
  );
}

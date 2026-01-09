import type { CardProps } from '@mui/material/Card';
import type { ChartOptions } from 'src/components/chart';

import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';

import { fNumber } from 'src/utils/format-number';
import { Chart, useChart } from 'src/components/chart';

type Props = CardProps & {
  title?: string;
  subheader?: string;
  chart: {
    categories: string[];
    series: { name: string; data: number[] };
    options?: ChartOptions;
  };
};

export function UsageForAccounts({ title, subheader, chart, ...other }: Props) {
  const theme = useTheme();

  const chartColors = ['#9966FF'];

  const chartOptions = useChart({
    chart: { type: 'bar', sparkline: { enabled: false } },
    colors: chartColors,
    xaxis: {
      categories: chart.categories,
      title: {
        text: 'Months', // X-axis heading
        style: {
          fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          color: '#1D1D1F',
        },
      },
      labels: {
        style: {
          fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
          fontWeight: 400,
          colors: '#1D1D1F',
        },
      },
    },
    yaxis: {
      title: {
        text: 'Data Usage (GB)', // Y-axis heading with GB
        style: {
          fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          color: '#1D1D1F',
        },
      },
      labels: {
        formatter: (value: number) => `${fNumber(value)}`,
        style: {
          fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '14px',
          fontWeight: 400,
          colors: '#1D1D1F',
        },
      },
    },
    plotOptions: {
      bar: {
        columnWidth: '50%',
        borderRadius: 4,
      },
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${fNumber(value)} GB`,
        title: { formatter: (seriesName: string) => `${seriesName}: ` },
      },
    },
    ...chart.options,
  });

  return (
    <Card
      sx={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        },
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px',
        ...other.sx,
      }}
      {...other}
    >
      <CardHeader
        title={
          <Typography
            sx={{
              fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
              fontSize: '1.25rem',
              color: '#1D1D1F',
              marginBottom: 0,
            }}
          >
            {title}
          </Typography>
        }
        subheader={
          <Typography
            sx={{
              fontFamily: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '1rem', // Explicitly set font size to match title
              color: '#6E6E73',
              marginTop: '4px',
            }}
          >
            {subheader}
          </Typography>
        }
        sx={{ padding: '16px', paddingBottom: '8px' }}
      />

      <Chart
        type="bar"
        series={[chart.series]}
        options={chartOptions}
        width="100%"
        height={260}
        sx={{ my: 2, mx: 'auto' }}
      />
    </Card>
  );
}
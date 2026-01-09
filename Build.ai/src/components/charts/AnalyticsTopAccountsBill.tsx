import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import type { ApexOptions } from 'apexcharts';
import Chart from 'react-apexcharts';

type AnalyticsTopAccountsBillProps = {
  title: string;
  subheader: string;
  chart: {
    categories: string[];
    series: { name: string; data: number[] };
  };
};

export function AnalyticsTopAccountsBill({ title, subheader, chart }: AnalyticsTopAccountsBillProps) {
  const chartOptions: ApexOptions = {
    chart: {
      type: 'bar',
      height: 350,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '60%',
        borderRadius: 2,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent'],
    },
    xaxis: {
      categories: chart.categories,
      labels: {
        style: {
          colors: 'black',
          fontSize: '13.5px',
        },
      },
    },
    yaxis: {
      title: {
        text: 'Bill Amount ($)',
        style: {
          color: 'Grey',
          fontSize: '14px',
        },
      },
      labels: {
        style: {
          colors: 'black',
          fontSize: '12px',
        },
      },
    },
    fill: {
      opacity: 1,
      colors: ['#1E88E5', '#D32F2F', '#7B1FA2', '#1976D2', '#388E3C', '#FBC02D', '#F57C00', '#E64A19', '#5D4037', '#455A64'],
    },
    tooltip: {
      theme: 'light',
      x: {
        show: true,
        formatter: (val: number, opts?: any) => `Month: ${chart.categories[opts.dataPointIndex]}`,
      },
      y: {
        formatter: (val: number) => `$${val.toLocaleString()}`,
      },
      marker: {
        show: true,
      },
    },
    grid: {
      borderColor: '#e0e0e0',
    },
  };

  return (
    <Card sx={{ boxShadow: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: '#fff' }}>
      <CardContent>
        <Typography variant="h6" component="div">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {subheader}
        </Typography>
        <Chart options={chartOptions} series={[chart.series]} type="bar" height={350} />
      </CardContent>
    </Card>
  );
}
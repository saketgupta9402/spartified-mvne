import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CircularProgress, Grid } from '@mui/material';
import { styled } from '@mui/material/styles';
import { fetchMVNEDashboardData } from 'src/services/wholesaleService';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import BusinessIcon from '@mui/icons-material/Business';
import TuneIcon from '@mui/icons-material/Tune';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { green, red } from '@mui/material/colors';

const formatLabel = (label: string) => {
    if (!label) return 'N/A';
    return label
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const AppleCard = styled(Card)(({ theme }) => ({
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    '&:hover': {
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        transform: 'translateY(-2px)',
    },
    transition: 'all 0.2s ease-in-out',
    padding: theme.spacing(2.5),
}));

const StatCard = ({ title, value, change, color, icon: Icon }: { title: string; value: string | number; change: string | number; color: string; icon: any }) => {
    const isPositive = String(change).startsWith('+');
    return (
        <AppleCard sx={{ textAlign: 'left', position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                    <Typography variant="subtitle2" sx={{ color: '#6E6E73', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{title}</Typography>
                    <Typography variant="h4" sx={{ color: '#1D1D1F', fontWeight: 800, mt: 0.5, letterSpacing: '-0.02em' }}>{value}</Typography>
                </Box>
                <Box sx={{
                    backgroundColor: `${color}15`,
                    p: 1.5,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Icon sx={{ color, fontSize: 28 }} />
                </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', color: isPositive ? green[600] : red[600] }}>
                {isPositive ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                <Typography variant="body2" sx={{ ml: 0.5, fontWeight: 700 }}>{change} <Box component="span" sx={{ color: '#86868B', fontWeight: 400 }}>vs last month</Box></Typography>
            </Box>
        </AppleCard>
    );
};

const UsageBox = ({ title, value, series, color }: { title: string; value: string; series: any[]; color: string }) => {
    const options: ApexOptions = {
        chart: { type: 'bar', sparkline: { enabled: true } },
        plotOptions: { bar: { columnWidth: '80%' } },
        colors: [color],
        tooltip: { fixed: { enabled: false } }
    };
    return (
        <AppleCard sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ color: '#6E6E73', mb: 1 }}>{title} Usage</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>{value}</Typography>
                <Box sx={{ flexGrow: 1, height: 60 }}>
                    <Chart options={options} series={[{ data: series }]} type="bar" height={60} />
                </Box>
            </Box>
        </AppleCard>
    );
};

export const MVNEDashboard = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const result = await fetchMVNEDashboardData();
                setData(result);
            } catch (error) {
                console.error('Failed to load MVNE dashboard:', error);
            } finally {
                setLoading(false);
            }
        };
        loadDashboard();
    }, []);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    if (!data) return <Box sx={{ p: 3 }}><Typography>No dashboard data available.</Typography></Box>;

    // Cost Trend
    const costTrendOptions: ApexOptions = {
        chart: { type: 'line', toolbar: { show: false } },
        stroke: { curve: 'smooth', width: 3 },
        xaxis: { categories: data.costTrend.map((d: any) => d.year_month) },
        colors: ['#0071E3'],
        title: { text: 'Total Wholesale Cost Trend', style: { fontSize: '16px', fontWeight: 600 } }
    };

    // Porting Trend (Area)
    const portingTrendOptions: ApexOptions = {
        chart: { type: 'area', toolbar: { show: false }, stacked: true },
        xaxis: { categories: data.porting.map((d: any) => d.year_month) },
        colors: ['#0071E3', '#FF9500'],
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.6, opacityTo: 0.1 } },
        title: { text: 'Total Portins vs MNO last 4 Months', style: { fontSize: '14px', fontWeight: 600 } }
    };

    // Data Consumption Volume Trend
    const usageTrendOptions: ApexOptions = {
        chart: { type: 'area', toolbar: { show: false } },
        xaxis: { categories: data.usageDetail.map((d: any) => d.year_month) },
        colors: ['#0071E3', '#34C759', '#FF9500'],
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.1 } },
        title: { text: 'Monthly Data Consumption Volumes', style: { fontSize: '16px', fontWeight: 600 } },
        yaxis: [
            { title: { text: 'Data (GB)' }, labels: { formatter: (val) => `${val.toFixed(1)} GB` } },
            { opposite: true, title: { text: 'Voice (Min) / SMS (Count)' } }
        ]
    };

    const latestUsage = data.usageDetail[data.usageDetail.length - 1] || {};
    const voiceSeries = data.usageDetail.map((d: any) => d.voice_usage);
    const smsSeries = data.usageDetail.map((d: any) => d.sms_usage);
    const dataSeries = data.usageDetail.map((d: any) => d.data_usage);

    return (
        <Box sx={{ p: 0, backgroundColor: '#f5f5f5' }}>
            {/* KPI Row */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Month Cost"
                        value={`$${parseFloat(data.kpis.current_month_cost || 0).toLocaleString()}`}
                        change="+5.2%"
                        color="#0071E3"
                        icon={AccountBalanceWalletIcon}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Active Entities"
                        value={data.entityComparison.length}
                        change="+2"
                        color="#AF52DE"
                        icon={BusinessIcon}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Top Overage Service"
                        value={formatLabel(data.kpis.top_overage_service)}
                        change="+12%"
                        color="#FF9500"
                        icon={TuneIcon}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Avg Margin"
                        value="24.5%"
                        change="+1.5%"
                        color="#34C759"
                        icon={ShowChartIcon}
                    />
                </Grid>
            </Grid>

            {/* Usage Dashboard Service Row */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Service Usage Detail</Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4}>
                    <UsageBox title="VOICE" value={latestUsage.voice_usage?.toLocaleString() || '0'} series={voiceSeries} color="#0071E3" />
                </Grid>
                <Grid item xs={12} md={4}>
                    <UsageBox title="SMS" value={latestUsage.sms_usage?.toLocaleString() || '0'} series={smsSeries} color="#00B4D8" />
                </Grid>
                <Grid item xs={12} md={4}>
                    <UsageBox title="DATA (GB)" value={latestUsage.data_usage?.toLocaleString() || '0'} series={dataSeries} color="#0077B6" />
                </Grid>
            </Grid>

            {/* Porting and Insights */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <AppleCard sx={{ p: 2, height: 400 }}>
                        <Chart options={costTrendOptions} series={[{ name: 'Cost', data: data.costTrend.map((d: any) => d.total_cost) }]} type="line" height={360} />
                    </AppleCard>
                </Grid>
                <Grid item xs={12} md={4}>
                    <AppleCard sx={{ p: 2, height: 400 }}>
                        <Chart options={portingTrendOptions} series={[
                            { name: 'Portins', data: data.porting.map((d: any) => d.portins) },
                            { name: 'MNO Base', data: data.porting.map((d: any) => d.mno_base) }
                        ]} type="area" height={360} />
                    </AppleCard>
                </Grid>
            </Grid>

            {/* Data Usage and Volumes */}
            <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={8}>
                    <AppleCard sx={{ p: 2, height: 400 }}>
                        <Chart
                            options={usageTrendOptions}
                            series={[
                                { name: 'Data (GB)', type: 'area', data: dataSeries },
                                { name: 'Voice (Min)', type: 'line', data: voiceSeries },
                                { name: 'SMS', type: 'line', data: smsSeries }
                            ]}
                            type="area"
                            height={360}
                        />
                    </AppleCard>
                </Grid>
                <Grid item xs={12} md={4}>
                    <AppleCard sx={{ p: 2, height: 400 }}>
                        <Chart options={{
                            chart: { type: 'bar' },
                            xaxis: { categories: data.dataUsagePerEntity.map((d: any) => d.entity_name) },
                            plotOptions: { bar: { horizontal: true } },
                            title: { text: 'Data Usage per Entity (GB)', style: { fontWeight: 600 } },
                            colors: ['#AF52DE']
                        }} series={[{ name: 'Data Usage', data: data.dataUsagePerEntity.map((d: any) => d.total_data_usage) }]} type="bar" height={360} />
                    </AppleCard>
                </Grid>
            </Grid>

            {/* Secondary Charts and Top Entities */}
            <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={4}>
                    <AppleCard sx={{ p: 2, height: 400, overflow: 'auto' }}>
                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700, color: '#1D1D1F' }}>
                            Top Entities by Data Usage
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {data.dataUsagePerEntity.slice(0, 5).map((entity: any, index: number) => (
                                <Box key={entity.entity_name} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Box sx={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        bgcolor: index === 0 ? '#AF52DE' : '#F5F5F7',
                                        color: index === 0 ? 'white' : '#86868B',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 700
                                    }}>
                                        {index + 1}
                                    </Box>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{entity.entity_name}</Typography>
                                        <Typography variant="caption" sx={{ color: '#86868B' }}>{entity.total_data_usage.toLocaleString()} GB used</Typography>
                                    </Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#AF52DE' }}>
                                        {((entity.total_data_usage / data.dataUsagePerEntity.reduce((acc: number, curr: any) => acc + curr.total_data_usage, 0)) * 100).toFixed(1)}%
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </AppleCard>
                </Grid>
                <Grid item xs={12} md={4}>
                    <AppleCard sx={{ p: 2, height: 400 }}>
                        <Chart options={{
                            chart: { type: 'bar' },
                            xaxis: { categories: data.entityComparison.map((d: any) => d.entity_name) },
                            plotOptions: { bar: { horizontal: true } },
                            title: { text: 'Wholesale Entity Cost Comparison', style: { fontWeight: 600 } },
                            colors: ['#0071E3']
                        }} series={[{ name: 'Total Cost', data: data.entityComparison.map((d: any) => d.total_cost) }]} type="bar" height={360} />
                    </AppleCard>
                </Grid>
                <Grid item xs={12} md={4}>
                    <AppleCard sx={{ p: 2, height: 400 }}>
                        <Chart options={{
                            chart: { type: 'donut' },
                            labels: data.costBreakdown.map((d: any) => d.service_type),
                            title: { text: 'Cost Breakdown by Service', style: { fontWeight: 600 } },
                            colors: ['#0071E3', '#00B4D8', '#0077B6', '#AF52DE', '#FF9500']
                        }} series={data.costBreakdown.map((d: any) => parseFloat(d.total_amount))} type="donut" height={360} />
                    </AppleCard>
                </Grid>
            </Grid>
        </Box>
    );
};

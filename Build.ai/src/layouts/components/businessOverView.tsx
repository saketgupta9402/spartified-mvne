import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import Grid from '@mui/material/Grid';
import { green, red } from '@mui/material/colors';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Typography, CircularProgress, Button, IconButton } from '@mui/material';

import {
  fetchFinancialChartData,
  fetchDashboardOverviewMetrics,
  fetchAccountGrowthChartData,
  fetchSIMTrendsChartData,
  fetchGoalsProgressData,
  fetchAccountsReceivableData,
  fetchTopAccountsTableData,
} from '../../services/dashboardService';

// TypeScript Interfaces (same as before)
interface FinancialData {
  month: string;
  Revenue: number;
  GrossProfit: number;
  NetProfit: number;
  OPEX: number;
  CoGS: number;
}

interface AccountGrowthData {
  month: string;
  newAccounts: number;
  lostAccounts: number;
  netGrowth: number;
}

interface SIMTrendsData {
  month: string;
  simOrders: number;
  usage: number;
}

interface GoalsProgressData {
  label: string;
  current: number;
  target: number;
  percentage: number;
}

interface AccountsReceivableData {
  category: string;
  amount: number;
  percentage: number;
  color?: string;
}

interface TopAccountData {
  account_name: string;
  total_sims: number;
  total_usage_gb: number;
  total_revenue: number;
  avg_revenue_per_sim: number;
  overage_charges: number;
  segment: string;
  usage_tier: string;
}

interface KPIMetrics {
  ytd_gross_profit_display: string;
  gross_profit_change: number;
  ytd_net_profit_display: string;
  net_profit_change: number;
  ytd_revenue_display: string;
  revenue_change: number;
  ytd_opex_display: string;
  opex_change: number;
  active_accounts_display: string;
  active_accounts_change: number;
  avg_cogs_display: string;
  cogs_change: number;
  avg_opex_display: string;
  opex_per_account_change: number;
}

export const BusinessOverviewComponent = () => {
  // Financial Performance State
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const [financialLoading, setFinancialLoading] = useState<boolean>(true);
  const [financialError, setFinancialError] = useState<string | null>(null);

  // KPI Metrics State
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics | null>(null);
  const [kpiLoading, setKpiLoading] = useState<boolean>(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  // Account Growth State
  const [accountGrowthData, setAccountGrowthData] = useState<AccountGrowthData[]>([]);
  const [accountGrowthLoading, setAccountGrowthLoading] = useState<boolean>(true);
  const [accountGrowthError, setAccountGrowthError] = useState<string | null>(null);

  // SIM Trends State
  const [simTrendsData, setSimTrendsData] = useState<SIMTrendsData[]>([]);
  const [simTrendsLoading, setSimTrendsLoading] = useState<boolean>(true);
  const [simTrendsError, setSimTrendsError] = useState<string | null>(null);

  // Goals Progress State
  const [goalsData, setGoalsData] = useState<GoalsProgressData[]>([]);
  const [goalsLoading, setGoalsLoading] = useState<boolean>(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  // Accounts Receivable State
  const [receivableData, setReceivableData] = useState<AccountsReceivableData[]>([]);
  const [receivableLoading, setReceivableLoading] = useState<boolean>(true);
  const [receivableError, setReceivableError] = useState<string | null>(null);

  // Top Accounts State
  const [topAccountsData, setTopAccountsData] = useState<TopAccountData[]>([]);
  const [topAccountsLoading, setTopAccountsLoading] = useState<boolean>(true);
  const [topAccountsError, setTopAccountsError] = useState<string | null>(null);

  // Global loading state for refresh button
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load Financial Data
  const loadFinancialData = useCallback(async (forceRefresh = false) => {
    try {
      setFinancialLoading(true);
      setFinancialError(null);
      console.log(`🔄 ${forceRefresh ? 'REFRESHING' : 'Loading'} financial data...`);

      const result = await fetchFinancialChartData();
      console.log('📊 Financial data result:', result);

      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        setFinancialData(result.data);
        console.log('✅ Financial data set successfully:', result.data);

        if (result.error && !result.message.includes('fallback')) {
          setFinancialError(`API Error: ${result.message}`);
        } else if (result.message.includes('fallback')) {
          setFinancialError('Using fallback data - API may be unavailable');
        }
      } else {
        console.warn('⚠️ No financial data received');
        setFinancialError('No financial data available');
        setFinancialData([]);
      }
    } catch (err) {
      console.error('❌ Failed to load financial data:', err);
      setFinancialError('Failed to load financial data');
      setFinancialData([]);
    } finally {
      setFinancialLoading(false);
    }
  }, []);

  // Load KPI Metrics
  const loadKPIMetrics = useCallback(async (forceRefresh = false) => {
    try {
      setKpiLoading(true);
      setKpiError(null);
      console.log(`🔄 ${forceRefresh ? 'REFRESHING' : 'Loading'} KPI metrics...`);

      const result = await fetchDashboardOverviewMetrics();
      console.log('📊 KPI metrics result:', result);

      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        setKpiMetrics(result.data[0]);
        console.log('✅ KPI metrics set successfully:', result.data[0]);

        if (result.error && !result.message.includes('fallback')) {
          setKpiError(`API Error: ${result.message}`);
        } else if (result.message.includes('fallback')) {
          setKpiError('Using fallback data - API may be unavailable');
        }
      } else {
        console.warn('⚠️ No KPI metrics received');
        setKpiError('No KPI metrics available');
        setKpiMetrics(null);
      }
    } catch (err) {
      console.error('❌ Failed to load KPI metrics:', err);
      setKpiError('Failed to load KPI metrics');
      setKpiMetrics(null);
    } finally {
      setKpiLoading(false);
    }
  }, []);

  // Load Account Growth Data
  const loadAccountGrowthData = useCallback(async (forceRefresh = false) => {
    try {
      setAccountGrowthLoading(true);
      setAccountGrowthError(null);
      console.log(`🔄 ${forceRefresh ? 'REFRESHING' : 'Loading'} account growth data...`);

      const result = await fetchAccountGrowthChartData();
      console.log('📊 Account growth result:', result);

      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const transformedData = result.data.map((item: any) => ({
          month: item.month,
          newAccounts: item.newaccounts || item.newAccounts || item.accounts || 0,
          lostAccounts: item.lostaccounts || item.lostAccounts || 0,
          netGrowth: item.netgrowth || item.netGrowth || item.growth || 0,
        }));
        setAccountGrowthData(transformedData);
        console.log('✅ Account growth data set successfully:', transformedData);

        if (result.error && !result.message.includes('fallback')) {
          setAccountGrowthError(`API Error: ${result.message}`);
        } else if (result.message.includes('fallback')) {
          setAccountGrowthError('Using fallback data - API may be unavailable');
        }
      } else {
        console.warn('⚠️ No account growth data received');
        setAccountGrowthError('No account growth data available');
        setAccountGrowthData([]);
      }
    } catch (err) {
      console.error('❌ Failed to load account growth data:', err);
      setAccountGrowthError('Failed to load account growth data');
      setAccountGrowthData([]);
    } finally {
      setAccountGrowthLoading(false);
    }
  }, []);

  // Load SIM Trends Data
  const loadSIMTrendsData = useCallback(async (forceRefresh = false) => {
    try {
      setSimTrendsLoading(true);
      setSimTrendsError(null);
      console.log(`🔄 ${forceRefresh ? 'REFRESHING' : 'Loading'} SIM trends data...`);

      const result = await fetchSIMTrendsChartData();
      console.log('📊 SIM trends result:', result);

      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const transformedData = result.data.map((item: any) => ({
          month: item.month,
          simOrders: item.orders || item.active || 0,
          usage: item.usage || item.total || 0,
        }));
        setSimTrendsData(transformedData);
        console.log('✅ SIM trends data set successfully:', transformedData);

        if (result.error && !result.message.includes('fallback')) {
          setSimTrendsError(`API Error: ${result.message}`);
        } else if (result.message.includes('fallback')) {
          setSimTrendsError('Using fallback data - API may be unavailable');
        }
      } else {
        console.warn('⚠️ No SIM trends data received');
        setSimTrendsError('No SIM trends data available');
        setSimTrendsData([]);
      }
    } catch (err) {
      console.error('❌ Failed to load SIM trends data:', err);
      setSimTrendsError('Failed to load SIM trends data');
      setSimTrendsData([]);
    } finally {
      setSimTrendsLoading(false);
    }
  }, []);

  // Load Goals Progress Data
  const loadGoalsData = useCallback(async (forceRefresh = false) => {
    try {
      setGoalsLoading(true);
      setGoalsError(null);
      console.log(`🔄 ${forceRefresh ? 'REFRESHING' : 'Loading'} goals data...`);

      const result = await fetchGoalsProgressData();
      console.log('📊 Goals data result:', result);

      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const transformedData = result.data.map((item: any) => ({
          label: item.title || item.label || 'Unknown Goal',
          current: item.current || 0,
          target: item.target || 100,
          percentage: item.percentage || 0,
        }));
        setGoalsData(transformedData);
        console.log('✅ Goals data set successfully:', transformedData);

        if (result.error && !result.message.includes('fallback')) {
          setGoalsError(`API Error: ${result.message}`);
        } else if (result.message.includes('fallback')) {
          setGoalsError('Using fallback data - API may be unavailable');
        }
      } else {
        console.warn('⚠️ No goals data received');
        setGoalsError('No goals data available');
        setGoalsData([]);
      }
    } catch (err) {
      console.error('❌ Failed to load goals data:', err);
      setGoalsError('Failed to load goals data');
      setGoalsData([]);
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  // Load Accounts Receivable Data
  const loadReceivableData = useCallback(async (forceRefresh = false) => {
    try {
      setReceivableLoading(true);
      setReceivableError(null);
      console.log(`🔄 ${forceRefresh ? 'REFRESHING' : 'Loading'} receivable data...`);

      const result = await fetchAccountsReceivableData();
      console.log('📊 Receivable data result:', result);

      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const transformedData = result.data.map((item: any, index: number) => ({
          category: item.category || `Category ${index + 1}`,
          amount: item.amount || 0,
          percentage: item.percentage || 0,
          color: ['#4CAF50', '#FBC02D', '#FB8C00', '#E53935'][index] || '#4CAF50',
        }));
        setReceivableData(transformedData);
        console.log('✅ Receivable data set successfully:', transformedData);

        if (result.error && !result.message.includes('fallback')) {
          setReceivableError(`API Error: ${result.message}`);
        } else if (result.message.includes('fallback')) {
          setReceivableError('Using fallback data - API may be unavailable');
        }
      } else {
        console.warn('⚠️ No receivable data received');
        setReceivableError('No receivable data available');
        setReceivableData([]);
      }
    } catch (err) {
      console.error('❌ Failed to load receivable data:', err);
      setReceivableError('Failed to load receivable data');
      setReceivableData([]);
    } finally {
      setReceivableLoading(false);
    }
  }, []);

  // Load Top Accounts Data
  const loadTopAccountsData = useCallback(async (forceRefresh = false) => {
    try {
      setTopAccountsLoading(true);
      setTopAccountsError(null);
      console.log(`🔄 ${forceRefresh ? 'REFRESHING' : 'Loading'} top accounts data...`);

      const result = await fetchTopAccountsTableData();
      console.log('📊 Top accounts result:', result);

      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        setTopAccountsData(result.data);
        console.log('✅ Top accounts data set successfully:', result.data);

        if (result.error && !result.message.includes('fallback')) {
          setTopAccountsError(`API Error: ${result.message}`);
        } else if (result.message.includes('fallback')) {
          setTopAccountsError('Using fallback data - API may be unavailable');
        }
      } else {
        console.warn('⚠️ No top accounts data received');
        setTopAccountsError('No top accounts data available');
        setTopAccountsData([]);
      }
    } catch (err) {
      console.error('❌ Failed to load top accounts data:', err);
      setTopAccountsError('Failed to load top accounts data');
      setTopAccountsData([]);
    } finally {
      setTopAccountsLoading(false);
    }
  }, []);

  // Load all data function
  const loadAllData = useCallback(async (forceRefresh = false) => {
    console.log(`🚀 ${forceRefresh ? 'REFRESHING ALL DATA' : 'LOADING ALL DATA'}...`);

    if (forceRefresh) {
      setIsRefreshing(true);
    }

    try {
      // Load all data concurrently
      await Promise.all([
        loadFinancialData(forceRefresh),
        loadKPIMetrics(forceRefresh),
        loadAccountGrowthData(forceRefresh),
        loadSIMTrendsData(forceRefresh),
        loadGoalsData(forceRefresh),
        loadReceivableData(forceRefresh),
        loadTopAccountsData(forceRefresh),
      ]);

      if (forceRefresh) {
        setLastRefresh(new Date());
        console.log('🎉 All data refreshed successfully!');
      } else {
        console.log('🎉 All data loaded successfully!');
      }
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
    } finally {
      if (forceRefresh) {
        setIsRefreshing(false);
      }
    }
  }, [
    loadFinancialData,
    loadKPIMetrics,
    loadAccountGrowthData,
    loadSIMTrendsData,
    loadGoalsData,
    loadReceivableData,
    loadTopAccountsData,
  ]);

  // Handle refresh button click
  const handleRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    loadAllData(true);
  }, [loadAllData]);

  // Initial load on component mount
  useEffect(() => {
    console.log('🎬 Component mounted, loading initial data...');
    loadAllData(false);
  }, [loadAllData]);

  // Helper function to get KPI card values
  const getKPICardValue = (index: number) => {
    if (!kpiMetrics) return { value: 'Loading...', change: 'Loading...' };

    const configs = [
      {
        value: kpiMetrics.ytd_gross_profit_display,
        change: `${kpiMetrics.gross_profit_change > 0 ? '+' : ''}${kpiMetrics.gross_profit_change}%`,
      },
      {
        value: kpiMetrics.ytd_net_profit_display,
        change: `${kpiMetrics.net_profit_change > 0 ? '+' : ''}${kpiMetrics.net_profit_change}%`,
      },
      {
        value: kpiMetrics.ytd_revenue_display,
        change: `${kpiMetrics.revenue_change > 0 ? '+' : ''}${kpiMetrics.revenue_change}%`,
      },
      {
        value: kpiMetrics.ytd_opex_display,
        change: `${kpiMetrics.opex_change > 0 ? '+' : ''}${kpiMetrics.opex_change}%`,
      },
    ];

    return configs[index] || { value: 'N/A', change: 'N/A' };
  };

  return (
      <Grid container spacing={3} sx={{ padding: 0, backgroundColor: '#f5f5f5' }}>
        {/* Header with Refresh Button */}
        {/* <Grid item xs={12}> */}
        {/*   <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}> */}
        {/*     <Typography variant="h4" fontWeight={700}> */}
        {/*       Business Overview Dashboard */}
        {/*     </Typography> */}
        {/*     <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}> */}
        {/*       <Typography variant="body2" color="text.secondary"> */}
        {/*         Last updated: {lastRefresh.toLocaleTimeString()} */}
        {/*       </Typography> */}
        {/*       <Button */}
        {/*           variant="contained" */}
        {/*           startIcon={<RefreshIcon />} */}
        {/*           onClick={handleRefresh} */}
        {/*           disabled={isRefreshing} */}
        {/*           sx={{ */}
        {/*             backgroundColor: '#1976d2', */}
        {/*             '&:hover': { backgroundColor: '#1565c0' }, */}
        {/*             '&:disabled': { backgroundColor: '#ccc' } */}
        {/*           }} */}
        {/*       > */}
        {/*         {isRefreshing ? 'Refreshing...' : 'Refresh Data'} */}
        {/*       </Button> */}
        {/*     </Box> */}
        {/*   </Box> */}
        {/* </Grid> */}

        {/* KPI Summary Cards */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            {[
              { title: 'Gross Profit (YTD)' },
              { title: 'Net Profit (YTD)' },
              { title: 'Revenue (YTD)' },
              { title: 'Total OPEX (YTD)' },
            ].map((item, index) => {
              const kpiData = getKPICardValue(index);
              return (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Box
                        sx={{
                          backgroundColor: '#fff',
                          borderRadius: 2,
                          boxShadow: 1,
                          p: 2,
                          textAlign: 'center',
                          transition: 'box-shadow 0.1s ease-in-out',
                          '&:hover': { boxShadow: 6 },
                          position: 'relative',
                        }}
                    >
                      {kpiLoading && (
                          <Box
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                              }}
                          >
                            <CircularProgress size={16} />
                          </Box>
                      )}
                      <Typography variant="subtitle2" fontWeight={600}>
                        {item.title}
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {kpiData.value}
                      </Typography>
                      <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: kpiData.change.includes('+') ? green[600] : red[600],
                          }}
                      >
                        {kpiData.change.includes('+') ? (
                            <TrendingUpIcon fontSize="small" />
                        ) : (
                            <TrendingDownIcon fontSize="small" />
                        )}
                        <Typography variant="body2" sx={{ ml: 0.5 }}>
                          {kpiData.change} vs last year
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
              );
            })}
          </Grid>
        </Grid>

        {/* Financial Trends & Goals */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {/* Financial Performance Chart */}
            <Box
                sx={{ flex: '2 1 600px', backgroundColor: '#fff', borderRadius: 2, boxShadow: 1, p: 2 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Financial Performance Trends
                </Typography>
                {financialLoading && (
                    <CircularProgress size={20} />
                )}
              </Box>

              {financialError && (
                  <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                    {financialError}
                  </Typography>
              )}

              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                    data={financialData}
                    margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
                    key={`chart-${financialData.length}`}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis
                      tickFormatter={(value) =>
                          value >= 1000000
                              ? `${(value / 1000000).toFixed(1)}M`
                              : value >= 1000
                                  ? `${(value / 1000).toFixed(0)}K`
                                  : value
                      }
                  />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="Revenue" stroke="#1e88e5" />
                  <Line type="monotone" dataKey="GrossProfit" stroke="#43a047" />
                  <Line type="monotone" dataKey="NetProfit" stroke="#e53935" />
                  <Line type="monotone" dataKey="OPEX" stroke="#fb8c00" />
                  <Line type="monotone" dataKey="CoGS" stroke="#8e24aa" />
                </LineChart>
              </ResponsiveContainer>
            </Box>

            {/* YTD Performance vs Goals */}
            <Box
                sx={{ flex: '1 1 300px', backgroundColor: '#fff', borderRadius: 2, boxShadow: 1, p: 2 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  YTD Performance vs Goals
                </Typography>
                {goalsLoading && (
                    <CircularProgress size={20} />
                )}
              </Box>

              {goalsError && (
                  <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                    {goalsError}
                  </Typography>
              )}

              {goalsData.map((goal, i) => (
                  <Box key={i} sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {goal.label}: {goal.current}/{goal.target}
                    </Typography>
                    <Box sx={{ backgroundColor: '#e0e0e0', height: 8, borderRadius: 4, mt: 0.5 }}>
                      <Box
                          sx={{
                            width: `${Math.min(goal.percentage, 100)}%`,
                            height: '100%',
                            backgroundColor: '#1a237e',
                            borderRadius: 4,
                          }}
                      />
                    </Box>
                    <Typography variant="caption">{goal.percentage}% of target</Typography>
                  </Box>
              ))}
            </Box>
          </Box>
        </Grid>

        {/* Account Growth & SIM Orders */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            {/* Account Growth Chart */}
            <Grid item xs={12} md={6}>
              <Box sx={{ backgroundColor: '#fff', borderRadius: 2, boxShadow: 1, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Account Growth/Decline
                  </Typography>
                  {accountGrowthLoading && (
                      <CircularProgress size={20} />
                  )}
                </Box>

                {accountGrowthError && (
                    <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                      {accountGrowthError}
                    </Typography>
                )}

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={accountGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="newAccounts" fill="#4caf50" />
                    <Bar dataKey="lostAccounts" fill="#f44336" />
                    <Bar dataKey="netGrowth" fill="#2196f3" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Grid>

            {/* SIM Order & Usage Trends */}
            <Grid item xs={12} md={6}>
              <Box sx={{ backgroundColor: '#fff', borderRadius: 2, boxShadow: 1, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    SIM Order & Usage Trends
                  </Typography>
                  {simTrendsLoading && (
                      <CircularProgress size={20} />
                  )}
                </Box>

                {simTrendsError && (
                    <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                      {simTrendsError}
                    </Typography>
                )}

                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={simTrendsData}>
                    <defs>
                      <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <CartesianGrid strokeDasharray="3 3" />
                    <Tooltip />
                    <Area
                        type="monotone"
                        dataKey="simOrders"
                        stroke="#8884d8"
                        fillOpacity={1}
                        fill="url(#colorSim)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
          </Grid>
        </Grid>

        {/* Accounts Receivable + Summary KPIs */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            {/* Accounts Receivable Pie Chart */}
            <Grid item xs={12} md={6}>
              <Box sx={{ backgroundColor: '#fff', borderRadius: 2, boxShadow: 1, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Accounts Receivable Aging
                  </Typography>
                  {receivableLoading && (
                      <CircularProgress size={20} />
                  )}
                </Box>

                {receivableError && (
                    <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                      {receivableError}
                    </Typography>
                )}

                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                        data={receivableData}
                        dataKey="amount"
                        nameKey="category"
                        outerRadius={80}
                        label={({ percentage }) => `${percentage.toFixed(0)}%`}
                        labelLine={false}
                    >
                      {receivableData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                      <Legend/>
                  </PieChart>
                </ResponsiveContainer>
                       <Typography sx={{ mt: 1,display:'flex',justifyContent:'space-between' }}>
                  <strong>Average Days to Payment</strong>{' '}
                  <Box component="span" sx={{ fontWeight: 1000,color: '#1a73e8' }}>
                   30 days
                  </Box>
                </Typography>
                <Typography sx={{ mt: 1,display:'flex',justifyContent:'space-between' }}>
                  <strong>Total Outstanding:</strong>{' '}
                  <Box component="span" sx={{ fontWeight: 1000 }}>
                    ${receivableData.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
                  </Box>
                </Typography>
              </Box>
            </Grid>

            {/* Summary KPIs */}
            <Grid item xs={12} md={6}>
              <Grid container spacing={2}>
                {[
                  {
                    label: 'Active Accounts',
                    getValue: () => kpiMetrics?.active_accounts_display || 'Loading...',
                    getChange: () =>
                        kpiMetrics
                            ? `${kpiMetrics.active_accounts_change > 0 ? '+' : ''}${kpiMetrics.active_accounts_change}%`
                            : 'Loading...',
                    isPositive: () => (kpiMetrics ? kpiMetrics.active_accounts_change >= 0 : true),
                  },
                  {
                    label: 'CoGS per Account (Avg)',
                    getValue: () => kpiMetrics?.avg_cogs_display || 'Loading...',
                    getChange: () =>
                        kpiMetrics
                            ? `${kpiMetrics.cogs_change > 0 ? '+' : ''}${kpiMetrics.cogs_change}%`
                            : 'Loading...',
                    isPositive: () => (kpiMetrics ? kpiMetrics.cogs_change <= 0 : true),
                  },
                  {
                    label: 'OPEX per Account (Avg)',
                    getValue: () => kpiMetrics?.avg_opex_display || 'Loading...',
                    getChange: () =>
                        kpiMetrics
                            ? `${kpiMetrics.opex_per_account_change > 0 ? '+' : ''}${kpiMetrics.opex_per_account_change}%`
                            : 'Loading...',
                    isPositive: () => (kpiMetrics ? kpiMetrics.opex_per_account_change <= 0 : true),
                  },
                ].map((kpi, index) => (
                    <Grid item xs={12} key={index}>
                      <Box
                          sx={{
                            backgroundColor: '#fff',
                            borderRadius: 2,
                            boxShadow: 1,
                            p: 1.3,
                            border: '1px solid #eee',
                            transition: 'box-shadow 0.1s ease-in-out',
                            '&:hover': { boxShadow: 6 },
                            position: 'relative',
                          }}
                      >
                        {kpiLoading && (
                            <Box
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                }}
                            >
                              <CircularProgress size={16} />
                            </Box>
                        )}
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                          {kpi.label}
                        </Typography>
                        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                          {kpi.getValue()}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: kpi.getChange().includes('+') ? green[600] : red[600] }}>
                          {kpi.getChange().includes('+') ? (
                              <TrendingUpIcon fontSize="small" />
                          ) : (
                              <TrendingDownIcon fontSize="small" />
                          )}
                          <Typography variant="body2">
                            {kpi.getChange()} vs last month
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Grid>

        {/* Top Accounts by Segment */}
        <Grid item xs={12}>
          <Box sx={{ backgroundColor: '#fff', borderRadius: 2, boxShadow: 1, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Top Accounts by Segment
              </Typography>
              {topAccountsLoading && (
                  <CircularProgress size={20} />
              )}
            </Box>

            {topAccountsError && (
                <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                  {topAccountsError}
                </Typography>
            )}

            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
              <tr>
                {['Account Name', 'Segment', 'Revenue', 'SIMs', 'Usage (GB)', 'Avg Rev/SIM'].map(
                    (header, i) => (
                        <th key={i} style={{ textAlign: 'left', padding: '10px', fontWeight: 600 }}>
                          {header}
                        </th>
                    )
                )}
              </tr>
              </thead>
              <tbody>
              {topAccountsData.map((row, index) => (
                  <tr key={index} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{row.account_name}</td>
                    <td style={{ padding: '12px' }}>
                      <Box
                          sx={{
                            display: 'inline-block',
                            px: 1.2,
                            py: 0.4,
                            backgroundColor:
                                row.segment === 'Enterprise'
                                    ? '#e3f2fd'
                                    : row.segment === 'SMB'
                                        ? '#e8f5e9'
                                        : '#ede7f6',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                      >
                        {row.segment}
                      </Box>
                    </td>
                    <td style={{ padding: '12px' }}>${row.total_revenue.toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>{row.total_sims.toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>{row.total_usage_gb.toFixed(1)}</td>
                    <td style={{ padding: '12px' }}>${row.avg_revenue_per_sim.toFixed(2)}</td>
                  </tr>
              ))}
              </tbody>
            </Box>
          </Box>
        </Grid>
      </Grid>
  );
};

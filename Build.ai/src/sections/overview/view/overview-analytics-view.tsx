import React, { useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import ReactDOM from 'react-dom/client';
// import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, } from 'recharts';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';

import {
  fetchDataUsageByNetwork,
  fetchCdrRecordsHistory,
  fetchBillingHistory,
  fetchSimTotalHistory,
  fetchAccountsTotalHistory,
  fetchTopAccountsByBill,
  fetchTopAccountsByUsage,
  fetchAccountsBillLastSixMonths,
  fetchAccountsUsageLastSixMonths,
  fetchRatePlanUsage,
} from 'src/services/analyticsService';

import { UsageForAccounts } from 'src/components/charts/UsageForAccounts';
import { BillingForAccounts } from 'src/components/charts/BillingForAccounts';
import { DataUsageDonutChart } from 'src/sections/overview/DataUsageDonutChart';
import { AnalyticsWidgetSummary } from 'src/sections/overview/analytics-widget-summary';
import { Box } from '@mui/material';
import { BusinessOverviewComponent } from '../../../layouts/components/businessOverView';
import MetricsDashboard from '../../../layouts/components/performanceMetrics';

const AppleHeader = styled(Typography)(({ theme }) => ({
  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontWeight: 600,
  color: '#1D1D1F',
  paddingLeft: theme.spacing(1),
  marginBottom: theme.spacing(2),
}));

interface LabelValue {
  label: string;
  value: number;
  total?: number;
}

interface TopAccountData {
  name: string;
  data: number[];
}

type FetchDataResult = LabelValue[] | { series: TopAccountData[]; months: string[] };

const useFetchData = <T extends FetchDataResult>(
  fetchFunction: () => Promise<T>,
  setData: React.Dispatch<React.SetStateAction<T>>,
  errorMessage: string,
  isTopAccountsByUsage: boolean = false
) => {
  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchFunction();
        console.log(`${errorMessage.split(':')[0]} Data:`, result);
        if (isTopAccountsByUsage) {
          const data = result as { series: TopAccountData[]; months: string[] };
          if (data.series.length === 0) {
            console.error(errorMessage, 'No valid data returned');
          }
          setData(data as T);
        } else {
          const data = result as LabelValue[];
          if (!data || (Array.isArray(data) && data.length === 0)) {
            console.error(errorMessage, 'No valid data returned');
          }
          setData((data || []) as T);
        }
      } catch (error) {
        console.error(errorMessage, error);
        setData((isTopAccountsByUsage ? { series: [], months: [] } : []) as unknown as T);
      }
    };
    fetchData();
  }, [fetchFunction, setData, errorMessage, isTopAccountsByUsage]);
};

export function OverviewAnalyticsView() {
  const [dataUsageByNetwork, setDataUsageByNetwork] = useState<LabelValue[]>([]);
  const [ratePlanUsageLastMonth, setRatePlanUsage] = useState<LabelValue[]>([]);
  const [cdrHistoryData, setCdrHistoryData] = useState<LabelValue[]>([]);
  const [billingHistoryData, setBillingHistoryData] = useState<LabelValue[]>([]);
  const [simTotalHistory, setSimTotalHistory] = useState<LabelValue[]>([]);
  const [totalAccountsHistory, setTotalAccountsHistory] = useState<LabelValue[]>([]);
  const [topAccountsBill, setTopAccountsBill] = useState<LabelValue[]>([]);
  const [pastSixMonthsAccountsBill, setPastSixMonthsAccountsBill] = useState<LabelValue[]>([]);
  const [pastSixMonthsAccountsUsage, setPastSixMonthsAccountsUsage] = useState<LabelValue[]>([]);
  const [topAccountsUsage, setTopAccountsUsage] = useState<{ series: TopAccountData[]; months: string[] }>({
    series: [],
    months: [],
  });

  useFetchData(fetchDataUsageByNetwork, setDataUsageByNetwork, 'Failed to fetch data usage by network:');
  useFetchData(fetchCdrRecordsHistory, setCdrHistoryData, 'Failed to fetch CDR history data:');
  useFetchData(fetchBillingHistory, setBillingHistoryData, 'Failed to fetch billing history data:');
  useFetchData(fetchSimTotalHistory, setSimTotalHistory, 'Failed to fetch SIM total history data:');
  useFetchData(fetchAccountsTotalHistory, setTotalAccountsHistory, 'Failed to fetch total accounts history data:');
  useFetchData(fetchTopAccountsByBill, setTopAccountsBill, 'Failed to fetch top accounts bill data:');
  useFetchData(fetchAccountsBillLastSixMonths, setPastSixMonthsAccountsBill, 'Failed to fetch past 6 months bill for accounts:');
  useFetchData(fetchAccountsUsageLastSixMonths, setPastSixMonthsAccountsUsage, 'Failed to fetch past 6 months usage for accounts:');
  useFetchData(fetchRatePlanUsage, setRatePlanUsage, 'Failed to fetch past months rate plan usage:');
  useFetchData(fetchTopAccountsByUsage, setTopAccountsUsage, 'Failed to fetch top accounts usage data:', true);


  const [performanceClicked, setPerformanceClicked] = useState(false)

  const [businessclicked, setBusineeClicked] = useState(true);
  const handleBusinessClick = () => {
    setBusineeClicked(true);
    setPerformanceClicked(false);

  };

  const handlePerformanceClick = () => {
    setPerformanceClicked(true);
    setBusineeClicked(false)

  };

  return (
    <Box sx={{p:0}}>
<Box sx={{
          display: 'flex',justifyContent: 'space-between'}}>
      <Box
        sx={{
          display: 'inline-flex',
          backgroundColor: '#f9fafb', // container background
          borderRadius: 2,
          p: 1,
          mb: 3,
          gap:1
        }}
      >
        {/* Business Overview Button */}
        <Box
          onClick={handleBusinessClick}
          sx={{
            px: 3,
            py: 1,
            borderRadius: 1,
            cursor: 'pointer',
            backgroundColor: businessclicked ? '#fff' : 'transparent',
            color: businessclicked ? 'black' : '#64748b',
            fontWeight: businessclicked ? 'bold' : 500,
            boxShadow: businessclicked ? 1 : 'none',
            transition: 'all 0.2s ease-in-out',

          }}
        >
          Business Overview
        </Box>

        {/* Performance Metrics Button */}
        <Box
          onClick={handlePerformanceClick}
          sx={{
            px: 3,
            py: 1,
            borderRadius: 1,
            cursor: 'pointer',
            backgroundColor: performanceClicked ? '#fff' : 'transparent',
            color: performanceClicked ? 'black' : '#64748b',
            fontWeight: performanceClicked ? 'bold' : 500,
            boxShadow: performanceClicked ? 1 : 'none',
            transition: 'all 0.2s ease-in-out',

          }}
        >
          Performance Metrics
        </Box>

        </Box>
    <Box
        sx={{
            px: 3,
            py: 1,
            mt:1,
            borderRadius: 1,
            cursor: 'pointer',
            backgroundColor: '#fff',
            color: 'black',
            fontWeight: 'bold',
            boxShadow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '40px', // Optional: fix height to control vertical space
        }}
    >
        Upload csv
    </Box>

      </Box>
      <Box  id='layout' >
    {businessclicked ? <BusinessOverviewComponent /> : <MetricsDashboard />}

  {/*       <Grid container spacing={3} sx={{ display: 'flex', flexWrap: 'wrap' }}> */}
{/*         <Grid xs={12} sm={6} md={3}> */}
{/*           <AnalyticsWidgetSummary */}
{/*             title="Total Bill" */}
{/*             total={billingHistoryData.length > 0 ? billingHistoryData[billingHistoryData.length - 1].value : 0} */}
{/*             subtitle="This Month" */}
{/*           /> */}
{/*         </Grid> */}
{/*         <Grid xs={12} sm={6} md={3}> */}
{/*           <AnalyticsWidgetSummary */}
{/*             title="Active SIMs" */}
{/*             total={simTotalHistory.length > 0 ? simTotalHistory[simTotalHistory.length - 1].value : 0} */}
{/*             subtitle="Current Count" */}
{/*             percent={ */}
{/*               simTotalHistory.length > 1 */}
{/*                 ? ((simTotalHistory[simTotalHistory.length - 1].value - simTotalHistory[simTotalHistory.length - 2].value) / */}
{/*                   simTotalHistory[simTotalHistory.length - 2].value) * */}
{/*                   100 */}
{/*                 : 0 */}
{/*             } */}
{/*           /> */}
{/*         </Grid> */}
{/*         <Grid xs={12} sm={6} md={3}> */}
{/*           <AnalyticsWidgetSummary */}
{/*             title="Total Accounts" */}
{/*             total={totalAccountsHistory.length > 0 ? totalAccountsHistory[totalAccountsHistory.length - 1].value : 0} */}
{/*             subtitle="Current Count" */}
{/*             percent={ */}
{/*               totalAccountsHistory.length > 1 */}
{/*                 ? ((totalAccountsHistory[totalAccountsHistory.length - 1].value - */}
{/*                     totalAccountsHistory[totalAccountsHistory.length - 2].value) / */}
{/*                   totalAccountsHistory[totalAccountsHistory.length - 2].value) * */}
{/*                   100 */}
{/*                 : 0 */}
{/*             } */}
{/*           /> */}
{/*         </Grid> */}
{/*         <Grid xs={12} sm={6} md={3}> */}
{/*           <AnalyticsWidgetSummary */}
{/*             title="Monthly CDRs" */}
{/*             total={cdrHistoryData.length > 1 ? cdrHistoryData[cdrHistoryData.length - 2].value : 0} */}
{/*             subtitle="Last Month" */}
{/*             percent={ */}
{/*               cdrHistoryData.length > 2 */}
{/*                 ? ((cdrHistoryData[cdrHistoryData.length - 2].value - cdrHistoryData[cdrHistoryData.length - 3].value) / */}
{/*                   cdrHistoryData[cdrHistoryData.length - 3].value) * */}
{/*                   100 */}
{/*                 : 0 */}
{/*             } */}
{/*           /> */}
{/*         </Grid> */}
{/*         <Grid container spacing={3}> */}
{/*           <Grid xs={12} md={3} lg={6}> */}
{/*             {dataUsageByNetwork.length === 0 ? ( */}
{/*               <Typography>No data available for Data Usage by Network</Typography> */}
{/*             ) : ( */}
{/*               <DataUsageDonutChart */}
{/*                 title="Data Usage by Network" */}
{/*                 subheader="Last Billing Cycle" */}
{/*                 chart={{ series: dataUsageByNetwork }} */}
{/*                 sx={{ minHeight: '400px', width: '100%' }} */}
{/*               /> */}
{/*             )} */}
{/*           </Grid> */}
{/*           <Grid xs={12} md={3} lg={6}> */}
{/*             {ratePlanUsageLastMonth.length === 0 ? ( */}
{/*               <Typography>No data available for Data Usage by Rate Plan</Typography> */}
{/*             ) : ( */}
{/*               <DataUsageDonutChart */}
{/*                 title="Data Usage by Rate Plan" */}
{/*                 subheader="Last Billing Cycle" */}
{/*                 chart={{ series: ratePlanUsageLastMonth }} */}
{/*                 sx={{ minHeight: '400px', width: '100%' }} */}
{/*               /> */}
{/*             )} */}
{/*           </Grid> */}
{/*           <Grid xs={12} md={3} lg={6}> */}
{/*             {pastSixMonthsAccountsBill.length === 0 ? ( */}
{/*               <Typography>No data available for Total Bill for All Accounts</Typography> */}
{/*             ) : ( */}
{/*               <BillingForAccounts */}
{/*                 title="Total Bill for All Accounts" */}
{/*                 subheader="Past 6 Months" */}
{/*                 chart={{ */}
{/*                   categories: pastSixMonthsAccountsBill.map((month) => month.label), */}
{/*                   series: { name: 'Billing', data: pastSixMonthsAccountsBill.map((month) => month.value) }, */}
{/*                 }} */}
{/*                 sx={{ minHeight: '400px', width: '100%' }} */}
{/*               /> */}
{/*             )} */}
{/*           </Grid> */}
{/*           <Grid xs={12} md={3} lg={6}> */}
{/*             {pastSixMonthsAccountsUsage.length === 0 ? ( */}
{/*               <Typography>No data available for Total Usage for All Accounts</Typography> */}
{/*             ) : ( */}
{/*               <UsageForAccounts */}
{/*                 title="Total Usage for All Accounts" */}
{/*                 subheader="Past 6 Months" */}
{/*                 chart={{ */}
{/*                   categories: pastSixMonthsAccountsUsage.map((month) => month.label), */}
{/*                   series: { name: 'Data Usage', data: pastSixMonthsAccountsUsage.map((month) => month.value) }, */}
{/*                 }} */}
{/*                 sx={{ minHeight: '400px', width: '100%' }} */}
{/*               /> */}
{/*             )} */}
{/*           </Grid> */}
{/*           <Grid xs={12} md={3} lg={6}> */}
{/*             {topAccountsUsage.series.length === 0 ? ( */}
{/*               <Typography>No data available for Top Accounts by Usage</Typography> */}
{/*             ) : ( */}
{/*               <UsageForAccounts */}
{/*                 title="Top Accounts by Usage" */}
{/*                 subheader="Last Two Months" */}
{/*                 chart={{ */}
{/*                   categories: topAccountsUsage.months, */}
{/*                   series: topAccountsUsage.series[0], */}
{/*                 }} */}
{/*                 sx={{ minHeight: '400px', width: '100%' }} */}
{/*               /> */}
{/*             )} */}
{/*           </Grid> */}
{/*         </Grid> */}
{/*       </Grid> */}
</Box>
    </Box>
  );

}

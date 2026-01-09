// import React, { useState, useEffect } from 'react';

// import Box from '@mui/material/Box';
// import Grid from '@mui/material/Unstable_Grid2';
// import Typography from '@mui/material/Typography';
// import SimCardIcon from '@mui/icons-material/SimCard';
// import AssignmentIcon from '@mui/icons-material/Assignment';
// import AccountCircleIcon from '@mui/icons-material/AccountCircle';
// import CurrencyPoundIcon from '@mui/icons-material/CurrencyPound';

// import {
//   fetchBillingHistory,
//   fetchSimTotalHistory,
//   fetchTopAccountsBill,
//   fetchTopAccountsSims,
//   fetchCdrRecordsHistory,
//   fetchDataUsageByNetwork,
//   fetchTotalAccountsHistory,
//   fetchTopAccountsBillAndUsage
// } from 'src/services/analyticsService';

// import { AIChatbot } from 'src/components/chatbot/AIChatbot'; // Import the chatbot component

// import { AnalyticsTopAccountsBill } from 'src/components/charts/AnalyticsTopAccountsBill';

// import { AnalyticsAccountsBySims } from 'src/sections/overview/analytics-accounts-by-sims';
// import { AnalyticsTopAccountsUsage } from 'src/sections/overview/analytics-top-accounts-usage';

// import { DataUsageDonutChart } from '../DataUsageDonutChart';
// import { AnalyticsWidgetSummary } from '../analytics-widget-summary';

// // Custom hook for fetching data
// const useFetchData = (
//   fetchFunction: () => Promise<any>,
//   setData: React.Dispatch<React.SetStateAction<any[]>>,
//   errorMessage: string
// ) => {
//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const data = await fetchFunction();
//         setData(data);
//       } catch (error) {
//         console.error(errorMessage, error);
//       }
//     };
//     fetchData();
//   }, [fetchFunction, setData, errorMessage]);
// };

// interface TopAccountData {
//   name: string;
//   data: number[];
// }

// export function OverviewAnalyticsView() {
//   const [dataUsageByNetwork, setDataUsageByNetwork] = useState<{ label: string; value: number }[]>(
//     []
//   );
//   const [cdrHistoryData, setCdrHistoryData] = useState<{ label: string; value: number }[]>([]);
//   const [billingHistoryData, setBillingHistoryData] = useState<{ label: string; value: number }[]>(
//     []
//   );
//   const [simTotalHistory, setSimTotalHistory] = useState<{ label: string; value: number }[]>([]);
//   const [totalAccountsHistory, setTotalAccountsHistory] = useState<
//     { label: string; value: number }[]
//   >([]);
//   const [topAccountsBill, setTopAccountsBill] = useState<{ label: string; value: number }[]>([]);
//   const [topAccountsData, setTopAccountsData] = useState<TopAccountData[]>([]);
//   const [months, setMonths] = useState<string[]>([]); // State for months
//   const [topAccountsSims, setTopAccountsSims] = useState<{ label: string; value: string; total: number }[]>([]);

//   // Use custom hook for data fetching
//   useFetchData(
//     fetchDataUsageByNetwork,
//     setDataUsageByNetwork,
//     'Failed to fetch data usage by network:'
//   );
//   useFetchData(fetchCdrRecordsHistory, setCdrHistoryData, 'Failed to fetch CDR history data:');
//   useFetchData(fetchBillingHistory, setBillingHistoryData, 'Failed to fetch billing history data:');
//   useFetchData(fetchSimTotalHistory, setSimTotalHistory, 'Failed to fetch sim total history data:');
//   useFetchData(
//     fetchTotalAccountsHistory,
//     setTotalAccountsHistory,
//     'Failed to fetch total accounts history data:'
//   );
//   useFetchData(fetchTopAccountsBill, setTopAccountsBill, 'Failed to fetch top accounts bill data:');
//   useFetchData(fetchTopAccountsSims, setTopAccountsSims, 'Failed to fetch top accounts sims data:');
//   useEffect(() => {
//     const getData = async () => {
//       const { series, months: fetchedMonths } = await fetchTopAccountsBillAndUsage(); // Destructure the response
//       setTopAccountsData(series); // Set the series data
//       setMonths(fetchedMonths); // Set the months state
//     };
//     getData();
//   }, []);

//   return (
//     <Box
//       sx={{
//         width: '100%',
//         height: '100%',
//         padding: 3, // Add some padding
//         boxSizing: 'border-box', // Ensure padding is included in total width/height
//         overflow: 'auto', // Allow scrolling within this container
//       }}
//     >
//       <Typography variant="h4" sx={{ paddingLeft: 1, mb: { xs: 1, md: 2 } }}>
//         Dashboard
//       </Typography>

//       <Grid container spacing={3} sx={{ height: 'calc(100% - 64px)', display: 'flex' }}>
//         {' '}
//         {/* Adjust height to account for heading */}
//         <Grid xs={12} sm={6} md={3}>
//           <AnalyticsWidgetSummary
//             title="Total Accounts"
//             percent={
//               totalAccountsHistory.length > 1
//                 ? ((totalAccountsHistory[totalAccountsHistory.length - 1].value -
//                     totalAccountsHistory[totalAccountsHistory.length - 2].value) /
//                     totalAccountsHistory[totalAccountsHistory.length - 2].value) *
//                   100
//                 : 0
//             }
//             total={
//               totalAccountsHistory.length > 0
//                 ? totalAccountsHistory[totalAccountsHistory.length - 1].value
//                 : 0
//             }
//             color="error"
//             icon={<AccountCircleIcon sx={{ fontSize: 40 }} />}
//             chart={{
//               categories: totalAccountsHistory.map((account) => account.label),
//               series: totalAccountsHistory.map((account) => account.value),
//             }}
//           />
//         </Grid>
//         <Grid xs={12} sm={6} md={3}>
//           <AnalyticsWidgetSummary
//             title="Billing History"
//             percent={
//               billingHistoryData.length > 1
//                 ? ((billingHistoryData[billingHistoryData.length - 1].value -
//                     billingHistoryData[billingHistoryData.length - 2].value) /
//                     billingHistoryData[billingHistoryData.length - 2].value) *
//                   100
//                 : 0
//             }
//             total={
//               billingHistoryData.length > 0
//                 ? billingHistoryData[billingHistoryData.length - 1].value
//                 : 0
//             }
//             color="secondary"
//             icon={<CurrencyPoundIcon sx={{ fontSize: 40 }} />}
//             chart={{
//               categories: billingHistoryData.map((item) => item.label),
//               series: billingHistoryData.map((item) => item.value),
//             }}
//           />
//         </Grid>
//         <Grid xs={12} sm={6} md={3}>
//           <AnalyticsWidgetSummary
//             title="Total SIMs"
//             percent={
//               simTotalHistory.length > 1
//                 ? ((simTotalHistory[simTotalHistory.length - 1].value -
//                     simTotalHistory[simTotalHistory.length - 2].value) /
//                     simTotalHistory[simTotalHistory.length - 2].value) *
//                   100
//                 : 0
//             }
//             total={
//               simTotalHistory.length > 0 ? simTotalHistory[simTotalHistory.length - 1].value : 0
//             }
//             color="warning"
//             icon={<SimCardIcon sx={{ fontSize: 40 }} />}
//             chart={{
//               categories: simTotalHistory.map((sim) => sim.label),
//               series: simTotalHistory.map((sim) => sim.value),
//             }}
//           />
//         </Grid>
//         <Grid xs={12} sm={6} md={3}>
//           <AnalyticsWidgetSummary
//             title="Monthly CDRs"
//             percent={
//               cdrHistoryData.length > 1
//                 ? ((cdrHistoryData[cdrHistoryData.length - 1].value -
//                     cdrHistoryData[cdrHistoryData.length - 2].value) /
//                     cdrHistoryData[cdrHistoryData.length - 2].value) *
//                   100
//                 : 0
//             }
//             total={cdrHistoryData.length > 0 ? cdrHistoryData[cdrHistoryData.length - 1].value : 0}
//             icon={<AssignmentIcon sx={{ fontSize: 40 }} />}
//             chart={{
//               categories: cdrHistoryData.map((item) => item.label),
//               series: cdrHistoryData.map((item) => item.value),
//             }}
//           />
//         </Grid>
//         <Grid xs={12} md={6} lg={4} sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
//           <DataUsageDonutChart
//             title="Data Usage by Network"
//             chart={{
//               series: dataUsageByNetwork,
//             }}
//             sx={{ flexGrow: 1 }}
//           />
//         </Grid>
//         <Grid xs={12} md={6} lg={8} sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
//           <AnalyticsTopAccountsBill
//             title="Top 10 Accounts by Bill"
//             subheader="Last month's top 10 accounts"
//             chart={{
//               categories: topAccountsBill.map((account) => account.label),
//               series: {
//                 name: 'Billing',
//                 data: topAccountsBill.map((account) => account.value),
//               },
//             }}
//           />
//           {/* <AnalyticsWebsiteVisits
//             title="Top Accounts by Bill"
//             subheader="Last month's top 10 accounts"
//             chart={{
//               categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
//               series: [
//                 { name: 'Network A', data: [43, 33, 22, 37, 67, 68, 37, 24, 55] },
//                 { name: 'Network B', data: [51, 70, 47, 67, 40, 37, 24, 70, 24] },
//               ],
//             }}
//             sx={{ flexGrow: 1 }}
//           /> */}
//         </Grid>
//         <Grid xs={12}>
//           <AIChatbot />
//         </Grid>
//         <Grid xs={12} md={6} lg={8}>
//           <AnalyticsTopAccountsUsage
//             title="Total SIMs Per Account"
//             subheader="Current SIM Count Per Account"
//             chart={{
//               categories: topAccountsData.map(account => account.name), // Use account names for the y-axis
//               series: [
//                 {
//                   name: months[0], // Use formatted last month
//                   data: topAccountsData.map(account => account.data[0]), // Last month's total_usage_gb
//                 },
//                 {
//                   name: months[1], // Use formatted second last month
//                   data: topAccountsData.map(account => account.data[1]), // Second last month's total_usage_gb
//                 },
//               ],
//             }}
//           />
//         </Grid>
        
//         {/* <Grid xs={12} md={6} lg={4}>
//           <AnalyticsTrafficBySite
//             title="Traffic by site"
//             list={[
//               { value: 'facebook', label: 'Facebook', total: 323234 },
//               { value: 'google', label: 'Google', total: 341212 },
//               { value: 'linkedin', label: 'Linkedin', total: 411213 },
//               { value: 'twitter', label: 'Twitter', total: 443232 },
//             ]}
//           />
//         </Grid> */}

//         <Grid xs={12} md={6} lg={4}>
//           <AnalyticsAccountsBySims
//             title="Total SIMs Per Account"
//             subheader="Current SIM Count Per Account"
//             list={topAccountsSims}
//           />
//         </Grid>
//       </Grid>
//     </Box>
//   );
// }

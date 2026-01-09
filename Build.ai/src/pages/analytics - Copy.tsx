import { Box, Grid } from '@mui/material';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { AnalyticsTopAccountsBill } from 'src/components/charts/AnalyticsTopAccountsBill';

import { CONFIG } from 'src/config-global';
import { AnalyticsAccountsBySims } from 'src/sections/overview/analytics-accounts-by-sims';
import { AnalyticsTopAccountsUsage } from 'src/sections/overview/analytics-top-accounts-usage';

import {
  fetchTopAccountsByBill,
  fetchTopAccountsByUsage,
  fetchTopAccountsBySimCount,
} from 'src/services/analyticsService';

// ----------------------------------------------------------------------

// Custom hook for fetching data
const useFetchData = (
  fetchFunction: () => Promise<any>,
  setData: React.Dispatch<React.SetStateAction<any[]>>,
  errorMessage: string
) => {
  useEffect(() => {
    console.log("hola");
    const fetchData = async () => {
      try {
        const data = await fetchFunction();
        setData(data);
      } catch (error) {
        console.error(errorMessage, error);
      }
    };
    fetchData();
  }, [fetchFunction, setData, errorMessage]);
};

interface TopAccountData {
  name: string;
  data: number[];
}

export default function Page() {
  const [topAccountsBill, setTopAccountsBill] = useState<{ label: string; value: number }[]>([]);
  const [topAccountsSims, setTopAccountsSims] = useState<
    { label: string; value: string; total: number }[]
  >([]);
  const [topAccountsData, setTopAccountsData] = useState<TopAccountData[]>([]);
  const [months, setMonths] = useState<string[]>([]); // State for months

  useFetchData(fetchTopAccountsByBill, setTopAccountsBill, 'Failed to fetch top accounts bill data:');
  useFetchData(fetchTopAccountsByUsage, setTopAccountsSims, 'Failed to fetch top accounts sims data:');
  useEffect(() => {
  const getData = async () => {
    const usageData = await fetchTopAccountsByUsage(); // ✅ this returns { series, months }
    setTopAccountsData(usageData.series);
    setMonths(usageData.months);
  };
  getData();
}, []);


  return (
    <>
    <Helmet>
      <title> {`Analytics - ${CONFIG.appName}`}</title>
      <meta name="description" content="Analytics of Billing AI" />
      <meta name="keywords" content="react,material,kit,application,dashboard,admin,template" />
    </Helmet>

    <Box
      sx={{
        width: '100%',
        height: '100%',
        padding: 3,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      {/* ✅ Improved Grid Container Layout with Proper Spacing */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={8}>
          <AnalyticsTopAccountsUsage
            title="Top Accounts Usage"
            subheader="Total Usage for Current and Past Month"
            chart={{
              categories: topAccountsData.map((account) => account.name),
              series: [
                { name: months[0], data: topAccountsData.map((account) => account.data[0]) },
                { name: months[1], data: topAccountsData.map((account) => account.data[1]) },
              ],
            }}
          />
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <AnalyticsAccountsBySims
            title="Total SIMs Per Account"
            subheader="Current SIM Count Per Account"
            list={topAccountsSims}
          />
        </Grid>

        <Grid item xs={12} lg={12}>
          <AnalyticsTopAccountsBill
            title="Top 10 Accounts by Bill"
            subheader="Last month's top 10 accounts"
            chart={{
              categories: topAccountsBill.map((account) => account.label),
              series: {
                name: 'Billing',
                data: topAccountsBill.map((account) => account.value),
              },
            }}
          />
        </Grid>
      </Grid>
    </Box>
  </>
  );
}

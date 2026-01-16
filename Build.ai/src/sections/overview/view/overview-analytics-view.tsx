import React, { useEffect, useState, useRef, useCallback } from 'react';
import { styled } from '@mui/material/styles';
// import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, } from 'recharts';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import { uploadMVNECSV, uploadMasterCSV } from 'src/services/wholesaleService';

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
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import { BusinessOverviewComponent } from '../../../layouts/components/businessOverView';
import { useNavigationContext } from '../../../layouts/components/navigation-context';
import MetricsDashboard from '../../../layouts/components/performanceMetrics';
import { MVNEDashboard } from '../MVNEDashboard';

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

interface CSVUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}

const CSVUploadModal = ({ open, onClose, onUpload }: CSVUploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
      onClose();
      setFile(null);
    } catch (error) {
      // Error handled by parent alert
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'record_type', // WHOLESALE, RETAIL, PERFORMANCE, METRICS
      'year_month', 'billing_cycle', 'metric_date',
      // Wholesale specific
      'entity_id', 'plan_id', 'service_type', 'allowance_amount', 'usage_amount', 'billable_amount', 'rate_applied', 'line_item_amount',
      // Retail specific
      'sim_id', 'account_name', 'rate_plan', 'total_usage', 'total_bill',
      // Performance specific
      'account_segment', 'payment_performance_score', 'churn_risk_score', 'dispute_resolution_days', 'avg_revenue_per_sim', 'profitability_score',
      // Dashboard Metrics specific
      'total_revenue', 'gross_profit', 'net_profit', 'total_opex', 'total_cogs', 'active_accounts', 'active_sims'
    ];

    const sampleData = [
      // Wholesale
      ['WHOLESALE', '2024-11', '2024-11', '2024-11-01', '1', '101', 'data_domestic', '1000.0', '1250.5', '250.5', '2.5', '626.25', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      // Retail
      ['RETAIL', '2024-11', '2024-11', '2024-11-01', '', '', '', '', '', '', '', '', '2545123456', 'Coca-Cola', '10GB Internet', '8500', '12.50', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      // Performance
      ['PERFORMANCE', '2024-11', '2024-11', '2024-11-01', '', '', '', '', '', '', '', '', '', 'BMW', '', '', '', 'Enterprise', '95.5', '2.1', '3.5', '18.5', '85', '', '', '', '', '', '', ''],
      // Metrics
      ['METRICS', '2024-11', '2024-11', '2024-11-01', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '850000', '320000', '150000', '120000', '110000', '150', '4500']
    ];

    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'master_site_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Upload Master Site Data</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: '#6E6E73', mb: 3 }}>
          Upload a Master CSV file containing records for Wholesale, Retail, Performance, and Metrics.
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleDownloadTemplate}
            fullWidth
            sx={{ borderRadius: '8px', textTransform: 'none', py: 1 }}
          >
            Download Sample CSV Template
          </Button>
        </Box>


        <Divider sx={{ mb: 3 }}>OR</Divider>

        <Box
          sx={{
            border: '2px dashed #D2D2D7',
            borderRadius: '12px',
            p: 3,
            textAlign: 'center',
            backgroundColor: '#F5F5F7',
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#E8E8ED' }
          }}
          onClick={() => document.getElementById('modal-file-input')?.click()}
        >
          <input
            id="modal-file-input"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <CloudUploadIcon sx={{ fontSize: 40, color: '#86868B', mb: 1 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {file ? file.name : 'Click to select CSV file'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#86868B' }}>
            Supported format: .csv
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} sx={{ color: '#1D1D1F', textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={!file || uploading}
          sx={{
            borderRadius: '8px',
            backgroundColor: '#0071E3',
            '&:hover': { backgroundColor: '#0077ED' },
            textTransform: 'none',
            px: 3
          }}
        >
          {uploading ? 'Uploading...' : 'Upload Records'}
        </Button>
      </DialogActions>
    </Dialog>
  );
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
  const [mvneMetricsClicked, setMvneMetricsClicked] = useState(false);

  const handleBusinessClick = () => {
    setBusineeClicked(true);
    setPerformanceClicked(false);
    setMvneMetricsClicked(false);
  };

  const handlePerformanceClick = () => {
    setPerformanceClicked(true);
    setBusineeClicked(false);
    setMvneMetricsClicked(false);
  };

  const handleMvneClick = () => {
    setMvneMetricsClicked(true);
    setBusineeClicked(false);
    setPerformanceClicked(false);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Hide Tab Feature State
  const { hiddenTabs, hideTab, resetTabs } = useNavigationContext();
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; tabLabel: string } | null>(null);

  const handleContextMenu = (event: React.MouseEvent, tabLabel: string) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
          mouseX: event.clientX + 2,
          mouseY: event.clientY - 6,
          tabLabel,
        }
        : null,
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleHideTab = () => {
    if (contextMenu) {
      const { tabLabel } = contextMenu;
      hideTab(tabLabel);

      // If the hidden tab was the active one, switch to another visible tab
      if (tabLabel === 'Business Overview' && businessclicked) {
        if (!hiddenTabs.includes('Performance Metrics')) handlePerformanceClick();
        else if (!hiddenTabs.includes('MVNE Metrics')) handleMvneClick();
      } else if (tabLabel === 'Performance Metrics' && performanceClicked) {
        if (!hiddenTabs.includes('Business Overview')) handleBusinessClick();
        else if (!hiddenTabs.includes('MVNE Metrics')) handleMvneClick();
      } else if (tabLabel === 'MVNE Metrics' && mvneMetricsClicked) {
        if (!hiddenTabs.includes('Business Overview')) handleBusinessClick();
        else if (!hiddenTabs.includes('Performance Metrics')) handlePerformanceClick();
      }
    }
    handleCloseContextMenu();
  };

  const handleShowAllTabs = () => {
    resetTabs();
  };

  const isTabHidden = (tabLabel: string) => hiddenTabs.includes(tabLabel);

  const handleUploadFile = async (file: File) => {
    try {
      const response = await uploadMasterCSV(file);
      alert(response.message || 'Master Upload successful');
      setRefreshKey(prev => prev + 1); // Trigger data refresh
    } catch (error) {
      alert('Upload failed. Please check the file format.');
      throw error;
    }
  };

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{
        display: 'flex', justifyContent: 'space-between'
      }}>
        <CSVUploadModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onUpload={handleUploadFile}
        />
        <Box
          sx={{
            display: 'inline-flex',
            backgroundColor: '#f9fafb', // container background
            borderRadius: 2,
            p: 1,
            mb: 3,
            gap: 1
          }}
        >
          {/* Business Overview Button */}
          {!isTabHidden('Business Overview') && (
            <Box
              onClick={handleBusinessClick}
              onContextMenu={(e) => handleContextMenu(e, 'Business Overview')}
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
          )}

          {/* Performance Metrics Button */}
          {!isTabHidden('Performance Metrics') && (
            <Box
              onClick={handlePerformanceClick}
              onContextMenu={(e) => handleContextMenu(e, 'Performance Metrics')}
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
          )}

          {/* MVNE Metrics Button */}
          {!isTabHidden('MVNE Metrics') && (
            <Box
              onClick={handleMvneClick}
              onContextMenu={(e) => handleContextMenu(e, 'MVNE Metrics')}
              sx={{
                px: 3,
                py: 1,
                borderRadius: 1,
                cursor: 'pointer',
                backgroundColor: mvneMetricsClicked ? '#fff' : 'transparent',
                color: mvneMetricsClicked ? 'black' : '#64748b',
                fontWeight: mvneMetricsClicked ? 'bold' : 500,
                boxShadow: mvneMetricsClicked ? 1 : 'none',
                transition: 'all 0.2s ease-in-out',
              }}
            >
              MVNE Metrics
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hiddenTabs.length > 0 && (
            <IconButton
              onClick={handleShowAllTabs}
              sx={{
                color: '#22c55e', // green colour
                backgroundColor: '#fff',
                boxShadow: 1,
                height: '40px',
                width: '40px',
                mt: 1,
                '&:hover': {
                  backgroundColor: '#f8f9fa',
                  boxShadow: 2,
                },
              }}
            >
              <VisibilityIcon />
            </IconButton>
          )}
          <Box
            onClick={() => setModalOpen(true)}
            sx={{
              px: 3,
              py: 1,
              mt: 1,
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
              '&:hover': {
                backgroundColor: '#f8f9fa',
                boxShadow: 2,
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            Upload csv
          </Box>
        </Box>

        <Menu
          open={contextMenu !== null}
          onClose={handleCloseContextMenu}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : undefined
          }
        >
          <MenuItem onClick={handleHideTab}>Hide Tab</MenuItem>
        </Menu>

      </Box>
      <Box id='layout' >
        {businessclicked && <BusinessOverviewComponent key={`biz-${refreshKey}`} />}
        {performanceClicked && <MetricsDashboard key={`perf-${refreshKey}`} />}
        {mvneMetricsClicked && <MVNEDashboard key={`mvne-${refreshKey}`} />}

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

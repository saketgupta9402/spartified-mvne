import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Box,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  TablePagination,
  TextField,
  TableSortLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CONFIG } from 'src/config-global';
import { fetchWholesalePlans, createWholesalePlan, fetchSIMMapping, fetchWholesaleAnalytics } from 'src/services/wholesaleService';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';

interface WholesalePlan {
  wholesale_plan_name: string;
  allowance: number;
  plan_type: 'individual' | 'pool';
  fee: number;
  out_of_bundle_rate_home: number;
  out_of_bundle_rate_roaming: number;
}

interface SIMMapping {
  account_name: string;
  sim_id: string;
  retail_plan: string;
  total_usage: number;
  billing_cycle: string;
  wholesale_plan: string;
}

type Order = 'asc' | 'desc';
type FilterType = 'exact' | 'contains';

// Styled components
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1.5),
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const HeaderBox = styled(Box)(({ theme }) => ({
  backgroundColor: '#1D1D1F',
  color: '#F5F5F7',
  padding: theme.spacing(2),
  borderRadius: '8px 8px 0 0',
}));

const HeaderCell = styled(StyledTableCell)(({ theme }) => ({
  backgroundColor: '#F5F5F7',
  color: '#1D1D1F',
  fontWeight: '600',
  fontSize: '0.95rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  padding: theme.spacing(2),
  boxShadow: 'inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
}));

const AppleCard = styled(Card)(({ theme }) => ({
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
  },
}));

const useFetchData = <T,>(
  fetchFunction: (params: {
    page: number;
    rowsPerPage: number;
    search: string;
    searchField: keyof T;
    filterType: FilterType;
    sortBy: keyof T;
    sortOrder: Order;
  }) => Promise<{ data: T[]; total: number }>,
  setData: React.Dispatch<React.SetStateAction<T[]>>,
  setTotal: React.Dispatch<React.SetStateAction<number>>,
  page: number,
  rowsPerPage: number,
  search: string,
  searchField: keyof T,
  filterType: FilterType,
  sortBy: keyof T,
  sortOrder: Order,
  errorMessage: string
) => {
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, total } = await fetchFunction({
          page,
          rowsPerPage,
          search: search.toLowerCase(),
          searchField,
          filterType,
          sortBy,
          sortOrder,
        });
        setData(data);
        setTotal(total);
      } catch (error) {
        console.error(errorMessage, error);
      }
    };
    fetchData();
  }, [fetchFunction, setData, setTotal, page, rowsPerPage, search, searchField, filterType, sortBy, sortOrder, errorMessage]);
};

export default function WholesalePage() {
  const [tabValue, setTabValue] = useState(0);
  const [wholesalePlans, setWholesalePlans] = useState<WholesalePlan[]>([]);
  const [simMapping, setSIMMapping] = useState<SIMMapping[]>([]);
  const [totalPlans, setTotalPlans] = useState<number>(0);
  const [totalMappings, setTotalMappings] = useState<number>(0);
  const [pagePlans, setPagePlans] = useState<number>(0);
  const [pageMappings, setPageMappings] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [searchPlans, setSearchPlans] = useState<string>('');
  const [searchMappings, setSearchMappings] = useState<string>('');
  const [searchFieldPlans, setSearchFieldPlans] = useState<keyof WholesalePlan>('wholesale_plan_name');
  const [searchFieldMappings, setSearchFieldMappings] = useState<keyof SIMMapping>('sim_id');
  const [filterType, setFilterType] = useState<FilterType>('contains');
  const [sortByPlans, setSortByPlans] = useState<keyof WholesalePlan>('wholesale_plan_name');
  const [sortByMappings, setSortByMappings] = useState<keyof SIMMapping>('sim_id');
  const [sortOrder, setSortOrder] = useState<Order>('asc');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWholesalePlan, setNewWholesalePlan] = useState({
    wholesale_plan_name: '',
    allowance: 0,
    plan_type: 'individual' as 'individual' | 'pool',
    fee: 0,
    out_of_bundle_rate_home: 0,
    out_of_bundle_rate_roaming: 0,
  });
  const [analyticsData, setAnalyticsData] = useState<{
    billing_cycles: string[];
    retail_costs: number[];
    wholesale_costs: number[];
  }>({
    billing_cycles: [],
    retail_costs: [],
    wholesale_costs: [],
  });

  useFetchData(
    fetchWholesalePlans,
    setWholesalePlans,
    setTotalPlans,
    pagePlans,
    rowsPerPage,
    searchPlans,
    searchFieldPlans,
    filterType,
    sortByPlans,
    sortOrder,
    'Failed to fetch wholesale plans:'
  );

  useFetchData(
    fetchSIMMapping,
    setSIMMapping,
    setTotalMappings,
    pageMappings,
    rowsPerPage,
    searchMappings,
    searchFieldMappings,
    filterType,
    sortByMappings,
    sortOrder,
    'Failed to fetch SIM mapping:'
  );

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await fetchWholesaleAnalytics();
        setAnalyticsData(data);
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
      }
    };
    if (tabValue === 2) fetchAnalytics();
  }, [tabValue]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleChangePagePlans = (event: unknown, newPage: number) => {
    setPagePlans(newPage);
  };

  const handleChangePageMappings = (event: unknown, newPage: number) => {
    setPageMappings(newPage);
  };

  const handleChangeRowsPerPage = (event: SelectChangeEvent<number>) => {
    setRowsPerPage(parseInt(event.target.value as string, 10));
    setPagePlans(0);
    setPageMappings(0);
  };

  const handleSearchChangePlans = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchPlans(event.target.value);
    setPagePlans(0);
  };

  const handleSearchChangeMappings = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchMappings(event.target.value);
    setPageMappings(0);
  };

  const handleSearchFieldChangePlans = (event: SelectChangeEvent<string>) => {
    setSearchFieldPlans(event.target.value as keyof WholesalePlan);
    setPagePlans(0);
  };

  const handleSearchFieldChangeMappings = (event: SelectChangeEvent<string>) => {
    setSearchFieldMappings(event.target.value as keyof SIMMapping);
    setPageMappings(0);
  };

  const handleFilterTypeChange = (event: SelectChangeEvent<string>) => {
    setFilterType(event.target.value as FilterType);
    setPagePlans(0);
    setPageMappings(0);
  };

  const handleSortPlans = (column: keyof WholesalePlan) => () => {
    const isAsc = sortByPlans === column && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortByPlans(column);
  };

  const handleSortMappings = (column: keyof SIMMapping) => () => {
    const isAsc = sortByMappings === column && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortByMappings(column);
  };

  const handleCreateWholesalePlanClick = () => {
    setCreateDialogOpen(true);
  };

  const handleCreateWholesalePlan = async () => {
    try {
      await createWholesalePlan(newWholesalePlan);
      setCreateDialogOpen(false);
      setNewWholesalePlan({
        wholesale_plan_name: '',
        allowance: 0,
        plan_type: 'individual',
        fee: 0,
        out_of_bundle_rate_home: 0,
        out_of_bundle_rate_roaming: 0,
      });
      const { data, total } = await fetchWholesalePlans({
        page: pagePlans,
        rowsPerPage,
        search: searchPlans.toLowerCase(),
        searchField: searchFieldPlans,
        filterType,
        sortBy: sortByPlans,
        sortOrder,
      });
      setWholesalePlans(data);
      setTotalPlans(total);
    } catch (error) {
      console.error('Failed to create wholesale plan:', error);
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
  };

  const handleTextInputChange = (field: keyof WholesalePlan) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = field === 'wholesale_plan_name'
      ? event.target.value
      : parseFloat(event.target.value) || 0;
    setNewWholesalePlan((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: keyof WholesalePlan) => (
    event: SelectChangeEvent<string>
  ) => {
    const value = event.target.value;
    setNewWholesalePlan((prev) => ({ ...prev, [field]: value }));
  };

  const analyticsChartOptions: ApexOptions = {
    chart: { type: 'bar', height: 350 },
    plotOptions: { bar: { horizontal: false, columnWidth: '60%', borderRadius: 2 } },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    xaxis: {
      categories: analyticsData.billing_cycles,
      labels: { style: { colors: '#1D1D1F', fontFamily: '"SF Pro Text", sans-serif' } },
    },
    yaxis: {
      title: { text: 'Cost ($)', style: { color: '#6E6E73', fontFamily: '"SF Pro Text", sans-serif' } },
      labels: { style: { colors: '#1D1D1F', fontFamily: '"SF Pro Text", sans-serif' } },
    },
    fill: { opacity: 1, colors: ['#0071E3', '#FF6384'] },
    tooltip: { y: { formatter: (val) => `$${val.toLocaleString()}` } },
  };

  const analyticsChartSeries = [
    { name: 'Wholesale Plan', data: analyticsData.wholesale_costs },
    { name: 'Retail Plan', data: analyticsData.retail_costs },
  ];

  return (
    <>
      <Helmet>
        <title>{`Wholesale - ${CONFIG.appName}`}</title>
        <meta name="description" content="Wholesale Plan Management for Billing AI" />
        <meta name="keywords" content="react,material,kit,application,dashboard,admin,template" />
      </Helmet>

      <Box sx={{ width: '100%', height: '100%', padding: 3, boxSizing: 'border-box', backgroundColor: '#F5F5F7' }}>
        <AppleCard sx={{ p: 0, boxShadow: 3 }}>
          <HeaderBox>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#F5F5F7' }}>
              Wholesale
            </Typography>
          </HeaderBox>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{ backgroundColor: '#F5F5F7', borderBottom: '1px solid #E0E0E0' }}
          >
            <Tab label="Wholesale Plans" sx={{ fontFamily: '"SF Pro Text", sans-serif', color: '#1D1D1F' }} />
            <Tab label="SIM Mapping" sx={{ fontFamily: '"SF Pro Text", sans-serif', color: '#1D1D1F' }} />
            <Tab label="Analytics" sx={{ fontFamily: '"SF Pro Text", sans-serif', color: '#1D1D1F' }} />
          </Tabs>

          {/* Tab 1: Wholesale Plans */}
          {tabValue === 0 && (
            <Box>
              <Box sx={{ p: 2, display: 'flex', gap: 2, backgroundColor: '#FFFFFF' }}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ color: '#6E6E73' }}>Search Field</InputLabel>
                  <Select
                    value={searchFieldPlans}
                    onChange={handleSearchFieldChangePlans}
                    label="Search Field"
                    sx={{ backgroundColor: '#F5F5F7', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E0E0E0' } }}
                  >
                    <MenuItem value="wholesale_plan">Plan Name</MenuItem>
                    <MenuItem value="allowance">Allowance</MenuItem>
                    <MenuItem value="plan_type">Plan Type</MenuItem>
                    <MenuItem value="fee">Fee</MenuItem>
                    <MenuItem value="out_of_bundle_rate_home">OOB Rate Home</MenuItem>
                    <MenuItem value="out_of_bundle_rate_roaming">OOB Rate Roaming</MenuItem>
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ color: '#6E6E73' }}>Filter Type</InputLabel>
                  <Select
                    value={filterType}
                    onChange={handleFilterTypeChange}
                    label="Filter Type"
                    sx={{ backgroundColor: '#F5F5F7', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E0E0E0' } }}
                  >
                    <MenuItem value="exact">Exact</MenuItem>
                    <MenuItem value="contains">Contains</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={`Search ${searchFieldPlans.replace('_', ' ')}`}
                  variant="outlined"
                  size="small"
                  value={searchPlans}
                  onChange={handleSearchChangePlans}
                  sx={{ width: 250, '& .MuiOutlinedInput-root': { backgroundColor: '#F5F5F7' } }}
                />
                <Button
                  variant="contained"
                  sx={{ backgroundColor: '#0071E3', '&:hover': { backgroundColor: '#0077ED' } }}
                  onClick={handleCreateWholesalePlanClick}
                >
                  Create Wholesale Plan
                </Button>
              </Box>
              <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto', borderRadius: '0 0 8px 8px' }}>
                <Table stickyHeader sx={{ minWidth: 650 }}>
                  <TableHead>
                    <StyledTableRow>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByPlans === 'wholesale_plan_name'}
                          direction={sortByPlans === 'wholesale_plan_name' ? sortOrder : 'asc'}
                          onClick={handleSortPlans('wholesale_plan_name')}
                        >
                          Plan Name
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByPlans === 'allowance'}
                          direction={sortByPlans === 'allowance' ? sortOrder : 'asc'}
                          onClick={handleSortPlans('allowance')}
                        >
                          Allowance
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByPlans === 'plan_type'}
                          direction={sortByPlans === 'plan_type' ? sortOrder : 'asc'}
                          onClick={handleSortPlans('plan_type')}
                        >
                          Plan Type
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByPlans === 'fee'}
                          direction={sortByPlans === 'fee' ? sortOrder : 'asc'}
                          onClick={handleSortPlans('fee')}
                        >
                          Fee ($)
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByPlans === 'out_of_bundle_rate_home'}
                          direction={sortByPlans === 'out_of_bundle_rate_home' ? sortOrder : 'asc'}
                          onClick={handleSortPlans('out_of_bundle_rate_home')}
                        >
                          OOB Rate Home ($)
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByPlans === 'out_of_bundle_rate_roaming'}
                          direction={sortByPlans === 'out_of_bundle_rate_roaming' ? sortOrder : 'asc'}
                          onClick={handleSortPlans('out_of_bundle_rate_roaming')}
                        >
                          OOB Rate Roaming ($)
                        </TableSortLabel>
                      </HeaderCell>
                    </StyledTableRow>
                  </TableHead>
                  <TableBody>
                    {wholesalePlans.length > 0 ? (
                      wholesalePlans.map((row) => (
                        <StyledTableRow key={row.wholesale_plan_name}>
                          <StyledTableCell>{row.wholesale_plan_name}</StyledTableCell>
                          <StyledTableCell>{row.allowance}</StyledTableCell>
                          <StyledTableCell>{row.plan_type}</StyledTableCell>
                          <StyledTableCell>{row.fee.toFixed(2)}</StyledTableCell>
                          <StyledTableCell>{row.out_of_bundle_rate_home.toFixed(2)}</StyledTableCell>
                          <StyledTableCell>{row.out_of_bundle_rate_roaming.toFixed(2)}</StyledTableCell>
                        </StyledTableRow>
                      ))
                    ) : (
                      <StyledTableRow>
                        <StyledTableCell colSpan={6} align="center">
                          No data available
                        </StyledTableCell>
                      </StyledTableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 2, px: 3, pb: 2 }}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Rows per page</InputLabel>
                  <Select
                    value={rowsPerPage}
                    onChange={handleChangeRowsPerPage}
                    label="Rows per page"
                  >
                    {[10, 25, 50, 100].map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TablePagination
                  rowsPerPageOptions={[]}
                  component="div"
                  count={totalPlans}
                  rowsPerPage={rowsPerPage}
                  page={pagePlans}
                  onPageChange={handleChangePagePlans}
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
                  showFirstButton
                  showLastButton
                />
              </Box>
            </Box>
          )}

          {/* Tab 2: SIM Mapping */}
          {tabValue === 1 && (
            <Box>
              <Box sx={{ p: 2, display: 'flex', gap: 2, backgroundColor: '#FFFFFF' }}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ color: '#6E6E73' }}>Search Field</InputLabel>
                  <Select
                    value={searchFieldMappings}
                    onChange={handleSearchFieldChangeMappings}
                    label="Search Field"
                    sx={{ backgroundColor: '#F5F5F7', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E0E0E0' } }}
                  >
                    <MenuItem value="account_name">Account Name</MenuItem>
                    <MenuItem value="sim_id">SIM ID</MenuItem>
                    <MenuItem value="retail_plan">Retail Plan</MenuItem>
                    <MenuItem value="total_usage">Total Usage</MenuItem>
                    <MenuItem value="billing_cycle">Billing Cycle</MenuItem>
                    <MenuItem value="wholesale_plan">Wholesale Plan</MenuItem>
                  </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ color: '#6E6E73' }}>Filter Type</InputLabel>
                  <Select
                    value={filterType}
                    onChange={handleFilterTypeChange}
                    label="Filter Type"
                    sx={{ backgroundColor: '#F5F5F7', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E0E0E0' } }}
                  >
                    <MenuItem value="exact">Exact</MenuItem>
                    <MenuItem value="contains">Contains</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={`Search ${searchFieldMappings.replace('_', ' ')}`}
                  variant="outlined"
                  size="small"
                  value={searchMappings}
                  onChange={handleSearchChangeMappings}
                  sx={{ width: 250, '& .MuiOutlinedInput-root': { backgroundColor: '#F5F5F7' } }}
                />
              </Box>
              <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto', borderRadius: '0 0 8px 8px' }}>
                <Table stickyHeader sx={{ minWidth: 650 }}>
                  <TableHead>
                    <StyledTableRow>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByMappings === 'account_name'}
                          direction={sortByMappings === 'account_name' ? sortOrder : 'asc'}
                          onClick={handleSortMappings('account_name')}
                        >
                          Account Name
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByMappings === 'sim_id'}
                          direction={sortByMappings === 'sim_id' ? sortOrder : 'asc'}
                          onClick={handleSortMappings('sim_id')}
                        >
                          SIM ID
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByMappings === 'retail_plan'}
                          direction={sortByMappings === 'retail_plan' ? sortOrder : 'asc'}
                          onClick={handleSortMappings('retail_plan')}
                        >
                          Retail Plan
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByMappings === 'total_usage'}
                          direction={sortByMappings === 'total_usage' ? sortOrder : 'asc'}
                          onClick={handleSortMappings('total_usage')}
                        >
                          Total Usage (GB)
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByMappings === 'billing_cycle'}
                          direction={sortByMappings === 'billing_cycle' ? sortOrder : 'asc'}
                          onClick={handleSortMappings('billing_cycle')}
                        >
                          Billing Cycle
                        </TableSortLabel>
                      </HeaderCell>
                      <HeaderCell>
                        <TableSortLabel
                          active={sortByMappings === 'wholesale_plan'}
                          direction={sortByMappings === 'wholesale_plan' ? sortOrder : 'asc'}
                          onClick={handleSortMappings('wholesale_plan')}
                        >
                          Wholesale Plan
                        </TableSortLabel>
                      </HeaderCell>
                    </StyledTableRow>
                  </TableHead>
                  <TableBody>
                    {simMapping.length > 0 ? (
                      simMapping.map((row) => (
                        <StyledTableRow key={row.sim_id}>
                          <StyledTableCell>{row.account_name}</StyledTableCell>
                          <StyledTableCell>{row.sim_id}</StyledTableCell>
                          <StyledTableCell>{row.retail_plan}</StyledTableCell>
                          <StyledTableCell>{row.total_usage}</StyledTableCell>
                          <StyledTableCell>{row.billing_cycle}</StyledTableCell>
                          <StyledTableCell>{row.wholesale_plan}</StyledTableCell>
                        </StyledTableRow>
                      ))
                    ) : (
                      <StyledTableRow>
                        <StyledTableCell colSpan={6} align="center">
                          No data available
                        </StyledTableCell>
                      </StyledTableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 2, px: 3, pb: 2 }}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Rows per page</InputLabel>
                  <Select
                    value={rowsPerPage}
                    onChange={handleChangeRowsPerPage}
                    label="Rows per page"
                  >
                    {[10, 25, 50, 100].map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TablePagination
                  rowsPerPageOptions={[]}
                  component="div"
                  count={totalMappings}
                  rowsPerPage={rowsPerPage}
                  page={pageMappings}
                  onPageChange={handleChangePageMappings}
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
                  showFirstButton
                  showLastButton
                />
              </Box>
            </Box>
          )}

          {/* Tab 3: Analytics */}
          {tabValue === 2 && (
            <Box sx={{ p: 3 }}>
              <Typography
                variant="h6"
                sx={{ fontFamily: '"SF Pro Display", sans-serif', color: '#1D1D1F', mb: 2 }}
              >
                Wholesale vs Retail Billing Comparison (Last 6 Cycles)
              </Typography>
              <Chart
                options={analyticsChartOptions}
                series={analyticsChartSeries}
                type="bar"
                height={350}
                width="100%"
              />
            </Box>
          )}
        </AppleCard>
      </Box>

      {/* Create Wholesale Plan Dialog */}
      <Dialog open={createDialogOpen} onClose={handleDialogClose} aria-labelledby="create-wholesale-plan-dialog-title">
        <DialogTitle id="create-wholesale-plan-dialog-title">Create New Wholesale Plan</DialogTitle>
        <DialogContent>
          <DialogContentText>Please enter the details for the new wholesale plan.</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Wholesale Plan Name"
            fullWidth
            value={newWholesalePlan.wholesale_plan_name}
            onChange={handleTextInputChange('wholesale_plan_name')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Allowance"
            type="number"
            fullWidth
            value={newWholesalePlan.allowance}
            onChange={handleTextInputChange('allowance')}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Plan Type</InputLabel>
            <Select
              value={newWholesalePlan.plan_type}
              onChange={handleSelectChange('plan_type')}
              label="Plan Type"
            >
              <MenuItem value="individual">Individual</MenuItem>
              <MenuItem value="pool">Pool</MenuItem>
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Fee ($)"
            type="number"
            fullWidth
            value={newWholesalePlan.fee}
            onChange={handleTextInputChange('fee')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Out of Bundle Rate Home ($)"
            type="number"
            fullWidth
            value={newWholesalePlan.out_of_bundle_rate_home}
            onChange={handleTextInputChange('out_of_bundle_rate_home')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Out of Bundle Rate Roaming ($)"
            type="number"
            fullWidth
            value={newWholesalePlan.out_of_bundle_rate_roaming}
            onChange={handleTextInputChange('out_of_bundle_rate_roaming')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleCreateWholesalePlan} color="primary">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
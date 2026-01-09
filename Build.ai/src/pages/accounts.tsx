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
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CONFIG } from 'src/config-global';
import { fetchAccountInfo } from 'src/services/accountService';

interface AccountInfo {
  account_name: string;
  sim_id: string;
  rate_plan: string;
  billing_cycle: string;
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
  backgroundColor: '#1d1d1f',
  color: '#f5f5f7',
  padding: theme.spacing(2),
  borderRadius: '8px 8px 0 0',
}));

const HeaderCell = styled(StyledTableCell)(({ theme }) => ({
  backgroundColor: '#f5f5f7',
  color: '#1d1d1f',
  fontWeight: '600',
  fontSize: '0.95rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  padding: theme.spacing(2),
  boxShadow: 'inset 0 -1px 0 rgba(0, 0, 0, 0.1)',
}));

const useFetchData = (
  fetchFunction: (params: {
    page: number;
    rowsPerPage: number;
    search: string;
    searchField: 'account_name' | 'sim_id';
    filterType: FilterType;
    sortBy: keyof AccountInfo;
    sortOrder: Order;
    exportAll?: boolean;
  }) => Promise<{ data: AccountInfo[]; total: number }>,
  setData: React.Dispatch<React.SetStateAction<AccountInfo[]>>,
  setTotal: React.Dispatch<React.SetStateAction<number>>,
  page: number,
  rowsPerPage: number,
  search: string,
  searchField: 'account_name' | 'sim_id',
  filterType: FilterType,
  sortBy: keyof AccountInfo,
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

// Function to convert data to CSV
const convertToCSV = (data: AccountInfo[]) => {
  const headers = ['Account Name,SIM ID,Rate Plan,Billing Cycle'];
  const rows = data.map(row => 
    `${row.account_name},${row.sim_id},${row.rate_plan},${row.billing_cycle}`
  );
  return headers.concat(rows).join('\n');
};

// Function to download CSV
const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export default function AccountsPage() {
  const [accountData, setAccountData] = useState<AccountInfo[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [searchField, setSearchField] = useState<'account_name' | 'sim_id'>('account_name');
  const [filterType, setFilterType] = useState<FilterType>('contains');
  const [sortBy, setSortBy] = useState<keyof AccountInfo>('sim_id');
  const [sortOrder, setSortOrder] = useState<Order>('asc');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useFetchData(
    fetchAccountInfo,
    setAccountData,
    setTotalRows,
    page,
    rowsPerPage,
    search,
    searchField,
    filterType,
    sortBy,
    sortOrder,
    'Failed to fetch account info data:'
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: SelectChangeEvent<number>) => {
    setRowsPerPage(parseInt(event.target.value as string, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleSearchFieldChange = (event: SelectChangeEvent<string>) => {
    setSearchField(event.target.value as 'account_name' | 'sim_id');
    setPage(0);
  };

  const handleFilterTypeChange = (event: SelectChangeEvent<string>) => {
    setFilterType(event.target.value as FilterType);
    setPage(0);
  };

  const handleSort = (column: keyof AccountInfo) => () => {
    const isAsc = sortBy === column && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(column);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = accountData.map(row => row.sim_id);
      setSelectedRows(newSelected);
    } else {
      setSelectedRows([]);
    }
  };

  const handleCheckboxClick = (sim_id: string) => {
    const selectedIndex = selectedRows.indexOf(sim_id);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selectedRows, sim_id);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selectedRows.slice(1));
    } else if (selectedIndex === selectedRows.length - 1) {
      newSelected = newSelected.concat(selectedRows.slice(0, -1));
    } else {
      newSelected = newSelected.concat(
        selectedRows.slice(0, selectedIndex),
        selectedRows.slice(selectedIndex + 1)
      );
    }

    setSelectedRows(newSelected);
  };

  const handleExportCSV = () => {
    if (selectedRows.length > 0) {
      const dataToExport = accountData.filter(row => selectedRows.includes(row.sim_id));
      const csv = convertToCSV(dataToExport);
      downloadCSV(csv, 'accounts_selected_export.csv');
    } else {
      setExportDialogOpen(true);
    }
  };

  const handleExportCurrentPage = () => {
    const csv = convertToCSV(accountData);
    downloadCSV(csv, 'accounts_current_page_export.csv');
    setExportDialogOpen(false);
  };

  const handleExportAll = async () => {
    try {
      const { data } = await fetchAccountInfo({
        page: 0, // These will be ignored by backend when exportAll is true
        rowsPerPage: 0,
        search: search.toLowerCase(),
        searchField,
        filterType,
        sortBy,
        sortOrder,
        exportAll: true, // Explicitly request all records
      });
      const csv = convertToCSV(data);
      downloadCSV(csv, 'accounts_all_export.csv');
    } catch (error) {
      console.error('Failed to export all records:', error);
    }
    setExportDialogOpen(false);
  };

  const handleChangeRatePlan = (sim_id: string) => {
    console.log(`Change rate plan for SIM ID: ${sim_id}`);
    // Implement actual logic here
  };

  const handleCdrLoaderClick = () => {
    console.log('CDR Loader clicked - Implement CDR loading logic here');
  };

  const handleSimOnboardingClick = () => {
    console.log('SIM Onboarding clicked - Implement SIM onboarding logic here');
  };

  const isSelected = (sim_id: string) => selectedRows.indexOf(sim_id) !== -1;

  return (
    <>
      <Helmet>
        <title>{`Accounts - ${CONFIG.appName}`}</title>
        <meta name="description" content="Account Information for Billing AI" />
        <meta name="keywords" content="react,material,kit,application,dashboard,admin,template" />
      </Helmet>

      <Box sx={{ width: '100%', height: '100%', padding: 3, boxSizing: 'border-box' }}>
        <Card sx={{ p: 0, boxShadow: 3 }}>
          <HeaderBox sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#f5f5f7' }}>
              Accounts
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: '#a1a1a6' }}>Search Field</InputLabel>
                <Select
                  value={searchField}
                  onChange={handleSearchFieldChange}
                  label="Search Field"
                  sx={{
                    backgroundColor: '#2d2d2f',
                    color: '#f5f5f7',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424245' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6e6e73' },
                  }}
                >
                  <MenuItem value="account_name">Account Name</MenuItem>
                  <MenuItem value="sim_id">SIM ID</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: '#a1a1a6' }}>Filter Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={handleFilterTypeChange}
                  label="Filter Type"
                  sx={{
                    backgroundColor: '#2d2d2f',
                    color: '#f5f5f7',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424245' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6e6e73' },
                  }}
                >
                  <MenuItem value="exact">Exact</MenuItem>
                  <MenuItem value="contains">Contains</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={`Search ${searchField === 'account_name' ? 'Account Name' : 'SIM ID'}`}
                variant="outlined"
                size="small"
                value={search}
                onChange={handleSearchChange}
                sx={{
                  width: 250,
                  '& .MuiOutlinedInput-root': { backgroundColor: '#2d2d2f', color: '#f5f5f7' },
                  '& .MuiInputLabel-root': { color: '#a1a1a6' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424245' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6e6e73' },
                }}
              />
              <Button
                variant="contained"
                sx={{ backgroundColor: '#0071e3', '&:hover': { backgroundColor: '#0077ed' } }}
                onClick={handleExportCSV}
              >
                Export CSV
              </Button>
              <Button
                variant="contained"
                sx={{ backgroundColor: '#0071e3', '&:hover': { backgroundColor: '#0077ed' } }}
                onClick={handleCdrLoaderClick}
              >
                CDR Loader
              </Button>
              <Button
                variant="contained"
                sx={{ backgroundColor: '#0071e3', '&:hover': { backgroundColor: '#0077ed' } }}
                onClick={handleSimOnboardingClick}
              >
                SIM Onboarding
              </Button>
            </Box>
          </HeaderBox>

          <TableContainer
            component={Paper}
            sx={{
              maxHeight: 600,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'grey.300',
              borderRadius: '0 0 8px 8px',
            }}
          >
            <Table stickyHeader sx={{ minWidth: 650 }}>
              <TableHead>
                <StyledTableRow>
                  <HeaderCell>
                    <Checkbox
                      indeterminate={selectedRows.length > 0 && selectedRows.length < accountData.length}
                      checked={accountData.length > 0 && selectedRows.length === accountData.length}
                      onChange={handleSelectAllClick}
                      sx={{ color: '#1d1d1f' }}
                    />
                  </HeaderCell>
                  <HeaderCell>
                    <TableSortLabel
                      active={sortBy === 'account_name'}
                      direction={sortBy === 'account_name' ? sortOrder : 'asc'}
                      onClick={handleSort('account_name')}
                    >
                      Account Name
                    </TableSortLabel>
                  </HeaderCell>
                  <HeaderCell>
                    <TableSortLabel
                      active={sortBy === 'sim_id'}
                      direction={sortBy === 'sim_id' ? sortOrder : 'asc'}
                      onClick={handleSort('sim_id')}
                    >
                      SIM ID
                    </TableSortLabel>
                  </HeaderCell>
                  <HeaderCell>
                    <TableSortLabel
                      active={sortBy === 'rate_plan'}
                      direction={sortBy === 'rate_plan' ? sortOrder : 'asc'}
                      onClick={handleSort('rate_plan')}
                    >
                      Rate Plan
                    </TableSortLabel>
                  </HeaderCell>
                  <HeaderCell>
                    <TableSortLabel
                      active={sortBy === 'billing_cycle'}
                      direction={sortBy === 'billing_cycle' ? sortOrder : 'asc'}
                      onClick={handleSort('billing_cycle')}
                    >
                      Billing Cycle
                    </TableSortLabel>
                  </HeaderCell>
                  <HeaderCell>Actions</HeaderCell>
                </StyledTableRow>
              </TableHead>
              <TableBody>
                {accountData.length > 0 ? (
                  accountData.map((row) => {
                    const isItemSelected = isSelected(row.sim_id);
                    return (
                      <StyledTableRow key={row.sim_id}>
                        <StyledTableCell>
                          <Checkbox
                            checked={isItemSelected}
                            onChange={() => handleCheckboxClick(row.sim_id)}
                          />
                        </StyledTableCell>
                        <StyledTableCell>{row.account_name}</StyledTableCell>
                        <StyledTableCell>{row.sim_id}</StyledTableCell>
                        <StyledTableCell>{row.rate_plan}</StyledTableCell>
                        <StyledTableCell>{row.billing_cycle}</StyledTableCell>
                        <StyledTableCell>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleChangeRatePlan(row.sim_id)}
                            sx={{ borderColor: '#0071e3', color: '#0071e3' }}
                          >
                            Change Rate Plan
                          </Button>
                        </StyledTableCell>
                      </StyledTableRow>
                    );
                  })
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

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, px: 3, pb: 2 }}>
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
              count={totalRows}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
              showFirstButton
              showLastButton
            />
          </Box>
        </Card>
      </Box>

      {/* Export Confirmation Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        aria-labelledby="export-dialog-title"
      >
        <DialogTitle id="export-dialog-title">Export Options</DialogTitle>
        <DialogContent>
          <DialogContentText>
            No rows are selected. Would you like to export the current page or all records?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleExportCurrentPage} color="primary">
            Export Current Page
          </Button>
          <Button onClick={handleExportAll} color="primary" autoFocus>
            Export All
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
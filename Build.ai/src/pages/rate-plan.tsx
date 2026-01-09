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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { CONFIG } from 'src/config-global';
import { fetchRatePlans, createRatePlan } from 'src/services/ratePlanService';

interface RatePlan {
  rate_plan: string;
  bundle_allowance: number;
  bundle_fee: number;
  home_rate: number;
  row_rate: number;
}

type Order = 'asc' | 'desc';
type FilterType = 'exact' | 'contains';

// Styled components (Apple-inspired from AccountsPage.tsx)
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
  backgroundColor: '#1D1D1F', // Dark gray header
  color: '#F5F5F7', // Light gray text
  padding: theme.spacing(2),
  borderRadius: '8px 8px 0 0',
}));

const HeaderCell = styled(StyledTableCell)(({ theme }) => ({
  backgroundColor: '#F5F5F7', // Light gray header cells
  color: '#1D1D1F', // Dark gray text
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
    searchField: keyof RatePlan;
    filterType: FilterType;
    sortBy: keyof RatePlan;
    sortOrder: Order;
  }) => Promise<{ data: RatePlan[]; total: number }>,
  setData: React.Dispatch<React.SetStateAction<RatePlan[]>>,
  setTotal: React.Dispatch<React.SetStateAction<number>>,
  page: number,
  rowsPerPage: number,
  search: string,
  searchField: keyof RatePlan,
  filterType: FilterType,
  sortBy: keyof RatePlan,
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

export default function RatePlanPage() {
  const [ratePlanData, setRatePlanData] = useState<RatePlan[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [searchField, setSearchField] = useState<keyof RatePlan>('rate_plan');
  const [filterType, setFilterType] = useState<FilterType>('contains');
  const [sortBy, setSortBy] = useState<keyof RatePlan>('rate_plan');
  const [sortOrder, setSortOrder] = useState<Order>('asc');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRatePlan, setNewRatePlan] = useState({
    rate_plan: '',
    bundle_allowance: 0,
    bundle_fee: 0,
    home_rate: 0,
    row_rate: 0,
  });

  useFetchData(
    fetchRatePlans,
    setRatePlanData,
    setTotalRows,
    page,
    rowsPerPage,
    search,
    searchField,
    filterType,
    sortBy,
    sortOrder,
    'Failed to fetch rate plan data:'
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
    setSearchField(event.target.value as keyof RatePlan);
    setPage(0);
  };

  const handleFilterTypeChange = (event: SelectChangeEvent<string>) => {
    setFilterType(event.target.value as FilterType);
    setPage(0);
  };

  const handleSort = (column: keyof RatePlan) => () => {
    const isAsc = sortBy === column && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(column);
  };

  const handleCreateRatePlanClick = () => {
    setCreateDialogOpen(true);
  };

  const handleCreateRatePlan = async () => {
    try {
      await createRatePlan(newRatePlan);
      setCreateDialogOpen(false);
      setNewRatePlan({ rate_plan: '', bundle_allowance: 0, bundle_fee: 0, home_rate: 0, row_rate: 0 });
      // Refresh data
      const { data, total } = await fetchRatePlans({
        page,
        rowsPerPage,
        search: search.toLowerCase(),
        searchField,
        filterType,
        sortBy,
        sortOrder,
      });
      setRatePlanData(data);
      setTotalRows(total);
    } catch (error) {
      console.error('Failed to create rate plan:', error);
    }
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
  };

  const handleInputChange = (field: keyof RatePlan) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'rate_plan' ? event.target.value : parseFloat(event.target.value) || 0;
    setNewRatePlan((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Helmet>
        <title>{`Rate Plans - ${CONFIG.appName}`}</title>
        <meta name="description" content="Rate Plan Management for Billing AI" />
        <meta name="keywords" content="react,material,kit,application,dashboard,admin,template" />
      </Helmet>

      <Box sx={{ width: '100%', height: '100%', padding: 3, boxSizing: 'border-box', backgroundColor: '#F5F5F7' }}>
        <Card sx={{ p: 0, boxShadow: 3 }}>
          <HeaderBox sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#F5F5F7' }}>
              Rate Plans
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: '#A1A1A6' }}>Search Field</InputLabel>
                <Select
                  value={searchField}
                  onChange={handleSearchFieldChange}
                  label="Search Field"
                  sx={{
                    backgroundColor: '#2D2D2F',
                    color: '#F5F5F7',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424245' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6E6E73' },
                  }}
                >
                  <MenuItem value="rate_plan">Rate Plan</MenuItem>
                  <MenuItem value="bundle_allowance">Bundle Allowance</MenuItem>
                  <MenuItem value="bundle_fee">Bundle Fee</MenuItem>
                  <MenuItem value="home_rate">Home Rate</MenuItem>
                  <MenuItem value="row_rate">Row Rate</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: '#A1A1A6' }}>Filter Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={handleFilterTypeChange}
                  label="Filter Type"
                  sx={{
                    backgroundColor: '#2D2D2F',
                    color: '#F5F5F7',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424245' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6E6E73' },
                  }}
                >
                  <MenuItem value="exact">Exact</MenuItem>
                  <MenuItem value="contains">Contains</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={`Search ${searchField.replace('_', ' ')}`}
                variant="outlined"
                size="small"
                value={search}
                onChange={handleSearchChange}
                sx={{
                  width: 250,
                  '& .MuiOutlinedInput-root': { backgroundColor: '#2D2D2F', color: '#F5F5F7' },
                  '& .MuiInputLabel-root': { color: '#A1A1A6' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#424245' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6E6E73' },
                }}
              />
              <Button
                variant="contained"
                sx={{ backgroundColor: '#0071E3', '&:hover': { backgroundColor: '#0077ED' } }}
                onClick={handleCreateRatePlanClick}
              >
                Create Rate Plan
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
              backgroundColor: '#FFFFFF',
            }}
          >
            <Table stickyHeader sx={{ minWidth: 650 }}>
              <TableHead>
                <StyledTableRow>
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
                      active={sortBy === 'bundle_allowance'}
                      direction={sortBy === 'bundle_allowance' ? sortOrder : 'asc'}
                      onClick={handleSort('bundle_allowance')}
                    >
                      Bundle Allowance
                    </TableSortLabel>
                  </HeaderCell>
                  <HeaderCell>
                    <TableSortLabel
                      active={sortBy === 'bundle_fee'}
                      direction={sortBy === 'bundle_fee' ? sortOrder : 'asc'}
                      onClick={handleSort('bundle_fee')}
                    >
                      Bundle Fee ($)
                    </TableSortLabel>
                  </HeaderCell>
                  <HeaderCell>
                    <TableSortLabel
                      active={sortBy === 'home_rate'}
                      direction={sortBy === 'home_rate' ? sortOrder : 'asc'}
                      onClick={handleSort('home_rate')}
                    >
                      Home Rate ($)
                    </TableSortLabel>
                  </HeaderCell>
                  <HeaderCell>
                    <TableSortLabel
                      active={sortBy === 'row_rate'}
                      direction={sortBy === 'row_rate' ? sortOrder : 'asc'}
                      onClick={handleSort('row_rate')}
                    >
                      Row Rate ($)
                    </TableSortLabel>
                  </HeaderCell>
                </StyledTableRow>
              </TableHead>
              <TableBody>
                {ratePlanData.length > 0 ? (
                  ratePlanData.map((row) => (
                    <StyledTableRow key={row.rate_plan}>
                      <StyledTableCell>{row.rate_plan}</StyledTableCell>
                      <StyledTableCell>{row.bundle_allowance}</StyledTableCell>
                      <StyledTableCell>{row.bundle_fee.toFixed(2)}</StyledTableCell>
                      <StyledTableCell>{row.home_rate.toFixed(2)}</StyledTableCell>
                      <StyledTableCell>{row.row_rate.toFixed(2)}</StyledTableCell>
                    </StyledTableRow>
                  ))
                ) : (
                  <StyledTableRow>
                    <StyledTableCell colSpan={5} align="center">
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

      {/* Create Rate Plan Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        aria-labelledby="create-rate-plan-dialog-title"
      >
        <DialogTitle id="create-rate-plan-dialog-title">Create New Rate Plan</DialogTitle>
        <DialogContent>
          <DialogContentText>Please enter the details for the new rate plan.</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Rate Plan Name"
            fullWidth
            value={newRatePlan.rate_plan}
            onChange={handleInputChange('rate_plan')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Bundle Allowance"
            type="number"
            fullWidth
            value={newRatePlan.bundle_allowance}
            onChange={handleInputChange('bundle_allowance')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Bundle Fee ($)"
            type="number"
            fullWidth
            value={newRatePlan.bundle_fee}
            onChange={handleInputChange('bundle_fee')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Home Rate ($)"
            type="number"
            fullWidth
            value={newRatePlan.home_rate}
            onChange={handleInputChange('home_rate')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Row Rate ($)"
            type="number"
            fullWidth
            value={newRatePlan.row_rate}
            onChange={handleInputChange('row_rate')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleCreateRatePlan} color="primary">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

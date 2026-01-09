// src/services/accountService.ts
import axios from 'axios';
import config from 'src/config-global';

interface AccountInfo {
  account_name: string;
  sim_id: string;
  rate_plan: string;
  billing_cycle: string;
}

interface FetchParams {
  page: number;
  rowsPerPage: number;
  search: string;
  searchField: 'account_name' | 'sim_id';
  filterType: 'exact' | 'contains';
  sortBy: keyof AccountInfo;
  sortOrder: 'asc' | 'desc';
  exportAll?: boolean;
}

export const fetchAccountInfo = async ({
  page,
  rowsPerPage,
  search,
  searchField,
  filterType,
  sortBy,
  sortOrder,
  exportAll = false,
}: FetchParams): Promise<{ data: AccountInfo[]; total: number }> => {
  try {
    const response = await axios.get(`${config.api_base_url}/get_account_info`, {
      params: {
        page: exportAll ? undefined : page + 1, // Omit page when exporting all
        limit: exportAll ? undefined : rowsPerPage, // omit limit when exporting all
        search,
        search_field: searchField,
        filter_type: filterType,
        sort_by: sortBy,
        sort_order: sortOrder,
        export_all: exportAll,
      },
    });
    return response.data; // Expecting { data: AccountInfo[], total: number }
  } catch (error) {
    console.error('Error fetching account info:', error);
    throw error;
  }
};
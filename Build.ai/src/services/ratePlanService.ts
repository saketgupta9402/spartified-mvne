import axios from 'axios';
import config from 'src/config-global';

interface RatePlan {
  rate_plan: string;
  bundle_allowance: number;
  bundle_fee: number;
  home_rate: number;
  row_rate: number;
}

interface FetchParams {
  page: number;
  rowsPerPage: number;
  search: string;
  searchField: keyof RatePlan;
  filterType: 'exact' | 'contains';
  sortBy: keyof RatePlan;
  sortOrder: 'asc' | 'desc';
}

export const fetchRatePlans = async ({
  page,
  rowsPerPage,
  search,
  searchField,
  filterType,
  sortBy,
  sortOrder,
}: FetchParams): Promise<{ data: RatePlan[]; total: number }> => {
  try {
    const response = await axios.get(`${config.api_base_url}/get_rate_plans`, {
      params: {
        page: page + 1, // Backend typically expects 1-based paging
        limit: rowsPerPage,
        search,
        search_field: searchField,
        filter_type: filterType,
        sort_by: sortBy,
        sort_order: sortOrder,
      },
    });
    return response.data; // Expecting { data: RatePlan[], total: number }
  } catch (error) {
    console.error('Error fetching rate plans:', error);
    throw error;
  }
};

export const createRatePlan = async (ratePlan: RatePlan): Promise<void> => {
  try {
    await axios.post(`${config.api_base_url}/create_rate_plan`, ratePlan);
  } catch (error) {
    console.error('Error creating rate plan:', error);
    throw error;
  }
};

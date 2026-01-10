import axios from 'axios';
import config from 'src/config-global';

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

interface FetchParams {
  page: number;
  rowsPerPage: number;
  search: string;
  searchField: keyof WholesalePlan | keyof SIMMapping;
  filterType: 'exact' | 'contains';
  sortBy: keyof WholesalePlan | keyof SIMMapping;
  sortOrder: 'asc' | 'desc';
}

export const fetchWholesalePlans = async ({
  page,
  rowsPerPage,
  search,
  searchField,
  filterType,
  sortBy,
  sortOrder,
}: FetchParams): Promise<{ data: WholesalePlan[]; total: number }> => {
  try {
    const response = await axios.get(`${config.api_base_url}/get_wholesale_plans`, {
      params: {
        page: page + 1,
        limit: rowsPerPage,
        search,
        search_field: searchField,
        filter_type: filterType,
        sort_by: sortBy,
        sort_order: sortOrder,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching wholesale plans:', error);
    throw error;
  }
};

export const createWholesalePlan = async (plan: WholesalePlan): Promise<void> => {
  try {
    await axios.post(`${config.api_base_url}/create_wholesale_plan`, plan);
  } catch (error) {
    console.error('Error creating wholesale plan:', error);
    throw error;
  }
};

export const fetchWholesaleAnalytics = async (): Promise<{
  billing_cycles: string[];
  retail_costs: number[];
  wholesale_costs: number[];
}> => {
  try {
    const response = await axios.get(`${config.api_base_url}/get_wholesale_analytics`);
    return response.data;
  } catch (error) {
    console.error('Error fetching wholesale analytics:', error);
    throw error;
  }
};

export const fetchSIMMapping = async ({
  page,
  rowsPerPage,
  search,
  searchField,
  filterType,
  sortBy,
  sortOrder,
}: FetchParams): Promise<{ data: SIMMapping[]; total: number }> => {
  try {
    const response = await axios.get(`${config.api_base_url}/get_sim_mapping`, {
      params: {
        page: page + 1,
        limit: rowsPerPage,
        search,
        search_field: searchField,
        filter_type: filterType,
        sort_by: sortBy,
        sort_order: sortOrder,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching SIM mapping:', error);
    throw error;
  }
};

// MVNE Service Functions
export const fetchMVNEEntities = async (params: any): Promise<{ data: any[]; total: number }> => {
  try {
    const response = await axios.get(`${config.api_base_url}/mvne/entities`, { params });
    // If backend doesn't return {data, total}, wrap it
    if (Array.isArray(response.data)) {
      return { data: response.data, total: response.data.length };
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching MVNE entities:', error);
    throw error;
  }
};

export const fetchMVNEPlans = async (params: any): Promise<{ data: any[]; total: number }> => {
  try {
    const response = await axios.get(`${config.api_base_url}/mvne/plans`, { params });
    if (Array.isArray(response.data)) {
      return { data: response.data, total: response.data.length };
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching MVNE plans:', error);
    throw error;
  }
};

export const fetchMVNEConsumption = async (params: any): Promise<{ data: any[]; total: number }> => {
  try {
    const response = await axios.get(`${config.api_base_url}/mvne/consumption`, { params });
    if (Array.isArray(response.data)) {
      return { data: response.data, total: response.data.length };
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching MVNE consumption:', error);
    throw error;
  }
};

export const fetchMVNEBillingSummary = async (params: any): Promise<{ data: any[]; total: number }> => {
  try {
    const response = await axios.get(`${config.api_base_url}/mvne/billing/summary`, { params });
    if (Array.isArray(response.data)) {
      return { data: response.data, total: response.data.length };
    }
    return response.data;
  } catch (error) {
    console.error('Error fetching MVNE billing summary:', error);
    throw error;
  }
};

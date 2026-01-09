// services/dashboardService.ts

import axios from 'axios';
import config from 'src/config-global';

const API_BASE_URL = config.api_base_url;

// Interface for dashboard API responses (matching your robust backend format)
interface DashboardApiResponse<T> {
  error: boolean;
  message: string;
  data: T;
}

// Interface for financial chart data
interface FinancialChartItem {
  month: string;
  revenue: number;
  grossprofit: number;  // Note: lowercase from your API
  netprofit: number;    // Note: lowercase from your API
  opex: number;
  cogs: number;
}

// Interface for transformed financial data (for charts)
interface TransformedFinancialData {
  month: string;
  Revenue: number;
  GrossProfit: number;
  NetProfit: number;
  OPEX: number;
  CoGS: number;
}

// ------------------- HELPER FUNCTIONS -------------------

// Helper function to handle API errors consistently (matching your pattern)
const handleApiError = (error: any, context: string): DashboardApiResponse<any[]> => {
  console.error(`Error fetching ${context}:`, error);
  if (error.response) {
    console.error('API Response:', error.response.data);
    console.error('Status:', error.response.status);
  } else if (error.request) {
    console.error('No response received for request:', error.request);
  } else {
    console.error('Error setting up request:', error.message);
  }
  
  // Return error format matching your backend
  return {
    error: true,
    message: `Failed to fetch ${context}: ${error.message}`,
    data: []
  };
};

// Helper to safely transform financial data
const safeTransformFinancialData = (
  data: any,
  caller: string
): TransformedFinancialData[] => {
  if (!Array.isArray(data)) {
    console.warn(`[${caller}] Expected array but received:`, typeof data, data);
    return [];
  }

  return data.map((item: FinancialChartItem, index: number) => {
    if (!item.month) {
      console.warn(`[${caller}] Missing month for item at index ${index}:`, item);
    }

    return {
      month: item.month || `Unknown_${index}`,
      Revenue: Number(item.revenue) || 0,
      GrossProfit: Number(item.grossprofit) || 0,  // Note: lowercase from API
      NetProfit: Number(item.netprofit) || 0,      // Note: lowercase from API
      OPEX: Number(item.opex) || 0,
      CoGS: Number(item.cogs) || 0,
    };
  });
};

// ------------------- DATA FETCH FUNCTIONS -------------------

export const fetchFinancialChartData = async (): Promise<DashboardApiResponse<TransformedFinancialData[]>> => {
  console.log('Fetching financial chart data from:', `${API_BASE_URL}/financial-chart-data`);
  try {
    const response = await axios.get<DashboardApiResponse<FinancialChartItem[]>>(`${API_BASE_URL}/financial-chart-data`);
    console.log('Raw financial response:', response.data);

    // Handle your robust backend response format
    if (response.data.error) {
      console.warn('API returned error:', response.data.message);
      return {
        error: true,
        message: response.data.message,
        data: []
      };
    }

    const transformedData = safeTransformFinancialData(response.data.data, 'fetchFinancialChartData');
    console.log('Financial Chart Data:', transformedData);
    
    if (transformedData.length === 0) {
      console.warn('No data returned for fetchFinancialChartData');
      // Fallback data matching your pattern
      return {
        error: false,
        message: 'Using fallback data',
        data: [
          { month: 'May', Revenue: 310474, GrossProfit: 192226, NetProfit: 159047, OPEX: 33179, CoGS: 118248 },
          { month: 'Jun', Revenue: 270336, GrossProfit: 187154, NetProfit: 140478, OPEX: 46677, CoGS: 83182 },
          { month: 'Jul', Revenue: 498023, GrossProfit: 250311, NetProfit: 161006, OPEX: 89305, CoGS: 247712 }
        ]
      };
    }

    return {
      error: false,
      message: 'Success',
      data: transformedData
    };
  } catch (error) {
    return handleApiError(error, 'financial chart data');
  }
};

export const fetchDashboardOverviewMetrics = async (): Promise<DashboardApiResponse<any[]>> => {
  console.log('Fetching dashboard overview metrics from:', `${API_BASE_URL}/dashboard-overview-metrics`);
  try {
    const response = await axios.get<DashboardApiResponse<any[]>>(`${API_BASE_URL}/dashboard-overview-metrics`);
    console.log('Raw overview metrics response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'dashboard overview metrics');
  }
};

export const fetchAccountGrowthChartData = async (): Promise<DashboardApiResponse<any[]>> => {
  console.log('Fetching account growth chart data from:', `${API_BASE_URL}/account-growth-chart-data`);
  try {
    const response = await axios.get<DashboardApiResponse<any[]>>(`${API_BASE_URL}/account-growth-chart-data`);
    console.log('Raw account growth response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'account growth chart data');
  }
};

export const fetchSIMTrendsChartData = async (): Promise<DashboardApiResponse<any[]>> => {
  console.log('Fetching SIM trends chart data from:', `${API_BASE_URL}/sim-trends-chart-data`);
  try {
    const response = await axios.get<DashboardApiResponse<any[]>>(`${API_BASE_URL}/sim-trends-chart-data`);
    console.log('Raw SIM trends response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'SIM trends chart data');
  }
};

export const fetchGoalsProgressData = async (): Promise<DashboardApiResponse<any[]>> => {
  console.log('Fetching goals progress data from:', `${API_BASE_URL}/goals-progress-data`);
  try {
    const response = await axios.get<DashboardApiResponse<any[]>>(`${API_BASE_URL}/goals-progress-data`);
    console.log('Raw goals progress response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'goals progress data');
  }
};

export const fetchAccountsReceivableData = async (): Promise<DashboardApiResponse<any[]>> => {
  console.log('Fetching accounts receivable data from:', `${API_BASE_URL}/accounts-receivable-data`);
  try {
    const response = await axios.get<DashboardApiResponse<any[]>>(`${API_BASE_URL}/accounts-receivable-data`);
    console.log('Raw accounts receivable response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'accounts receivable data');
  }
};

export const fetchTopAccountsTableData = async (): Promise<DashboardApiResponse<any[]>> => {
  console.log('Fetching top accounts table data from:', `${API_BASE_URL}/top-accounts-table-data`);
  try {
    const response = await axios.get<DashboardApiResponse<any[]>>(`${API_BASE_URL}/top-accounts-table-data`);
    console.log('Raw top accounts response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'top accounts table data');
  }
};

export const fetchDashboardSummaryStats = async (): Promise<DashboardApiResponse<any[]>> => {
  console.log('Fetching dashboard summary stats from:', `${API_BASE_URL}/dashboard-summary-stats`);
  try {
    const response = await axios.get<DashboardApiResponse<any[]>>(`${API_BASE_URL}/dashboard-summary-stats`);
    console.log('Raw summary stats response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'dashboard summary stats');
  }
};
// services/performanceService.ts - FIXED VERSION

import axios from 'axios';
import config from 'src/config-global';

const API_BASE_URL = config.api_base_url;

// Interface for performance API responses (matching your robust backend format)
interface PerformanceApiResponse<T> {
  error: boolean;
  message: string;
  data: T;
}

// Interface for KPI metrics
interface PerformanceKPIMetrics {
  payment_performance_value: number;
  payment_performance_change: number;
  payment_performance_type: string;
  churn_risk_value: string;
  churn_risk_change: number;
  churn_risk_type: string;
  avg_revenue_per_sim_value: string;
  avg_revenue_per_sim_change: number;
  avg_revenue_per_sim_type: string;
  dispute_resolution_value: string;
  dispute_resolution_change: number;
  dispute_resolution_type: string;
}

// Interface for revenue trend data
interface RevenueTrendData {
  month: string;
  revenue: number;
}

// Interface for profitability data
interface ProfitabilityData {
  segment: string;
  score: number;
}

// Interface for discount/credit utilization
interface DiscountCreditData {
  credit_utilization_percent: number;
  discount_usage_percent: number;
  avg_discount_rate: number;
}

// Interface for discount sensitivity
interface DiscountSensitivityData {
  high_sensitivity_percent: number;
  medium_sensitivity_percent: number;
  low_sensitivity_percent: number;
  optimal_discount_rate: number;
}

// Interface for revenue forecast
interface RevenueForecastData {
  q3_forecast_display: string;
  q4_forecast_display: string;
  yoy_growth_display: string;
  confidence_level_display: string;
}

// ------------------- HELPER FUNCTIONS -------------------

// Helper function to handle API errors consistently
const handleApiError = (error: any, context: string): PerformanceApiResponse<any[]> => {
  console.error(`Error fetching ${context}:`, error);
  if (error.response) {
    console.error('API Response:', error.response.data);
    console.error('Status:', error.response.status);
  } else if (error.request) {
    console.error('No response received for request:', error.request);
  } else {
    console.error('Error setting up request:', error.message);
  }
  
  return {
    error: true,
    message: `Failed to fetch ${context}: ${error.message}`,
    data: []
  };
};

// ------------------- DATA FETCH FUNCTIONS -------------------

export const fetchPerformanceOverviewMetrics = async (): Promise<PerformanceApiResponse<PerformanceKPIMetrics[]>> => {
  console.log('Fetching performance overview metrics from:', `${API_BASE_URL}/performance/performance-overview-metrics`);
  try {
    const response = await axios.get<PerformanceApiResponse<PerformanceKPIMetrics[]>>(`${API_BASE_URL}/performance/performance-overview-metrics`);
    console.log('Raw performance overview response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'performance overview metrics');
  }
};

export const fetchRevenuePerSimTrend = async (): Promise<PerformanceApiResponse<RevenueTrendData[]>> => {
  console.log('Fetching revenue per SIM trend from:', `${API_BASE_URL}/performance/revenue-per-sim-trend`);
  try {
    const response = await axios.get<PerformanceApiResponse<RevenueTrendData[]>>(`${API_BASE_URL}/performance/revenue-per-sim-trend`);
    console.log('Raw revenue trend response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'revenue per SIM trend');
  }
};

export const fetchCustomerProfitabilityBySegment = async (): Promise<PerformanceApiResponse<ProfitabilityData[]>> => {
  console.log('Fetching customer profitability by segment from:', `${API_BASE_URL}/performance/customer-profitability-by-segment`);
  try {
    const response = await axios.get<PerformanceApiResponse<ProfitabilityData[]>>(`${API_BASE_URL}/performance/customer-profitability-by-segment`);
    console.log('Raw profitability response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'customer profitability by segment');
  }
};

export const fetchDiscountCreditUtilization = async (): Promise<PerformanceApiResponse<DiscountCreditData[]>> => {
  console.log('Fetching discount credit utilization from:', `${API_BASE_URL}/performance/discount-credit-utilization`);
  try {
    const response = await axios.get<PerformanceApiResponse<DiscountCreditData[]>>(`${API_BASE_URL}/performance/discount-credit-utilization`);
    console.log('Raw discount credit response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'discount credit utilization');
  }
};

export const fetchDiscountSensitivityAnalysis = async (): Promise<PerformanceApiResponse<DiscountSensitivityData[]>> => {
  console.log('Fetching discount sensitivity analysis from:', `${API_BASE_URL}/performance/discount-sensitivity-analysis`);
  try {
    const response = await axios.get<PerformanceApiResponse<DiscountSensitivityData[]>>(`${API_BASE_URL}/performance/discount-sensitivity-analysis`);
    console.log('Raw discount sensitivity response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'discount sensitivity analysis');
  }
};

export const fetchRevenueForecastData = async (): Promise<PerformanceApiResponse<RevenueForecastData[]>> => {
  console.log('Fetching revenue forecast data from:', `${API_BASE_URL}/performance/revenue-forecast-data`);
  try {
    const response = await axios.get<PerformanceApiResponse<RevenueForecastData[]>>(`${API_BASE_URL}/performance/revenue-forecast-data`);
    console.log('Raw revenue forecast response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'revenue forecast data');
  }
};

// Additional endpoints that exist in your backend
export const fetchAccountPerformanceMetrics = async (): Promise<PerformanceApiResponse<any[]>> => {
  console.log('Fetching account performance metrics from:', `${API_BASE_URL}/performance/account-performance-metrics`);
  try {
    const response = await axios.get<PerformanceApiResponse<any[]>>(`${API_BASE_URL}/performance/account-performance-metrics`);
    console.log('Raw account performance response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'account performance metrics');
  }
};

export const fetchPaymentChurnCorrelation = async (): Promise<PerformanceApiResponse<any[]>> => {
  console.log('Fetching payment churn correlation from:', `${API_BASE_URL}/performance/payment-churn-correlation`);
  try {
    const response = await axios.get<PerformanceApiResponse<any[]>>(`${API_BASE_URL}/performance/payment-churn-correlation`);
    console.log('Raw payment churn correlation response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'payment churn correlation');
  }
};

export const fetchSegmentDistribution = async (): Promise<PerformanceApiResponse<any[]>> => {
  console.log('Fetching segment distribution from:', `${API_BASE_URL}/performance/segment-distribution`);
  try {
    const response = await axios.get<PerformanceApiResponse<any[]>>(`${API_BASE_URL}/performance/segment-distribution`);
    console.log('Raw segment distribution response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'segment distribution');
  }
};

export const fetchMonthlyChurnRiskTrend = async (): Promise<PerformanceApiResponse<any[]>> => {
  console.log('Fetching monthly churn risk trend from:', `${API_BASE_URL}/performance/monthly-churn-risk-trend`);
  try {
    const response = await axios.get<PerformanceApiResponse<any[]>>(`${API_BASE_URL}/performance/monthly-churn-risk-trend`);
    console.log('Raw monthly churn risk trend response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'monthly churn risk trend');
  }
};

export const fetchProfitabilityDistribution = async (): Promise<PerformanceApiResponse<any[]>> => {
  console.log('Fetching profitability distribution from:', `${API_BASE_URL}/performance/profitability-distribution`);
  try {
    const response = await axios.get<PerformanceApiResponse<any[]>>(`${API_BASE_URL}/performance/profitability-distribution`);
    console.log('Raw profitability distribution response:', response.data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'profitability distribution');
  }
};

// Export default for convenience
export default {
  fetchPerformanceOverviewMetrics,
  fetchRevenuePerSimTrend,
  fetchCustomerProfitabilityBySegment,
  fetchDiscountCreditUtilization,
  fetchDiscountSensitivityAnalysis,
  fetchRevenueForecastData,
  fetchAccountPerformanceMetrics,
  fetchPaymentChurnCorrelation,
  fetchSegmentDistribution,
  fetchMonthlyChurnRiskTrend,
  fetchProfitabilityDistribution
};
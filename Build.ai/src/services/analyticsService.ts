import axios from 'axios';
import { format, subMonths } from 'date-fns';
import config from 'src/config-global';

const API_BASE_URL = config.api_base_url;

// Interface for simple label-value data
interface LabelValue {
  label: string;
  value: number;
  total?: number;
}

// Interface for usage series per account
interface TopAccountData {
  name: string;
  data: number[];
}

// ------------------- HELPER FUNCTIONS -------------------

// Helper function to safely transform API response
const safeTransformLabelValue = <T extends Record<string, any>>(
  data: any,
  labelKey: keyof T,
  valueKey: keyof T,
  formatter?: (label: string) => string,
  caller?: string
): LabelValue[] => {
  if (!Array.isArray(data)) {
    console.warn(`[${caller}] Expected array but received:`, typeof data, data);
    return [];
  }

  if (data.length > 0 && !Object.keys(data[0]).includes(String(labelKey))) {
    console.warn(`[${caller}] Invalid labelKey: ${String(labelKey)}, available keys:`, Object.keys(data[0]));
  }
  if (data.length > 0 && !Object.keys(data[0]).includes(String(valueKey))) {
    console.warn(`[${caller}] Invalid valueKey: ${String(valueKey)}, available keys:`, Object.keys(data[0]));
  }

  return data
    .map((item: T, index: number) => {
      const rawLabel = item[labelKey] ?? item.period ?? item.billing_cycle ?? `Unknown_${index}`;
      const label = rawLabel != null ? String(rawLabel) : `Unknown_${index}`;

      if (item[labelKey] == null) {
        console.warn(`[${caller}] Missing label for item at index ${index}:`, item, `labelKey: ${String(labelKey)}`);
      }

      const value = Number(item[valueKey] ?? item.data_usage ?? item.total_usage) || 0;
      if (Number.isNaN(value)) {
        console.warn(`[${caller}] Invalid value for item at index ${index}:`, item, `valueKey: ${String(valueKey)}`);
      }

      return {
        label: formatter ? formatter(label) : label,
        value,
      };
    })
    .filter((item, index, self) => {
      const firstIndex = self.findIndex((i) => i.label === item.label);
      if (firstIndex !== index) {
        console.warn(`[${caller}] Duplicate label found: ${item.label}, appending index`);
        item.label = `${item.label}_${index}`;
      }
      return true;
    });
};

// Helper function to handle API errors consistently
const handleApiError = (error: any, context: string): LabelValue[] => {
  console.error(`Error fetching ${context}:`, error);
  if (error.response) {
    console.error('API Response:', error.response.data);
    console.error('Status:', error.response.status);
  } else if (error.request) {
    console.error('No response received for request:', error.request);
  } else {
    console.error('Error setting up request:', error.message);
  }
  return [];
};

// ------------------- DATA FETCH FUNCTIONS -------------------

export const fetchDataUsageByNetwork = async (): Promise<LabelValue[]> => {
  console.log('Fetching data usage by network from:', `${API_BASE_URL}/aggregate-usage`);
  try {
    const response = await axios.get(`${API_BASE_URL}/aggregate-usage`);
    console.log('Raw response:', response.data);
    const data = safeTransformLabelValue(response.data, 'network', 'total_usage', undefined, 'fetchDataUsageByNetwork');
    console.log('Data Usage by Network:', data);
    if (data.length === 0) {
      console.warn('No data returned for fetchDataUsageByNetwork');
      return [
        { label: '3UK', value: 3046977 },
        { label: 'Vodafone UK', value: 3084810 },
      ];
    }
    return data;
  } catch (error) {
    return handleApiError(error, 'data usage by network');
  }
};

export const fetchRatePlanUsage = async (): Promise<LabelValue[]> => {
  console.log('Fetching rate plan usage from:', `${API_BASE_URL}/rate_plan_usage_last_billing_cycle`);
  try {
    const response = await axios.get(`${API_BASE_URL}/rate_plan_usage_last_billing_cycle`);
    console.log('Raw response:', response.data);
    const data = safeTransformLabelValue(response.data, 'rate_plan', 'total_usage', (label) => label, 'fetchRatePlanUsage');
    console.log('Rate Plan Usage:', data);
    if (data.length === 0) {
      console.warn('No data returned for fetchRatePlanUsage');
      return [
        { label: 'Ola', value: 293252 },
        { label: 'ItalGas', value: 286344 },
      ];
    }
    return data;
  } catch (error) {
    return handleApiError(error, 'rate plan usage');
  }
};

export const fetchCdrRecordsHistory = async (): Promise<LabelValue[]> => {
  console.log('Fetching CDR records history from:', `${API_BASE_URL}/cdr-records-history`);
  try {
    const response = await axios.get(`${API_BASE_URL}/cdr-records-history`);
    console.log('Raw CDR response:', response.data);

    if (!Array.isArray(response.data)) {
      console.warn('Expected array for CDR records, received:', response.data);
      return [];
    }

    const transformedData = response.data.map((item: { month: string; total_cdrs: number }, index: number) => {
      const label = item.month
        ? format(new Date(item.month), 'MMM yyyy')
        : `Unknown_${index}`;
      return {
        label,
        value: Number(item.total_cdrs) || 0,
      };
    });

    console.log('CDR Records History:', transformedData);
    if (transformedData.length === 0) {
      console.warn('No data returned for fetchCdrRecordsHistory');
      return [
        { label: 'Jun 2024', value: 11097 },
        { label: 'Jul 2024', value: 40348 },
      ];
    }
    return transformedData;
  } catch (error) {
    return handleApiError(error, 'CDR records history');
  }
};

export const fetchBillingHistory = async (): Promise<LabelValue[]> => {
  console.log('Fetching billing history from:', `${API_BASE_URL}/billing-history`);
  try {
    const response = await axios.get(`${API_BASE_URL}/billing-history`);
    console.log('Raw response:', response.data);
    const transformedData = safeTransformLabelValue(
      response.data,
      'month',
      'total_bill_last_month',
      (month) => {
        try {
          return format(new Date(month), 'MMM yyyy');
        } catch {
          return month;
        }
      },
      'fetchBillingHistory'
    );
    console.log('Billing History:', transformedData);
    if (transformedData.length === 0) {
      console.warn('No data returned for fetchBillingHistory');
      return [
        { label: 'Jun 2025', value: 255985 },
        { label: 'May 2025', value: 230000 },
      ];
    }
    return transformedData;
  } catch (error) {
    return handleApiError(error, 'billing history');
  }
};

export const fetchSimTotalHistory = async (): Promise<LabelValue[]> => {
  console.log('Fetching sim total history from:', `${API_BASE_URL}/sim-total-history`);
  try {
    const response = await axios.get(`${API_BASE_URL}/sim-total-history`);
    console.log('Raw response:', response.data);
    const transformedData = safeTransformLabelValue(
      response.data,
      'month',
      'total_sims',
      (month) => {
        try {
          return format(new Date(month), 'MMM yyyy');
        } catch {
          return month;
        }
      },
      'fetchSimTotalHistory'
    );
    console.log('Sim Total History:', transformedData);
    if (transformedData.length === 0) {
      console.warn('No data returned for fetchSimTotalHistory');
      return [
        { label: 'Jun 2025', value: 225552 },
        { label: 'May 2025', value: 180000 },
      ];
    }
    return transformedData;
  } catch (error) {
    return handleApiError(error, 'sim total history');
  }
};

export const fetchAccountsTotalHistory = async (): Promise<LabelValue[]> => {
  console.log('Fetching total accounts history from:', `${API_BASE_URL}/account-total-history`);
  try {
    const response = await axios.get(`${API_BASE_URL}/account-total-history`);
    console.log('Raw response:', response.data);
    const transformedData = safeTransformLabelValue(
      response.data,
      'month',
      'total_accounts',
      (month) => {
        try {
          return format(new Date(month), 'MMM yyyy');
        } catch {
          return month;
        }
      },
      'fetchAccountsTotalHistory'
    );
    console.log('Total Accounts History:', transformedData);
    if (transformedData.length === 0) {
      console.warn('No data returned for fetchAccountsTotalHistory');
      return [
        { label: 'Jun 2025', value: 1490937 },
        { label: 'May 2025', value: 2019066 },
      ];
    }
    return transformedData;
  } catch (error) {
    return handleApiError(error, 'total accounts history');
  }
  return [];
};

export const fetchTopChargedSims = async (): Promise<LabelValue[]> => {
  console.log('Fetching top charged SIMs from:', `${API_BASE_URL}/top-charged-sims`);
  try {
    const response = await axios.get(`${API_BASE_URL}/top-charged-sims`);
    console.log('Raw response:', response.data);
    const data = safeTransformLabelValue(response.data, 'network', 'total_usage', undefined, 'fetchTopChargedSims');
    console.log('Top Charged SIMs:', data);
    if (data.length === 0) {
      console.warn('No data returned for fetchTopChargedSims');
      return [
        { label: '3UK', value: 3046977 },
        { label: 'EE', value: 3050962 },
      ];
    }
    return data;
  } catch (error) {
    return handleApiError(error, 'top charged SIMs');
  }
};

export const fetchTopAccountsByBill = async (): Promise<LabelValue[]> => {
  console.log('Fetching top accounts by bill from:', `${API_BASE_URL}/top-accounts-by-bill`);
  try {
    const response = await axios.get(`${API_BASE_URL}/top-accounts-by-bill`);
    console.log('Raw response:', response.data);
    const data = safeTransformLabelValue(response.data, 'account_name', 'total_bill_last_month', undefined, 'fetchTopAccountsByBill');
    console.log('Top Accounts by Bill:', data);
    if (data.length === 0) {
      console.warn('No data returned for fetchTopAccountsByBill');
      return [
        { label: 'Ola', value: 255985 },
        { label: 'ItalGas', value: 200000 },
      ];
    }
    return data;
  } catch (error) {
    return handleApiError(error, 'top accounts by bill');
  }
};

export const fetchTopAccountsByUsage = async (): Promise<{ series: TopAccountData[]; months: string[] }> => {
  console.log('Fetching top accounts by usage from:', `${API_BASE_URL}/top-accounts-by-usage`);
  try {
    const response = await axios.get(`${API_BASE_URL}/top-accounts-by-usage`);
    console.log('Raw response:', response.data);

    if (!Array.isArray(response.data)) {
      console.warn('Expected array for top accounts usage, received:', typeof response.data);
      return { series: [], months: [] };
    }

    const currentDate = new Date();
    const currentMonthDate = subMonths(currentDate, 0);
    const lastMonthDate = subMonths(currentDate, 1);

    const lastMonth = format(currentMonthDate, 'MMM yyyy');
    const secondLastMonth = format(lastMonthDate, 'MMM yyyy');

    const transformedData = response.data.reduce(
      (
        acc: Record<string, { name: string; data: number[] }>,
        item: { account_name?: string; billing_cycle: string; total_usage_gb?: number }
      ) => {
        if (!item.billing_cycle) {
          console.warn('Invalid item structure (missing billing_cycle):', item);
          return acc;
        }

        const month = item.billing_cycle;
        const accountName = item.account_name || `Unknown_${month}`;
        const value = item.total_usage_gb ?? 0;

        if (!acc[accountName]) {
          acc[accountName] = { name: accountName, data: [0, 0] };
        }

        try {
          const billingCycleDate = new Date(month);
          const formattedMonth = format(billingCycleDate, 'yyyy-MM');
          if (formattedMonth === format(currentMonthDate, 'yyyy-MM')) {
            acc[accountName].data[0] = value;
          } else if (formattedMonth === format(lastMonthDate, 'yyyy-MM')) {
            acc[accountName].data[1] = value;
          }
        } catch (dateError) {
          console.warn('Date formatting error for billing_cycle:', month, dateError);
        }

        return acc;
      },
      {}
    );

    const series: TopAccountData[] = Object.values(transformedData);

    console.log('Top Accounts by Usage:', { series, months: [lastMonth, secondLastMonth] });
    if (series.length === 0) {
      console.warn('No valid data processed for fetchTopAccountsByUsage');
      return {
        series: [
          { name: 'Ola', data: [255985, 230000] },
          { name: 'ItalGas', data: [200000, 180000] },
        ],
        months: [lastMonth, secondLastMonth],
      };
    }
    return { series, months: [lastMonth, secondLastMonth] };
  } catch (error) {
    handleApiError(error, 'top accounts by usage');
    return { series: [], months: [] };
  }
};

export const fetchTopAccountsBySimCount = async (): Promise<LabelValue[]> => {
  console.log('Fetching top accounts by SIM count from:', `${API_BASE_URL}/accounts-by-sim-count`);
  try {
    const response = await axios.get(`${API_BASE_URL}/accounts-by-sim-count`);
    console.log('Raw response:', response.data);
    if (!Array.isArray(response.data)) {
      console.warn('Expected array for accounts by sim count, received:', typeof response.data, response.data);
    }
    const transformedData = safeTransformLabelValue(response.data, 'account_name', 'number_of_sims', undefined, 'fetchTopAccountsBySimCount').map((item) => ({
      label: item.label,
      value: item.value,
      total: item.value,
    }));
    console.log('Top Accounts by SIM Count:', transformedData);
    if (transformedData.length === 0) {
      console.warn('No data returned for fetchTopAccountsBySimCount');
      return [
        { label: 'Ola', value: 1000, total: 1000 },
        { label: 'ItalGas', value: 800, total: 800 },
      ];
    }
    return transformedData;
  } catch (error) {
    return handleApiError(error, 'top accounts by sim count');
  }
};

export const fetchAccountsBillLastSixMonths = async (): Promise<LabelValue[]> => {
  console.log('Fetching past six months accounts bill from:', `${API_BASE_URL}/accounts_bill_past_six_months`);
  try {
    const response = await axios.get(`${API_BASE_URL}/accounts_bill_past_six_months`);
    console.log('Raw response:', response.data);
    const transformedData = safeTransformLabelValue(
      response.data,
      'billing_cycle',
      'total_bill_last_month',
      (cycle: string) => {
        try {
          return format(new Date(cycle), 'MMM yyyy');
        } catch {
          return cycle;
        }
      },
      'fetchAccountsBillLastSixMonths'
    ).map((item) => ({
      label: item.label,
      value: item.value,
      total: item.value,
    }));
    console.log('Past Six Months Bills:', transformedData);
    if (transformedData.length === 0) {
      console.warn('No data returned for fetchAccountsBillLastSixMonths');
      return [
        { label: 'Jun 2025', value: 3046977, total: 3046977 },
        { label: 'May 2025', value: 3084810, total: 3084810 },
      ];
    }
    return transformedData;
  } catch (error) {
    return handleApiError(error, 'past six months accounts bill');
  }
};

export const fetchAccountsUsageLastSixMonths = async (): Promise<LabelValue[]> => {
  console.log('Fetching past six months accounts usage from:', `${API_BASE_URL}/accounts_usage_past_six_months`);
  try {
    const response = await axios.get(`${API_BASE_URL}/accounts_usage_past_six_months`);
    console.log('Raw response:', response.data);

    // Log the first item to inspect keys
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('First response item:', response.data[0]);
    }

    const transformedData = safeTransformLabelValue(
      response.data,
      'billing_cycle',
      'total_usage',
      (cycle: string) => {
        try {
          return format(new Date(cycle), 'MMM yyyy');
        } catch {
          return cycle;
        }
      },
      'fetchAccountsUsageLastSixMonths'
    ).map((item) => ({
      label: item.label,
      value: item.value,
      total: item.value,
    }));

    console.log('Past Six Months Usage:', transformedData);
    if (transformedData.length === 0) {
      console.warn('No data returned for fetchAccountsUsageLastSixMonths');
      return [
        { label: 'Jun 2025', value: 1490937, total: 1490937 },
        { label: 'May 2025', value: 2019066, total: 2019066 },
      ];
    }
    return transformedData;
  } catch (error) {
    return handleApiError(error, 'past six months accounts usage');
  }
};
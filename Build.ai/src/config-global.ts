import packageJson from '../package.json';

// ----------------------------------------------------------------------

export type ConfigValue = {
  appName: string;
  appVersion: string;
};

// ----------------------------------------------------------------------

export const CONFIG: ConfigValue = {
  appName: 'Insight AI',
  appVersion: packageJson.version,
};

const config = {
  // api_base_url: 'https://billing-ai.onrender.com'
  api_base_url: 'http://localhost:8000'
};

export default config;
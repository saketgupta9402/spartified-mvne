import { Helmet } from 'react-helmet-async';

import { Grid } from '@mui/material';

import { CONFIG } from 'src/config-global';

import { AIChatbot } from 'src/components/chatbot/AIChatbot';


// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <Helmet>
        <title> {`Chatbot - ${CONFIG.appName}`}</title>
        <meta name="description" content="Billing AI Chatbot" />
        <meta name="keywords" content="react,material,kit,application,dashboard,admin,template" />
      </Helmet>

      <Grid>
        <AIChatbot />
      </Grid>
    </>
  );
}

import type { CardProps } from '@mui/material/Card';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

import { fShortenNumber } from 'src/utils/format-number';
import { varAlpha } from 'src/theme/styles';

// ----------------------------------------------------------------------

type Props = CardProps & {
  title?: string;
  subheader?: string;
  list: { value: string; label: string; total: number }[];
};

const getLogoUrl = (companyName: string): string => {
  const domainMap: { [key: string]: string } = {
    'Coca-Cola': 'coca-cola.com',
    BMW: 'bmw.com',
    Pepsi: 'pepsi.com',
    Mercedes: 'mercedes-benz.com',
    Tesla: 'tesla.com',
    Ford: 'ford.co.uk',
    Fiat: 'fiat.com',
    'Land Rover': 'landrover.com',
    Skoda: 'skoda-auto.com',
    'British Gas': 'britishgas.co.uk',
    'US Gas': 'usgas.com',
    ItalGas: 'italgas.it',
    Zomato: 'zomato.com',
    Uber: 'uber.com',
    Ola: 'olaelectric.com',
    DeliverFast: 'deliverfast.com',
    Tesco: 'tesco.com',
    Sainsbury: 'sainsburys.co.uk',
    Waitrose: 'waitrose.com',
    Lidl: 'lidl.com',
    Coop: 'coop.co.uk',
    'Southern Electric': 'sse.co.uk',
    Octopus: 'octopus.energy',
    'Vodafone Broadband': 'vodafone.co.uk',
    Sky: 'sky.com',
    Lebara: 'lebara.co.uk',
    DigiTalk: 'digitalk.com',
    TalkMobile: 'talkmobile.co.uk',
    Amazon: 'amazon.co.uk',
    Starbucks: 'starbucks.co.uk',
    Google:'Google.com',
    Spotify: 'spotify.com',
  };

  const domain = domainMap[companyName];
  return domain ? `https://logo.clearbit.com/${domain}` : '';
};

export function AnalyticsAccountsBySims({ title, subheader, list, sx, ...other }: Props) {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{
    label: string;
    total: number;
  } | null>(null);
  const [accountDetails, setAccountDetails] = useState<{
    total_sims: number;
    total_bill: number;
    total_usage_gb: number;
    billing_cycle: string;
    message?: string;
  } | null>(null);
  const [allAccountDetails, setAllAccountDetails] = useState<
    Record<string, { total_sims: number; total_bill: number; total_usage_gb: number; billing_cycle: string; message?: string }>
  >({});

  useEffect(() => {
    const fetchAllAccountDetails = async () => {
      const details: Record<string, any> = {};
      await Promise.all(
        list.map(async (site) => {
          try {
            const response = await fetch(
              `http://127.0.0.1:8000/account-details-latest-billing-cycle/${site.label}`
            );
            const data = await response.json();
            details[site.label] = data;
          } catch (error) {
            console.error(`Error fetching details for ${site.label}:`, error);
            details[site.label] = {
              total_sims: 0,
              total_bill: 0,
              total_usage_gb: 0,
              billing_cycle: 'Unknown',
              message: 'Failed to load details',
            };
          }
        })
      );
      setAllAccountDetails(details);
    };

    fetchAllAccountDetails();
  }, [list]);

  const handleOpenDialog = async (item: { label: string; total: number }) => {
    setSelectedAccount(item);
    setOpenDialog(true);

    if (allAccountDetails[item.label]) {
      setAccountDetails(allAccountDetails[item.label]);
    } else {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/account-details-latest-billing-cycle/${item.label}`
        );
        const data = await response.json();
        setAccountDetails(data);
      } catch (error) {
        console.error('Error fetching account details:', error);
        setAccountDetails({
          total_sims: 0,
          total_bill: 0,
          total_usage_gb: 0,
          billing_cycle: 'Unknown',
          message: 'Failed to load account details',
        });
      }
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedAccount(null);
    setAccountDetails(null);
  };

  return (
    <Card sx={sx} {...other}>
      <CardHeader title={title} subheader={subheader} />

      <Box
        sx={{
          p: 3,
          maxHeight: 360,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease-in-out',
          '&:hover': {
            overflowY: 'auto',
          },
        }}
      >
        <Box display="grid" gap={2} gridTemplateColumns="repeat(2, 1fr)">


          {list.map((site) => {
            const details = allAccountDetails[site.label] || {
              total_sims: 'Loading...',
              total_bill: 'Loading...',
              total_usage_gb: 'Loading...',
              billing_cycle: 'Loading...',
            };

            return (
              <Tooltip
                key={site.label}
                title={
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2">{site.label}</Typography>
                    <Typography variant="body2">
                      <strong>Total SIMs:</strong>{' '}
                      {typeof details.total_sims === 'number'
                        ? fShortenNumber(details.total_sims)
                        : details.total_sims}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Total Billing:</strong>{' '}
                      ${typeof details.total_bill === 'number' ? details.total_bill.toFixed(2) : details.total_bill}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Usage:</strong>{' '}
                      {typeof details.total_usage_gb === 'number'
                        ? details.total_usage_gb.toFixed(2)
                        : details.total_usage_gb}{' '}
                      GB
                    </Typography>
                    <Typography variant="body2">
                      <strong>Billing Cycle:</strong> {details.billing_cycle}
                    </Typography>
                    {details.message && (
                      <Typography variant="body2" color="error">
                        {details.message}
                      </Typography>
                    )}
                  </Box>
                }
                arrow
                placement="top"
              >
                <Box
                  onClick={() => handleOpenDialog({ label: site.label, total: site.total })}
                  sx={(theme) => ({
                    py: 2.5,
                    display: 'flex',
                    borderRadius: 1.5,
                    textAlign: 'center',
                    alignItems: 'center',
                    flexDirection: 'column',
                    border: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)}`,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.08),
                    },
                  })}
                >
                  <img className="logo" src={getLogoUrl(site.label)} alt={site.label} />
                  <Typography variant="h6" sx={{ mt: 1 }}>
                    {fShortenNumber(site.total)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {site.label}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {selectedAccount && (
        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          sx={{ '& .MuiDialog-paper': { borderRadius: 2 } }}
        >
          <DialogTitle>{selectedAccount.label} - Account Details (Last Billing Cycle)</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              {accountDetails ? (
                <>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    <strong>Total SIMs:</strong> {fShortenNumber(accountDetails.total_sims)}
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    <strong>Total Billing:</strong> ${accountDetails.total_bill.toFixed(2)}
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    <strong>Usage:</strong> {accountDetails.total_usage_gb} GB
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    <strong>Billing Cycle:</strong> {accountDetails.billing_cycle}
                  </Typography>
                  {accountDetails.message && (
                    <Typography variant="body2" color="error">
                      {accountDetails.message}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography>Loading account details...</Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Card>
  );
}
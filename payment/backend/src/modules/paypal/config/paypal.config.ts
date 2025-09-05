export const getPayPalConfig = () => {
  const env = process.env.PAYPAL_ENV || 'sandbox';

  return {
    clientId:
      env === 'live'
        ? process.env.PAYPAL_CLIENT_ID_LIVE
        : process.env.PAYPAL_CLIENT_ID_SANDBOX,
    clientSecret:
      env === 'live'
        ? process.env.PAYPAL_CLIENT_SECRET_LIVE
        : process.env.PAYPAL_CLIENT_SECRET_SANDBOX,
    baseUrl:
      env === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com',
  };
};

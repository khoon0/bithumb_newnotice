const { log, error } = console;
const binance = require('./binance');

const terminate = (message) => {
  log(message);
  log('Terminating the bot...');
  return process.exit();
};

const { usdt, api, sec } = process.env;

const validation = async () => {
  try {
    if (!api) terminate('"api" is missing in .env file!');
    if (api.length !== 64)
      terminate('"api" should be an alphanumeric string of 64 char!');
    if (!sec) terminate('"sec" is missing in .env file!');
    if (sec.length !== 64)
      terminate('"sec" should be an alphanumeric string of 64 char!');
    if (!Number(usdt)) terminate('"usdt" is missing in .env file!');
    await binance({
      method: 'POST',
      path: '/api/v3/order/test',
      keys: { api, sec },
      params: {
        quantity: 20,
        symbol: 'XRPUSDT',
        side: 'BUY',
        type: 'MARKET',
        newOrderRespType: 'FULL',
      },
    });
  } catch (err) {
    terminate(
      err.message +
        ' Invalid API keys, or Insufficient access to API keys, or IP Address access could be missing for the api keys'
    );
  }
};


module.exports = validation;

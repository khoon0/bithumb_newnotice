//ENTRY =
// 1)MARKET BUY ORDER
//EXIT =
// 1) FIXED SELL %
// 3) OCO - FIXED SELL AND STOP LOSS %

const { log, error } = console;
const binance = require('./binance');
const NP = require('number-precision');
NP.enableBoundaryChecking(false);
const scientificToDecimal = require('scientific-to-decimal');

const TelegramBot = require('node-telegram-bot-api');

// replace the value below with the Telegram token you receive from BotFather
const token = '6753338952:AAE4S6YojQw9qYpCkKzS5V2ztD1WlvwLtRM';

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

let isCancelled = false;

bot.onText(/\/cancel/, (msg, match) => {
  const chatId = msg.chat.id;
  isCancelled = true;
  bot.sendMessage(chatId, `Sell operation cancelled.`);
});

let eInfo = {};

const loadeInfo = async ({ symbol }) => {
  try {
    const resp = await binance({
      method: 'GET',
      path: '/api/v3/exchangeInfo',
    });
    if (resp?.statusCode !== 200) throw resp;
    const einfoSymbol = resp.body.symbols.find((s) => s?.symbol === symbol);
    if (!einfoSymbol) throw 'Symbol missing in Exchange Info API';
    eInfo[symbol] = { ...einfoSymbol };
  } catch (err) {
    throw err;
  }
};

const getQty = ({ symbol, price, usdt }) => {
  const qty = usdt / price;
  const qstep = Math.log10(1 / eInfo[symbol]['filters'][1]['stepSize']); //원래 2였는데 1로 바꿨음 12/31
  return NP.strip(Math.floor(qty * 10 ** qstep) / 10 ** qstep);
};

const buy = async ({ keys, symbol, usdt }) => {
  try {
    const resp = await binance({
      method: 'POST',
      path: '/api/v3/order',
      keys,
      params: {
        // quantity: scientificToDecimal(qty),
        symbol,
        side: 'BUY',
        type: 'MARKET',
        newOrderRespType: 'FULL',
        quoteOrderQty: usdt,
      },
    });

    if (resp?.statusCode !== 200) {
      console.error(`Error: ${resp.statusCode}. Full response: ${JSON.stringify(resp)}`);
      throw resp;
    }

    return resp.body;
  } catch (err) {
    console.error(`Error occurred while buying: ${err.message}`);
    throw err;
  }
};

const sell = async ({ keys, symbol, qty, timegap, immediate = false }) => {
  let timerId;
  let countdown = immediate ? 0 : timegap; //time constant

  let cancel = new Promise((resolve, reject) => {
    timerId = setInterval(() => {
      if (countdown <= 1) {
        clearInterval(timerId);
      } else {
        console.log(`Selling ${symbol} in ${--countdown} seconds...`);
      }

      if (isCancelled) {
        clearInterval(timerId);
        reject(new Error('Sell operation cancelled.'));
      }
    }, 1000);
  });

  try {
    if (!immediate) {
      await Promise.race([cancel, new Promise(resolve => setTimeout(resolve, timegap * 1000))]);
    }

    if (isCancelled) {
      throw new Error('Sell operation cancelled.');
    }

    const resp = await binance({
      method: 'POST',
      path: '/api/v3/order',
      keys,
      params: {
        quantity: scientificToDecimal(qty),
        symbol,
        side: 'SELL',
        type: 'MARKET',
        newOrderRespType: 'FULL',
      },
    });

    if (resp?.statusCode !== 200) {
      console.error(`Error: ${resp.statusCode}. Full response: ${JSON.stringify(resp)}`);
      throw new Error(`Error occurred while selling: ${resp.statusCode}`);
    }

    const soldPrice = resp.body.fills.reduce((total, fill) => total + (+fill.price * fill.qty), 0) / resp.body.fills.reduce((total, fill) => total + (+fill.qty), 0);

    console.log(`Successfully sold ${qty} ${symbol} at an average price of ${soldPrice}.`);

    return { response: resp.body, quantity: qty };
  } catch (err) {
    clearInterval(timerId);
    if (err.message === 'Sell operation cancelled.') {
      return { response: null, quantity: qty };
    } else {
      console.error(`Error occurred while selling: ${err.message}`);
      if (qty > 0) {
        console.log(`Reducing ${symbol} quantity by 1 and retrying sell operation...`);
        return sell({ keys, symbol, qty: qty - 1, immediate: true });
      } else {
        throw err;
      }
    }
  }
};

module.exports = { loadeInfo, getQty, buy, sell };

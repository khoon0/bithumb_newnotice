require('dotenv').config();
const { log, error } = console;
const { detectE, startWS } = require('./detect');
const { startBithumbDetectPC ,startBithumbDetectMobile } = require('./detectNotice');
const { loadeInfo, getQty, buy, sell } = require('./order');
const validate = require('./validate');
const axios = require('axios');
const moment = require('moment');
require('moment-timezone');

const { usdt, api, sec, timegap, is_test} = process.env;
const discordWebhookUrl = 'https://discord.com/api/webhooks/1193042585430786088/1pxsYW9AkUv9obpcVd3mmdtIySNX9HyhyLlQclOsVYvGJ1gOkH_az4ToHuKS4uT8GzOq';

log(`Notice notifying bot is running... ${getTime()}\nUSDT : $${usdt}\nTIMEGAP BETWEEN BUY & SELL : ${timegap} seconds\nTEST MODE : ${is_test}`);
axios.post(discordWebhookUrl, {
  content: `Notice notifying bot is running... ${getTime()}\nUSDT : $${usdt}\nTIMEGAP BETWEEN BUY & SELL : ${timegap} seconds\nTEST MODE : ${is_test}`
})
.catch(err => {
  console.error('Error sending Discord notification', err);
});

validate();
log('The bot is waiting for a new coin to be listed and search if the coin is listed in Binance USDT market.');
log('When detected, the bot automatically trades as per the configuration.');

// startWS(); //이거는 바이낸스 신규 상장 감지
startBithumbDetectPC();
startBithumbDetectMobile();
detectE.on('NEWLISTING', async (data) => {
  try {
    const nStart = new Date().getTime();
    const { s: symbol, c: closePrice } = { ...data };
    log(`Symbol ${symbol} detected in notification ${getTime()}`);

    axios.post(discordWebhookUrl, {
      content: `Symbol ${symbol} detected in notification ${getTime()}`
    })
    .catch(err => {
      console.error('Error sending Discord notification', err);
    });

    const bresp = await buy({ keys: { api, sec }, usdt, symbol });
    const nEnd =  new Date().getTime();
    const nDiff = nEnd - nStart
    log(`Time gap: ${nDiff}ms`)

    const buyPrice =
      bresp.fills.reduce((a, d) => a + d.price * d.qty, 0) /
      bresp.fills.reduce((a, d) => a + d.qty * 1, 0);
    const qty = bresp.executedQty;
    log(`${symbol} buy price is ${buyPrice} and buy quantity is ${qty} at ${getTime()}`);

    axios.post(discordWebhookUrl, {
      content: `${symbol} buy price is ${buyPrice} and buy quantity is ${qty} at ${getTime()}`
    })
    .catch(err => {
      console.error('Error sending Discord notification', err);
    });

    const { response: sellResponse, quantity: sellQuantity } = await sell({
      keys: { api, sec },
      symbol,
      qty,
      timegap,
    });
    

    if (sellResponse !== null) {
      const sellPrice =
        sellResponse.fills.reduce((a, d) => a + d.price * d.qty, 0) /
        sellResponse.fills.reduce((a, d) => a + d.qty, 0);
      log(`${symbol} sell price is ${sellPrice} and sell quantity is ${sellQuantity} at ${getTime()}`);

      axios.post(discordWebhookUrl, {
        content: `${symbol} sell price is ${sellPrice} and sell quantity is ${sellQuantity} at ${getTime()}`
      })
      .catch(err => {
        console.error('Error sending Discord notification', err);
      });
    } else {
      log(`${symbol} sell operation cancelled at ${getTime()}`);
      axios.post(discordWebhookUrl, {
        content: `${symbol} sell operation cancelled at ${getTime()}`
      })
      .catch(err => {
        console.error('Error sending Discord notification', err);
      });
    }

  } catch (err) {
    log(err, getTime());
    axios.post(discordWebhookUrl, {
      content: `Error Buying New Coin: ${err.message}`
    })
        .catch(() => {
          console.error('Error sending Discord notification');
        });
  }
});

process.on('SIGINT', () => {
  axios.post(discordWebhookUrl, {
    content: `Process was interrupted at ${getTime()}`
  })
  .catch(err => {
    console.error('Error sending Discord notification', err);
  });

  process.exit(1);
});

process.on('exit', (code) => {
  axios.post(discordWebhookUrl, {
    content: `Process exited with code: ${code} at ${getTime()}`
  })
  .catch(err => {
    console.error('Error sending Discord notification', err);
  });
});

process.on('uncaughtException', (err) => {
  axios.post(discordWebhookUrl, {
    content: `Process terminated due to uncaught exception: ${err.message} at ${getTime()}`
  })
  .catch(error => {
    console.error('Error sending Discord notification', error);
  });
});

function getTime() {
  return moment().tz("Asia/Seoul").format('YYYY.MM.DD hh:mm:ss.SSS A');
}

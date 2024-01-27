require('dotenv').config();

const axios = require("axios");
const cheerio = require("cheerio");
const {detectE} = require("./detect");
const moment = require("moment");
let { is_test } = process.env;
is_test = is_test === 'true'

const DISCORD_WEBHOOK_URL_PC = 'https://discord.com/api/webhooks/1192655256291639376/zvvhYgjxZTHxZpFPngLtQWFpqigTAjYZheqGtgmmlfCsqRovUY4GnBLVtoyvYvWZK02U';
const DISCORD_WEBHOOK_URL_MOBILE = 'https://discord.com/api/webhooks/1193932951415697528/RkNLUXKGv2osXSjJe0xu8_kU_yV4dRBFkpgcC4haXF6dMMc4ahSy8jLv2v56oqTOoE0n';

const getLastNoticeInfoPC = async (test = false) => {
    try {
        const res = await axios.get('https://cafe.bithumb.com/view/boards/43', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language':'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding':'gzip, deflate, br',
                'Referer': 'https://www.google.co.uk/'
            }
        });
        const $ = cheerio.load(res.data);
        const notices = $('tr');

        for (let i = 1; i < notices.length; i++) {
            const el = notices[i];
            const style = $(el).attr('style');

            if (!style || !style.includes('background-color: papayawhip')) {
                const script = $(el).attr('onclick');
                const id = script.replace("toDetailOrUrl(event, '", "").replace("','')", "")
                const title = $('td.one-line a', el).text().trim();
                // 현재 시간 (UTC)에 9시간 더하기
                return {
                    title: test ? '[마켓 추가] 리플(XRP) 원화 마켓 추가 pc' : title,
                    id: test ? 100 : id,
                }
            }
        }
    } catch (error) {
        console.error(`Error occurred while checking Bithumb notices PC: ${error.message}`, getTime());
        axios.post(DISCORD_WEBHOOK_URL_PC, {
            content: `Error occurred while checking Bithumb notices PC: ${error.message} ${getTime()}`
          })
          .catch(err => {
            console.error('Error sending while checking Bithumb notices PC', err);
          });
    }
};

const getLastNoticeInfoMobile = async (test = false) => {
    try {
        const res = await axios.get('https://m-feed.bithumb.com/notice', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language':'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding':'gzip, deflate, br',
                'Referer': 'https://www.google.co.uk/'
            }
        });
        const $ = cheerio.load(res.data);
        const notices = $('.noticeList_notice-item-list__link__rVBKl');

        for (let i = 1; i < notices.length; i++) {
            const el = notices[i];
            const classList = $(el).attr('class');

            if (!classList || !classList.includes('noticeList_notice-list__link--fixed__5EvPe')) {
                const script = $(el).attr('href');
                const id = script.replace("/notice/", "")
                const title = $('p', el).text().trim();
                // 현재 시간 (UTC)에 9시간 더하기
                return {
                    title: test ? '[투자 유의] 리플(XRP) 원화 마켓 추가 mobile' : title,
                    id: test ? 100 : id,
                }
            }
        }
    } catch (error) {
        console.error(`Error occurred while checking Bithumb notices Mobile: ${error.message}`, getTime());
        axios.post(DISCORD_WEBHOOK_URL_MOBILE, {
            content: `Error occurred while checking Bithumb notices Mobile: ${error.message} ${getTime()}`
          })
          .catch(err => {
            console.error('Error sending while checking Bithumb notices Mobile', err);
          });
    }
};

const startBithumbDetectPC = async() => {
    try {
    let isCrawlingStopped = false;  // 크롤링이 중지되었음을 나타내는 변수를 추가합니다.
    let lastNoticeInfoPC = await getLastNoticeInfoPC()
    let isMessagePrinted = false; // 메시지 출력 여부를 확인하는 새로운 변수

    console.log(`${lastNoticeInfoPC.title}`, getTime())
    axios.post(DISCORD_WEBHOOK_URL_PC, {
        content: `${lastNoticeInfoPC.title} ${getTime()}`
      })
      .catch(err => {
        console.error('Error sending last notice PC', err);
      });

    const symbols = [];
    setInterval(async () => {
        try {
        // 현재 시간과 요일을 확인합니다.
        const currentTime = moment(getTime(), 'YYYY.MM.DD hh:mm:ss.SSS A');
        const currentHour = currentTime.hour();
        const currentMinute = currentTime.minute();

        // 원하시는 시간대(오전 9시 ~ 오후 9시)이 아니라면, 크롤링을 하지 않습니다.
        if (currentHour < 9 || currentHour >= 21) {
            if (!isCrawlingStopped) {
                console.log(`Bot will start again at 9 AM (Operation hour: 09:00 ~ 21:00). ${getTime()}`);
                axios.post(DISCORD_WEBHOOK_URL_PC, {
                    content: `Bot will start again at 9 AM (Operation hour: 09:00 ~ 21:00). ${getTime()}`
                })
                .catch(err => {
                    console.error('Error sending PC Operation time', err);
                });            
                isCrawlingStopped = true;
            }
            return;
        }

        // 크롤링을 다시 시작합니다.
        if (currentHour === 9 && isCrawlingStopped) {  // 크롤링이 중지된 상태에서 다시 시작될 때만 메시지를 출력합니다.
            console.log(`Operation started again at ${getTime()}`);
            axios.post(DISCORD_WEBHOOK_URL_PC, {
                content: `Operation started again at ${getTime()}`
              })
              .catch(err => {
                console.error('Error sending Operation beginning', err);
              });            
            isCrawlingStopped = false;  // 크롤링이 다시 시작되었음을 나타냅니다.
        }

        let noticeInfoPC
        noticeInfoPC = await getLastNoticeInfoPC(is_test) //is_test
        if (lastNoticeInfoPC.id === noticeInfoPC.id) {
            return;
        }
        let newNoticeTitle;
        if (lastNoticeInfoPC.id !== noticeInfoPC.id) {
            newNoticeTitle = noticeInfoPC.title;
        }
        console.log(`${newNoticeTitle}`, getTime())
        // New: Send the same message to Discord\
        axios.post(DISCORD_WEBHOOK_URL_PC, {
            content: `${newNoticeTitle} ${getTime()}`
          })
          .catch(err => {
            console.error('Error sending new notice title', err);
          });

        if (!/\[마켓 추가\]/.test(newNoticeTitle)) {
            lastNoticeInfoPC = noticeInfoPC
            isRunning = false;
            return;
        }

        const new_listing_symbol = newNoticeTitle.match(/\(([^)]+)\)/g);
        new_listing_symbol.forEach((e) => {
            const symbol = e.replace('(', '').replace(')', '');
            if (symbols.includes(symbol)) {
                return
            }
            symbols.push(symbol)
            detectE.emit('NEWLISTING', {
                s: e.replace('(', '').replace(')', '') + 'USDT',
                c: null,
            });
        })
        lastNoticeInfoPC = noticeInfoPC
        } catch (intervalError) {
            console.error('Interval function error:', intervalError);
        }
    }, 200)
    } catch (error) {
        console.error('Error in startBithumbDetectPC:', error);}
}


const startBithumbDetectMobile = async() => {
    try {
    let isCrawlingStopped = false;  // 크롤링이 중지되었음을 나타내는 변수를 추가합니다.
    let lastNoticeInfoMobile = await getLastNoticeInfoMobile();
    let isMessagePrinted = false; // 메시지 출력 여부를 확인하는 새로운 변수

    console.log(`${lastNoticeInfoMobile.title}`, getTime())
    axios.post(DISCORD_WEBHOOK_URL_MOBILE, {
        content: `${lastNoticeInfoMobile.title} ${getTime()}`
      })
      .catch(err => {
        console.error('Error sending last notice PC', err);
      });

    const symbols = [];
    setInterval(async () => {
        try {
        // 현재 시간과 요일을 확인합니다.
        const currentTime = moment(getTime(), 'YYYY.MM.DD hh:mm:ss.SSS A');
        const currentHour = currentTime.hour();
        const currentMinute = currentTime.minute();

        // 원하시는 시간대(오전 9시 ~ 오후 9시)이 아니라면, 크롤링을 하지 않습니다.
        if (currentHour < 9 || currentHour >= 21) {
            if (!isCrawlingStopped) {
                console.log(`Bot will start again at 9 AM (Operation hour: 09:00 ~ 21:00). ${getTime()}`);
                axios.post(DISCORD_WEBHOOK_URL_MOBILE, {
                    content: `Bot will start again at 9 AM (Operation hour: 09:00 ~ 21:00). ${getTime()}`
                })
                .catch(err => {
                    console.error('Error sending Operation time', err);
                });            
                isCrawlingStopped = true;
            }
            return;
        }

        // 크롤링을 다시 시작합니다.
        if (currentHour === 9 && isCrawlingStopped) {  // 크롤링이 중지된 상태에서 다시 시작될 때만 메시지를 출력합니다.
            console.log(`Operation started again at ${getTime()}`);
            axios.post(DISCORD_WEBHOOK_URL_MOBILE, {
                content: `Operation started again at ${getTime()}`
              })
              .catch(err => {
                console.error('Error sending Operation beginning', err);
              });            
            isCrawlingStopped = false;  // 크롤링이 다시 시작되었음을 나타냅니다.
        }

        let noticeInfoMobile
        noticeInfoMobile = await getLastNoticeInfoMobile(is_test) //is_test
        if (lastNoticeInfoMobile.id === noticeInfoMobile.id) {
            return;
        }
        let newNoticeTitle;
        if (lastNoticeInfoMobile.id !== noticeInfoMobile.id) {
            newNoticeTitle = noticeInfoMobile.title;
        }
        console.log(`${newNoticeTitle}`, getTime())
        // New: Send the same message to Discord\
        axios.post(DISCORD_WEBHOOK_URL_MOBILE, {
            content: `${newNoticeTitle} ${getTime()}`
          })
          .catch(err => {
            console.error('Error sending Operation beginning', err);
          });

        if (!/\[마켓 추가\]/.test(newNoticeTitle)) {
            lastNoticeInfoMobile = noticeInfoMobile
            return;
        }

        const new_listing_symbol = newNoticeTitle.match(/\(([^)]+)\)/g);
        new_listing_symbol.forEach((e) => {
            const symbol = e.replace('(', '').replace(')', '');
            if (symbols.includes(symbol)) {
                return
            }
            symbols.push(symbol)
            detectE.emit('NEWLISTING', {
                s: e.replace('(', '').replace(')', '') + 'USDT',
                c: null,
            });
        })
        lastNoticeInfoMobile = noticeInfoMobile
    } catch (intervalError) {
        console.error('Interval function error:', intervalError);
    }
    }, 200)
    } catch (error) {
    console.error('Error in startBithumbDetectPC:', error);
    }
}

function getTime() {
    return moment().tz("Asia/Seoul").format('YYYY.MM.DD hh:mm:ss.SSS A');
}

module.exports = { startBithumbDetectPC, startBithumbDetectMobile };
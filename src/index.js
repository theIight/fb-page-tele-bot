import { getConfig } from './config.js';
import { PostStorage } from './storage.js';
import { TelegramNotifier } from './telegram.js';
import { FacebookCrawler } from './crawler.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getTimestamp() {
  const d = new Date();
  return d.toLocaleTimeString('vi-VN', { hour12: false });
}

async function main() {
  const config = getConfig();

  console.log('====================================================');
  console.log('🤖 FACEBOOK PAGE TO TELEGRAM MONITOR BOT');
  console.log('====================================================');
  console.log(`📌 Page URL:       ${config.fbPageUrl}`);
  console.log(`⏱️ Chu kỳ reload:   ${config.checkInterval}s`);
  console.log(`💬 Telegram Chat:  ${config.telegramChatId}`);
  console.log(`🖥️ Chế độ:         ${config.headless ? 'Headless (ẩn cửa sổ)' : 'Hiện cửa sổ trình duyệt'}`);
  console.log(`🔔 Báo bài đầu:    ${config.notifyOnStart ? 'Có' : 'Không (chỉ báo khi có bài mới sau khi chạy bot)'}`);
  console.log('====================================================\n');

  const storage = new PostStorage(config.dataPath);
  const telegram = new TelegramNotifier(config.telegramBotToken, config.telegramChatId);
  const crawler = new FacebookCrawler(config);

  // 1. Kiểm tra kết nối Telegram Bot
  console.log('[Telegram] Đang kiểm tra token...');
  try {
    const botInfo = await telegram.testConnection();
    console.log(`[Telegram] ✅ Kết nối thành công bot: @${botInfo.username} (${botInfo.first_name})`);
  } catch (err) {
    console.error(`[Telegram] ❌ Lỗi kết nối: ${err.message}`);
    console.error('Vui lòng kiểm tra lại TELEGRAM_BOT_TOKEN trong file .env');
    process.exit(1);
  }

  // Graceful shutdown
  let isRunning = true;
  const handleExit = async () => {
    if (!isRunning) return;
    console.log('\n[Shutdown] Đang dừng bot và dọn dẹp tài nguyên...');
    isRunning = false;
    await crawler.close();
    console.log('[Shutdown] Tạm biệt! 👋');
    process.exit(0);
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  // 2. Chạy lần đầu tiên để khởi tạo danh sách bài viết đã có
  console.log('\n[Monitor] Đang quét lần đầu để nhận diện các bài viết hiện tại...');
  const isFirstBoot = storage.size === 0;

  try {
    const initialResult = await crawler.fetchLatestPosts();
    const existingPosts = initialResult.posts;

    console.log(`[Monitor] Phát hiện trang: "${initialResult.pageTitle}" với ${existingPosts.length} bài viết.`);

    if (isFirstBoot) {
      if (config.notifyOnStart && existingPosts.length > 0) {
        console.log('[Monitor] NOTIFY_ON_START=true -> Gửi thông báo bài viết mới nhất...');
        const newest = existingPosts[0];
        try {
          await telegram.notifyNewPost({
            pageTitle: initialResult.pageTitle,
            post: newest
          });
          console.log(`[Telegram] ✅ Đã gửi thông báo bài viết: ${newest.id}`);
        } catch (err) {
          console.error(`[Telegram] Lỗi gửi thông báo bài đầu:`, err.message);
        }
      }
      
      // Ghi nhớ các bài hiện tại
      storage.markManySeen(existingPosts.map(p => p.id));
      console.log(`[Monitor] Đã lưu ${existingPosts.length} bài viết hiện có vào bộ nhớ để không báo trùng lặp.`);
    } else {
      console.log(`[Monitor] Đã có ${storage.size} bài viết trong lịch sử đã đọc.`);
    }
  } catch (err) {
    console.error(`[Monitor] Cảnh báo quét lần đầu thất bại: ${err.message}. Sẽ thử lại trong vòng lặp chính.`);
  }

  console.log(`\n🚀 Bot bắt đầu chạy liên tục (reload mỗi ${config.checkInterval}s). Nhấn Ctrl+C để dừng.\n`);

  // 3. Vòng lặp giám sát liên tục
  let cycleCount = 0;

  while (isRunning) {
    // Chờ chu kỳ tiếp theo (kèm một chút ngẫu nhiên 0-3 giây để hành vi tự nhiên hơn)
    const jitter = Math.floor(Math.random() * 3000);
    const waitTime = (config.checkInterval * 1000) + jitter;
    await sleep(waitTime);

    if (!isRunning) break;
    cycleCount++;

    const now = getTimestamp();
    console.log(`[${now}] [#${cycleCount}] Đang kiểm tra trang Facebook...`);

    try {
      const result = await crawler.fetchLatestPosts();
      const pageTitle = result.pageTitle;
      const posts = result.posts;

      // Lọc các bài viết mới chưa từng thấy
      const newPosts = posts.filter(p => !storage.isSeen(p.id));

      if (newPosts.length === 0) {
        console.log(`[${now}] 💤 Không có bài viết mới (${posts.length} bài đã xem).`);
      } else {
        console.log(`[${now}] 🔥 PHÁT HIỆN ${newPosts.length} BÀI VIẾT MỚI! Đang gửi thông báo Telegram...`);

        // Đảo ngược để gửi bài cũ hơn trước, bài mới nhất gửi sau cùng
        const postsToSend = [...newPosts].reverse();

        for (const post of postsToSend) {
          try {
            await telegram.notifyNewPost({ pageTitle, post });
            console.log(`[Telegram] ✅ Đã gửi bài viết: ${post.id} (${post.timestamp || 'Mới'})`);
            storage.markSeen(post.id);
          } catch (err) {
            console.error(`[Telegram] ❌ Lỗi gửi bài ${post.id}:`, err.message);
            // Vẫn đánh dấu để tránh spam lỗi liên tục nếu bài viết bị lỗi định dạng
            storage.markSeen(post.id);
          }

          // Delay nhỏ giữa các tin nhắn
          await sleep(1500);
        }
      }

      // Mỗi 30 chu kỳ, đóng trình duyệt và mở lại để giải phóng RAM tối đa
      if (cycleCount % 30 === 0) {
        console.log(`[Monitor] Giải phóng bộ nhớ chu kỳ #${cycleCount}...`);
        await crawler.close();
      }

    } catch (err) {
      console.error(`[${now}] ⚠️ Lỗi trong chu kỳ #${cycleCount}:`, err.message);
      // Nếu gặp lỗi mạng nặng, đóng context để lần tới khởi tạo lại sạch sẽ
      if (err.message.includes('Target closed') || err.message.includes('browser has been closed')) {
        await crawler.close();
      }
    }
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});

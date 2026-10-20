import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load .env from project root
dotenv.config({ path: path.join(projectRoot, '.env') });

export function getConfig() {
  const fbPageUrl = process.env.FB_PAGE_URL?.trim();
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const telegramChatId = process.env.TELEGRAM_CHAT_ID?.trim();

  const missing = [];
  if (!fbPageUrl) missing.push('FB_PAGE_URL');
  if (!telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!telegramChatId) missing.push('TELEGRAM_CHAT_ID');

  if (missing.length > 0) {
    console.error('❌ THIẾU BIẾN MÔI TRƯỜNG TRONG FILE .env:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\n👉 Vui lòng sao chép file .env.example thành .env và điền các thông tin trên.');
    process.exit(1);
  }

  const checkInterval = parseInt(process.env.CHECK_INTERVAL_SECONDS || '60', 10);
  const headless = process.env.HEADLESS !== 'false';
  const notifyOnStart = process.env.NOTIFY_ON_START === 'true';
  const userDataDir = path.resolve(projectRoot, process.env.USER_DATA_DIR || './user_data');
  const fbCookies = process.env.FB_COOKIES?.trim() || '';

  return {
    fbPageUrl,
    telegramBotToken,
    telegramChatId,
    checkInterval: isNaN(checkInterval) || checkInterval < 10 ? 60 : checkInterval,
    headless,
    notifyOnStart,
    userDataDir,
    fbCookies,
    projectRoot,
    dataPath: path.join(projectRoot, 'data', 'seen_posts.json')
  };
}

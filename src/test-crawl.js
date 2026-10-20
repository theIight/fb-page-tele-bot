import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { FacebookCrawler } from './crawler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

async function main() {
  const fbPageUrl = process.env.FB_PAGE_URL || 'https://www.facebook.com/MetaVietnam';
  const userDataDir = path.resolve(projectRoot, process.env.USER_DATA_DIR || './user_data');
  const headless = process.env.HEADLESS !== 'false';
  const fbCookies = process.env.FB_COOKIES || '';

  console.log('====================================================');
  console.log('🧪 CHẠY THỬ CRAWL FACEBOOK PAGE');
  console.log(`URL: ${fbPageUrl}`);
  console.log(`Headless: ${headless}`);
  console.log('====================================================\n');

  const crawler = new FacebookCrawler({
    fbPageUrl,
    userDataDir,
    headless,
    fbCookies
  });

  try {
    const result = await crawler.fetchLatestPosts();
    console.log(`\n✅ Tên trang phát hiện: "${result.pageTitle}"`);
    console.log(`✅ Tổng số bài viết tìm thấy: ${result.posts.length}\n`);

    result.posts.forEach((post, i) => {
      console.log(`---------------- [ BÀI VIẾT ${i + 1} ] ----------------`);
      console.log(`ID:        ${post.id}`);
      console.log(`Ghim:      ${post.isPinned ? '📌 Có' : 'Không'}`);
      console.log(`Thời gian: ${post.timestamp || '(Không rõ)'}`);
      console.log(`URL:       ${post.url || '(Không có link trực tiếp)'}`);
      console.log(`Ảnh:       ${post.image ? post.image.slice(0, 80) + '...' : '(Không có)'}`);
      console.log(`Nội dung:\n${post.text ? post.text.slice(0, 300) + (post.text.length > 300 ? '...' : '') : '(Không có text)'}`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Lỗi khi test crawl:', err);
  } finally {
    await crawler.close();
  }
}

main();

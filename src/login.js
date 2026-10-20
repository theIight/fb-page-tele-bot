import readline from 'readline';
import { chromium } from 'playwright';
import { getConfig } from './config.js';

async function main() {
  const config = getConfig();
  console.log('====================================================');
  console.log('🚀 MỞ TRÌNH DUYỆT ĐỂ ĐĂNG NHẬP FACEBOOK');
  console.log('Thư mục profile:', config.userDataDir);
  console.log('====================================================\n');

  let context;
  try {
    context = await chromium.launchPersistentContext(config.userDataDir, {
      headless: false,
      channel: 'chrome',
      viewport: { width: 1280, height: 800 }
    });
  } catch (err) {
    console.log('Khởi chạy Chromium mặc định (không tìm thấy Chrome)...');
    context = await chromium.launchPersistentContext(config.userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 800 }
    });
  }

  const page = context.pages()[0] || await context.newPage();
  console.log('Đang mở trang đăng nhập Facebook...');
  await page.goto('https://www.facebook.com');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n👉 Vui lòng đăng nhập vào tài khoản Facebook trên cửa sổ Chrome vừa mở.');
  console.log('👉 Sau khi đăng nhập thành công vào News Feed, quay lại đây và nhấn phím ENTER để lưu phiên.\n');

  await new Promise(resolve => {
    rl.question('Nhấn [ENTER] sau khi đã đăng nhập thành công: ', () => {
      rl.close();
      resolve();
    });
  });

  console.log('\nĐang lưu phiên đăng nhập và đóng trình duyệt...');
  await context.close();
  console.log('✅ Đã lưu phiên đăng nhập thành công! Bot giờ đây có thể chạy ở chế độ HEADLESS mà không lo bị chặn.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});

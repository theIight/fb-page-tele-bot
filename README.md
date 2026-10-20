# 🤖 Facebook Page to Telegram Monitor Bot

Bot tự động theo dõi, reload liên tục một trang Facebook (Page URL cấu hình qua `.env`) bằng trình duyệt tự động (Playwright), đọc các bài viết mới nhất và gửi thông báo tức thì về Telegram khi có bài đăng mới.

---

## 🌟 Tính Năng Nổi Bật

- 🎯 **Cấu hình 100% qua `.env`**: Dễ dàng đổi link Fanpage, token Telegram, chat ID, chu kỳ quét...
- 🛡️ **Vượt tường lửa Meta**: Chạy bằng Chrome thật (`channel: 'chrome'` / Playwright headless), xử lý JavaScript hoàn chỉnh, tự động gỡ bỏ các modal bắt đăng nhập ("Log In", "See more on Facebook").
- 📸 **Gửi thông báo đầy đủ thông tin**:
  - Tên Fanpage
  - Thời gian đăng bài (ví dụ: *35 phút trước*, *2 giờ trước*)
  - Toàn bộ trích đoạn nội dung (tự động click *Xem thêm / See more*)
  - Ảnh bài viết đính kèm (nếu bài viết có hình ảnh)
  - Link bài viết trực tiếp trên Facebook
- 💾 **Chống spam & báo trùng lặp**:
  - Quản lý danh sách bài đã đọc trong `data/seen_posts.json`.
  - Khi khởi động lần đầu, bot tự ghi nhớ các bài đang có và chỉ bắn thông báo khi có bài đăng **MỚI** sau này (trừ khi bật `NOTIFY_ON_START=true`).
- 🔄 **Hỗ trợ mọi loại nội dung**: Bài viết thông thường (`/posts/`), bài viết ảnh (`/photo`), video (`/videos/`), thước phim (`/reel/`), album (`/media/set/`).
- 🔑 **Tiện ích đăng nhập 1 lần (`npm run login`)**: Mở cửa sổ trình duyệt để đăng nhập tài khoản Facebook (ví dụ tài khoản phụ/clone), lưu session vào `./user_data` giúp bot hoạt động trơn tru 100% không bao giờ gặp popup chặn.
- ⚡ **Tối ưu RAM để chạy 24/7**: Tự động giải phóng tài nguyên trình duyệt sau mỗi 30 chu kỳ reload.

---

## 📂 Cấu Trúc Dự Án

```
fb-page-tele-bot/
├── .env.example          # Mẫu cấu hình biến môi trường
├── package.json          # Cấu hình dự án & thư viện
├── data/
│   └── seen_posts.json   # Lưu danh sách ID bài viết đã đọc (tự động tạo)
├── user_data/            # Profile trình duyệt lưu session đăng nhập (tự động tạo)
└── src/
    ├── config.js         # Đọc & kiểm tra biến môi trường .env
    ├── extractor.js      # Phân tích URL, làm sạch ID bài viết
    ├── crawler.js        # Điều khiển trình duyệt Playwright cào bài viết
    ├── telegram.js       # Tích hợp gửi tin nhắn & ảnh qua Telegram Bot API
    ├── storage.js        # Quản lý lưu trữ bài viết đã xem
    ├── test-crawl.js     # Script test cào bài nhanh mà không cần gửi Telegram
    ├── login.js          # Script mở trình duyệt đăng nhập lưu session
    └── index.js          # File chạy chính của bot (vòng lặp giám sát liên tục)
```

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng

### 1. Chuẩn Bị Yêu Cầu
- **Node.js**: Phiên bản 18 trở lên (Khuyến nghị Node.js 20 hoặc 22).
- Đã cài đặt **Google Chrome** trên máy tính (hoặc Playwright sẽ tự dùng Chromium).

### 2. Cài Đặt Thư Viện

```bash
cd /Users/thelight/ssd/projects/fb-page-tele-bot
npm install
```

---

### 3. Lấy Thông Tin Telegram

#### A. Lấy Bot Token:
1. Mở Telegram, tìm kiếm bot **[@BotFather](https://t.me/BotFather)**.
2. Gửi lệnh `/newbot`, đặt tên và username cho bot.
3. Sao chép chuỗi **HTTP API Token** (dạng `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

#### B. Lấy Chat ID nhận thông báo:
- **Nếu nhận tin nhắn riêng:** Tìm bot **[@userinfobot](https://t.me/userinfobot)** trên Telegram, nhấn `Start` để xem `Id` của bạn (ví dụ: `987654321`).
- **Nếu gửi vào Group/Kênh:**
  1. Thêm bot vừa tạo vào Group hoặc Channel của bạn và cấp quyền Admin gửi tin nhắn.
  2. Gửi 1 tin nhắn bất kỳ vào Group.
  3. Mở trình duyệt truy cập:
     ```
     https://api.telegram.org/bot<TOKEN_CỦA_BẠN>/getUpdates
     ```
  4. Tìm trường `"chat":{"id": -100xxxxxxxxxx}`. Đó chính là `TELEGRAM_CHAT_ID`.

---

### 4. Cấu Hình File `.env`

Tạo file `.env` từ file mẫu `.env.example`:

```bash
cp .env.example .env
```

Mở file `.env` và chỉnh sửa các tham số của bạn:

```env
# Link Facebook Page cần theo dõi (bắt buộc)
FB_PAGE_URL=https://www.facebook.com/tintucvtv24

# Token bot Telegram từ @BotFather (bắt buộc)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ

# Chat ID nhận tin nhắn (bắt buộc)
TELEGRAM_CHAT_ID=987654321

# Chu kỳ reload kiểm tra trang (đơn vị: giây, mặc định 60s)
CHECK_INTERVAL_SECONDS=60

# Chạy ẩn trình duyệt không mở cửa sổ (mặc định: true)
HEADLESS=true

# Gửi thông báo các bài đang có khi bot vừa bật lần đầu (mặc định: false)
NOTIFY_ON_START=false
```

---

### 5. Kiểm Tra Thử (Test Crawl)

Chạy lệnh sau để kiểm tra xem bot có đọc được bài viết từ Fanpage đó hay chưa (lệnh này chỉ đọc và in ra màn hình Terminal, **không** gửi Telegram):

```bash
npm run test:crawl
```

Nếu xuất hiện kết quả danh sách bài viết (URL, tiêu đề, thời gian), quá trình cào đã hoạt động hoàn hảo!

---

### 6. (Khuyên Dùng) Đăng Nhập Tài Khoản Phụ

Facebook thường xuyên chặn hoặc hạn chế hiển thị bài viết với người dùng chưa đăng nhập. Để bot hoạt động ổn định nhất 24/7, bạn có thể đăng nhập 1 tài khoản Facebook phụ/clone:

```bash
npm run login
```

- Một cửa sổ Google Chrome sẽ tự động bật lên.
- Bạn đăng nhập tài khoản Facebook trên cửa sổ đó.
- Sau khi vào được Facebook, quay lại Terminal và nhấn phím **ENTER**.
- Trình duyệt sẽ lưu toàn bộ cookie/session vào thư mục `./user_data`. Từ nay về sau, bot chạy ở chế độ `HEADLESS=true` sẽ luôn ở trạng thái đã đăng nhập mà không bao giờ bị hỏi lại!

---

### 7. Khởi Chạy Bot

Khởi động bot giám sát liên tục:

```bash
npm start
```

Bot sẽ:
1. Kiểm tra kết nối tới Telegram bot.
2. Quét các bài viết hiện có trên trang và lưu vào `data/seen_posts.json`.
3. Bắt đầu vòng lặp reload trang theo chu kỳ `CHECK_INTERVAL_SECONDS`.
4. Ngay khi có bài viết mới xuất hiện, bot sẽ tức thì gửi thông báo đến Telegram của bạn!

---

## 🛠️ Chạy Bot Nền 24/7 Bằng PM2

Để bot tiếp tục chạy ngay cả khi bạn tắt cửa sổ Terminal hoặc khởi động lại máy, bạn có thể dùng **PM2**:

```bash
# Cài đặt PM2 (nếu chưa có)
npm install -g pm2

# Khởi động bot chạy nền
pm2 start src/index.js --name "fb-tele-bot"

# Xem logs hoạt động
pm2 logs fb-tele-bot

# Dừng bot
pm2 stop fb-tele-bot

# Thiết lập tự chạy khi bật máy
pm2 startup
pm2 save
```

---

## ⚙️ Các Biến Môi Trường Chi Tiết

| Biến | Ý nghĩa | Mặc định | Bắt buộc |
|---|---|---|---|
| `FB_PAGE_URL` | Link trang Fanpage cần crawl | - | **Có** |
| `TELEGRAM_BOT_TOKEN` | Token Bot Telegram cấp bởi @BotFather | - | **Có** |
| `TELEGRAM_CHAT_ID` | ID người dùng, nhóm hoặc kênh nhận tin | - | **Có** |
| `CHECK_INTERVAL_SECONDS` | Số giây giữa mỗi lần reload kiểm tra trang | `60` | Không |
| `HEADLESS` | Chạy ẩn trình duyệt (`true` hoặc `false`) | `true` | Không |
| `NOTIFY_ON_START` | Bắn thông báo bài hiện tại khi bot khởi động lần đầu | `false` | Không |
| `USER_DATA_DIR` | Thư mục lưu cache & cookie đăng nhập | `./user_data` | Không |
| `FB_COOKIES` | Chuỗi cookie thô (nếu không dùng `npm run login`) | Trống | Không |

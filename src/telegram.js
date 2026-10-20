export function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class TelegramNotifier {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async testConnection() {
    try {
      const res = await fetch(`${this.baseUrl}/getMe`);
      const data = await res.json();
      if (!data.ok) {
        throw new Error(`Telegram error: ${data.description}`);
      }
      return data.result;
    } catch (err) {
      throw new Error(`Không thể kết nối tới Telegram Bot: ${err.message}`);
    }
  }

  async sendMessage(htmlText) {
    const res = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Gửi tin nhắn Telegram thất bại: ${data.description}`);
    }
    return data;
  }

  async sendPhoto(photoUrl, htmlCaption) {
    const res = await fetch(`${this.baseUrl}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        photo: photoUrl,
        caption: htmlCaption,
        parse_mode: 'HTML'
      })
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Gửi ảnh Telegram thất bại: ${data.description}`);
    }
    return data;
  }

  async notifyNewPost({ pageTitle, post }) {
    const cleanTitle = escapeHtml(pageTitle || 'Facebook Page');
    const cleanTime = escapeHtml(post.timestamp || 'Vừa xong');
    const rawText = (post.text || '').trim();

    // Prepare text snippet
    const maxTextLength = 2000;
    let snippet = rawText;
    if (snippet.length > maxTextLength) {
      snippet = snippet.slice(0, maxTextLength) + '... (Xem tiếp trên bài viết)';
    }
    const cleanText = escapeHtml(snippet);

    const postUrl = post.url || 'https://www.facebook.com';

    let messageHtml = `📢 <b>BÀI VIẾT MỚI: ${cleanTitle}</b>\n\n`;
    if (cleanTime) {
      messageHtml += `🕒 <b>Thời gian:</b> ${cleanTime}\n\n`;
    }
    if (cleanText) {
      messageHtml += `📝 <b>Nội dung:</b>\n${cleanText}\n\n`;
    }
    messageHtml += `🔗 <a href="${postUrl}">Xem bài viết trên Facebook</a>`;

    // If post has an image, try sending photo first
    if (post.image && post.image.startsWith('http')) {
      try {
        let photoCaption = messageHtml;
        if (photoCaption.length > 1024) {
          // Photo caption Telegram limit is 1024 chars
          const shortText = escapeHtml(rawText.slice(0, 500) + (rawText.length > 500 ? '...' : ''));
          photoCaption = `📢 <b>BÀI VIẾT MỚI: ${cleanTitle}</b>\n\n🕒 ${cleanTime}\n\n${shortText}\n\n🔗 <a href="${postUrl}">Xem bài viết trên Facebook</a>`;
        }
        await this.sendPhoto(post.image, photoCaption);
        return;
      } catch (err) {
        console.warn(`[Telegram] Không gửi được ảnh (${err.message}), chuyển sang gửi tin nhắn văn bản...`);
      }
    }

    // Fallback or standard text message
    if (messageHtml.length > 4000) {
      messageHtml = messageHtml.slice(0, 3900) + `...\n\n🔗 <a href="${postUrl}">Xem bài viết trên Facebook</a>`;
    }
    await this.sendMessage(messageHtml);
  }
}

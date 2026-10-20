import { chromium } from 'playwright';
import { cleanFacebookUrl, extractPostId } from './extractor.js';

export class FacebookCrawler {
  constructor(config) {
    this.config = config;
    this.context = null;
    this.page = null;
  }

  async init() {
    if (this.context) return;

    const launchOptions = {
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-notifications'
      ]
    };

    // Try using installed Google Chrome on macOS/Linux/Windows
    try {
      this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
        ...launchOptions,
        channel: 'chrome',
        viewport: { width: 1280, height: 850 },
        locale: 'vi-VN',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      });
    } catch (err) {
      console.warn(`[Crawler] Dùng Chromium mặc định (${err.message})`);
      this.context = await chromium.launchPersistentContext(this.config.userDataDir, {
        ...launchOptions,
        viewport: { width: 1280, height: 850 },
        locale: 'vi-VN',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      });
    }

    // Apply cookies from .env if provided
    if (this.config.fbCookies) {
      await this.applyCookieString(this.config.fbCookies);
    }

    this.page = this.context.pages()[0] || await this.context.newPage();
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(45000);
  }

  async applyCookieString(cookieStr) {
    try {
      const cookies = cookieStr.split(';').map(pair => {
        const [name, ...rest] = pair.trim().split('=');
        if (!name || rest.length === 0) return null;
        return {
          name: name.trim(),
          value: rest.join('=').trim(),
          domain: '.facebook.com',
          path: '/'
        };
      }).filter(Boolean);

      if (cookies.length > 0) {
        await this.context.addCookies(cookies);
        console.log(`[Crawler] Đã nạp ${cookies.length} cookie`);
      }
    } catch (err) {
      console.warn(`[Crawler] Lỗi phân tích cookie:`, err.message);
    }
  }

  async dismissPopups() {
    try {
      await this.page.keyboard.press('Escape');
    } catch (_) {}

    try {
      await this.page.evaluate(() => {
        // Remove login dialogs & backdrop
        const dialogs = document.querySelectorAll('div[role="dialog"]');
        dialogs.forEach(d => {
          const text = d.innerText || '';
          if (text.includes('Log In') || text.includes('Đăng nhập') || text.includes('See more on Facebook')) {
            d.remove();
          }
        });
        document.body.style.overflow = 'auto';

        // Click close buttons if present
        const closeSelectors = [
          'div[aria-label="Close"]',
          'div[aria-label="Đóng"]',
          '[aria-label*="close" i]',
          '[aria-label*="đóng" i]'
        ];
        for (const selector of closeSelectors) {
          const els = Array.from(document.querySelectorAll(selector));
          for (const el of els) {
            el.click();
          }
        }
      });
    } catch (_) {}
  }

  async fetchLatestPosts() {
    await this.init();

    const url = this.config.fbPageUrl;
    console.log(`[Crawler] Đang tải trang: ${url} ...`);

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    } catch (err) {
      console.warn(`[Crawler] goto warning: ${err.message}. Đang tiếp tục xử lý DOM...`);
    }

    // Wait for initial render
    await this.page.waitForTimeout(3000);
    await this.dismissPopups();

    // Scroll down 2-3 steps to trigger content feed loading
    for (let s = 0; s < 2; s++) {
      try {
        await this.page.evaluate(() => window.scrollBy(0, 800));
        await this.page.waitForTimeout(1500);
        await this.dismissPopups();
      } catch (_) {}
    }

    // Extract Page Title
    const pageTitle = await this.page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1 && h1.innerText.trim()) return h1.innerText.trim();
      const title = document.title || '';
      return title.replace(/\s*\|\s*Facebook$/i, '').trim();
    });

    // Extract Posts inside page context
    const rawPosts = await this.page.evaluate(() => {
      // Auto-expand "See more" / "Xem thêm"
      try {
        const seeMoreButtons = Array.from(document.querySelectorAll('div[role="article"] div[role="button"]'))
          .filter(el => {
            const t = (el.innerText || '').trim().toLowerCase();
            return t === 'see more' || t === 'xem thêm';
          });
        for (const btn of seeMoreButtons) {
          btn.click();
        }
      } catch (_) {}

      // Identify whether an article is a comment or reply
      const isComment = (art) => {
        const aria = (art.getAttribute('aria-label') || '').toLowerCase();
        if (aria.includes('comment by') || aria.includes('reply by') || 
            aria.includes('bình luận của') || aria.includes('phản hồi của')) {
          return true;
        }
        // If article is nested inside another article, it is a comment
        if (art.parentElement && art.parentElement.closest('div[role="article"]')) {
          return true;
        }
        return false;
      };

      const articles = Array.from(document.querySelectorAll('div[role="article"]'))
        .filter(art => (art.innerText || '').trim().length > 10)
        .filter(art => !isComment(art));

      const isPostUrl = (h) => {
        if (!h) return false;
        if (h.includes('comment_id') || h.includes('reply_comment_id')) return false;
        return h.includes('/posts/') || 
               h.includes('story_fbid') || 
               h.includes('/photo') || 
               h.includes('/videos/') || 
               h.includes('/reel/') || 
               h.includes('/watch') ||
               h.includes('/media/set/');
      };

      return articles.map((art, index) => {
        const fullArticleText = art.innerText || '';
        const isPinned = fullArticleText.includes('Pinned post') || 
                         fullArticleText.includes('Bài viết được ghim') ||
                         fullArticleText.includes('Bài viết đã ghim');

        // Find candidate post links
        const allLinks = Array.from(art.querySelectorAll('a'));
        let postLink = null;
        let timestamp = '';

        for (const a of allLinks) {
          const href = a.href || '';
          if (isPostUrl(href)) {
            const text = (a.innerText || '').trim();
            const aria = a.getAttribute('aria-label') || '';
            // Time links often have short text like '3h', '1 ngày', or aria-label
            if (aria || text) {
              postLink = href;
              timestamp = aria || text;
              break;
            }
            if (!postLink) postLink = href;
          }
        }

        if (!postLink) {
          const fallback = allLinks.find(a => isPostUrl(a.href || ''));
          if (fallback) postLink = fallback.href;
        }

        // Sub-comments to ignore their text
        const commentDivs = Array.from(art.querySelectorAll('div[role="article"]'));
        const isDescendantOfComment = (el) => commentDivs.some(c => c.contains(el));

        // Extract text content inside the article
        const textNodes = Array.from(art.querySelectorAll('div[dir="auto"]'))
          .filter(el => !isDescendantOfComment(el))
          .map(el => el.innerText.trim())
          .filter(t => {
            if (!t) return false;
            const lower = t.toLowerCase();
            const ignored = [
              'like', 'thích', 'comment', 'bình luận', 'share', 'chia sẻ',
              'see more', 'xem thêm', 'viết bình luận...', 'write a comment...',
              'xem thêm bình luận', 'view more comments'
            ];
            return !ignored.includes(lower);
          });

        // Deduplicate nested elements
        const uniqueTexts = [];
        for (const t of textNodes) {
          if (!uniqueTexts.some(existing => existing.includes(t))) {
            uniqueTexts.push(t);
          }
        }

        // Extract high-res image
        const images = Array.from(art.querySelectorAll('img'))
          .map(img => img.src)
          .filter(src => {
            if (!src || !src.startsWith('http')) return false;
            if (src.includes('rsrc.php') || src.includes('emoji.php') || src.includes('static.xx.fbcdn.net')) return false;
            return true;
          });

        return {
          index,
          isPinned,
          rawUrl: postLink,
          timestamp,
          text: uniqueTexts.join('\n\n'),
          image: images[0] || null
        };
      }).filter(p => p.rawUrl || p.text);
    });

    // Clean URLs and generate unique IDs
    const posts = rawPosts.map(p => {
      const url = cleanFacebookUrl(p.rawUrl);
      const id = extractPostId(url, p.text, p.timestamp);
      return {
        id,
        url,
        timestamp: p.timestamp,
        text: p.text,
        image: p.image,
        isPinned: p.isPinned
      };
    });

    return {
      pageTitle,
      posts
    };
  }

  async close() {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
        this.page = null;
      }
    } catch (err) {
      console.warn(`[Crawler] Lỗi khi đóng trình duyệt:`, err.message);
    }
  }
}

import fs from 'fs';
import path from 'path';

export class PostStorage {
  constructor(filePath) {
    this.filePath = filePath;
    this.seenSet = new Set();
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.seenSet = new Set(data);
        }
      }
    } catch (err) {
      console.warn(`[Storage] Không đọc được file lịch sử, tạo mới (${err.message})`);
      this.seenSet = new Set();
    }
  }

  isSeen(postId) {
    if (!postId) return false;
    return this.seenSet.has(postId);
  }

  markSeen(postId) {
    if (!postId) return;
    this.seenSet.add(postId);
    this.save();
  }

  markManySeen(postIds) {
    let added = false;
    for (const id of postIds) {
      if (id && !this.seenSet.has(id)) {
        this.seenSet.add(id);
        added = true;
      }
    }
    if (added) {
      this.save();
    }
  }

  save() {
    try {
      // Keep at most 1000 latest IDs
      const list = Array.from(this.seenSet);
      const trimmed = list.slice(-1000);
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(trimmed, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.filePath);
    } catch (err) {
      console.error(`[Storage] Lỗi khi lưu file seen_posts.json:`, err.message);
    }
  }

  get size() {
    return this.seenSet.size;
  }
}

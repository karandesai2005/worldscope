const MAX_ITEMS = 10;

const TEMPLATE = `
  <aside class="news-panel" aria-live="polite" aria-label="Live news feed">
    <header class="news-panel-header">
      <h2 class="news-panel-title">Global News</h2>
      <span class="news-live-badge">LIVE</span>
    </header>
    <ul class="news-list" id="news-list"></ul>
  </aside>
`;

function formatTimeAgo(isoTime) {
  const timestamp = Date.parse(isoTime);

  if (!Number.isFinite(timestamp)) {
    return "just now";
  }

  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1_000));

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function createNewsItem(article) {
  const item = document.createElement("li");
  item.className = "news-item";

  const link = document.createElement("a");
  link.className = "news-link";
  link.href = article.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = article.title;

  const meta = document.createElement("div");
  meta.className = "news-meta";

  const source = document.createElement("span");
  source.className = "news-source";
  source.textContent = article.source?.name || "Unknown source";

  const time = document.createElement("time");
  time.className = "news-time";
  time.dateTime = article.publishedAt || "";
  time.textContent = formatTimeAgo(article.publishedAt);

  const title = document.createElement("p");
  title.className = "news-headline";
  title.textContent = article.title || "Untitled";

  meta.append(source, time);
  link.append(meta, title);
  item.appendChild(link);

  return item;
}

export function createNewsPanel() {
  const app = document.getElementById("app");
  const mount = document.createElement("div");
  mount.id = "news-root";
  mount.innerHTML = TEMPLATE;
  app.appendChild(mount);

  const list = mount.querySelector("#news-list");

  return {
    update(articles = []) {
      const nextItems = Array.isArray(articles) ? articles.slice(0, MAX_ITEMS) : [];
      const fragment = document.createDocumentFragment();

      for (const article of nextItems) {
        fragment.appendChild(createNewsItem(article));
      }

      list.replaceChildren(fragment);
    },
  };
}

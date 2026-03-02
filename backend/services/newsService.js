import axios from "axios";

const NEWS_API_URL = "https://newsapi.org/v2/everything";
const POLL_INTERVAL_MS = 60_000;
const QUERY = "Iran OR Israel OR USA war";
const MAX_ARTICLES = 15;

async function fetchNews(apiKey) {
  const { data } = await axios.get(NEWS_API_URL, {
    params: {
      q: QUERY,
      sortBy: "publishedAt",
      language: "en",
      pageSize: MAX_ARTICLES,
      apiKey,
    },
    timeout: 10_000,
  });

  const articles = Array.isArray(data?.articles) ? data.articles : [];

  return articles
    .map((article) => ({
      title: article?.title,
      source: {
        name: article?.source?.name,
      },
      url: article?.url,
      publishedAt: article?.publishedAt,
    }))
    .filter(
      (article) =>
        typeof article.title === "string" &&
        article.title &&
        typeof article.source?.name === "string" &&
        article.source.name &&
        typeof article.url === "string" &&
        article.url &&
        typeof article.publishedAt === "string" &&
        article.publishedAt,
    );
}

export function startNewsService(io) {
  const apiKey = process.env.NEWS_API_KEY?.trim();
  let timer;
  let stopped = false;

  if (!apiKey) {
    console.warn("[news] disabled: NEWS_API_KEY is not configured");
    return {
      stop() {},
    };
  }

  const schedule = (delayMs) => {
    if (stopped) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  };

  const run = async () => {
    try {
      const articles = await fetchNews(apiKey);
      io.emit("news:update", articles);
      schedule(POLL_INTERVAL_MS);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;

      if (status === 429) {
        console.warn("[news] rate limited");
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[news] fetch failed: ${message}`);
      }

      schedule(POLL_INTERVAL_MS);
    }
  };

  run();

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

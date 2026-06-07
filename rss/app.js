const PROXY = "https://rss-dashboard-server.vercel.app/proxy?url=";
const ITEMS_PER_FEED = 12;
const REFRESH_MS = 15 * 60 * 1000; // 15 minutes

// --------------------
// Time/date formatting
// --------------------

function relativeTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date)) return "";
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m`;
    if (h < 24) return `${h}h`;
    return `${d}d`;
}

// ----------------
// RSS/Atom parsing
// ----------------

function getLinkFromItem(item) {
    // RSS 2.0: <link> is a text node
    const linkEl = item.querySelector("link");
    if (linkEl) {
        const text = linkEl.textContent.trim();
        if (text) return text;
        const href = linkEl.getAttribute("href");
        if (href) return href;
    }
    
    // Fallback: <guid isPermaLink="true">
    const guid = item.querySelector("guid");
    if (guid && guid.getAttribute("isPermaLink") !== "false") {
        return guid.textContent.trim();
    }
    return "#";
}

function safeUrl(url) {
    if (!url || url === "#") return "#";
    try {
        const u = new URL(url);
        return (u.protocol === "http:" || u.protocol === "https:") ? url : "#";
    } catch {
        return "#";
    }
}

function parseXML(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("Invalid XML");
    return doc;
}

function parseRSS(xml) {
    const doc = parseXML(xml);

    // RSS 2.0
    const items = Array.from(doc.querySelectorAll("channel > item"));
    if (items.length > 0) {
        return items.slice(0, ITEMS_PER_FEED).map(item => ({
            title: item.querySelector("title")?.textContent.trim() || "Untitled",
            link: safeUrl(getLinkFromItem(item)),
            date: item.querySelector("pubDate")?.textContent || "",
        }));
    }

    // Atom
    const entries = Array.from(doc.querySelectorAll("entry"));
    return entries.slice(0, ITEMS_PER_FEED).map(entry => ({
        title: entry.querySelector("title")?.textContent.trim() || "Untitled",
        link: safeUrl(entry.querySelector("link")?.getAttribute("href") || ""),
        date: entry.querySelector("published, updated")?.textContent || "",
    }));
}

// -------
// Network
// -------

async function fetchFeed(url) {
    const res = await fetch(`${PROXY}${encodeURIComponent(url)}`, {
        mode: "cors",
        signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const {
        contents
    } = await res.json();
    if (!contents) throw new Error("Empty response");
    return parseRSS(contents);
}

// -----------
// DOM helpers
// -----------

function skeletonRows(n = 7) {
    const widths = ["88%", "72%", "91%", "65%", "80%", "75%", "83%"];
    return widths.slice(0, n).map(w => `
      <li class="article-item skeleton">
        <span class="skel-title" style="width:${w}"></span>
        <span class="skel-time"></span>
      </li>
    `).join("");
}

function createCard(feed) {
    const card = document.createElement("article");
    card.className = "feed-card";
    card.dataset.url = feed.url;
    card.innerHTML = `
      <header class="feed-header" style="--accent:${feed.color}">
        <span class="feed-dot" style="background:${feed.color}"></span>
        <h2 class="feed-name">${feed.name}</h2>
        <span class="feed-meta loading">loading…</span>
      </header>
      <ul class="article-list">${skeletonRows()}</ul>
    `;
    return card;
}

function fillCard(card, articles) {
    const meta = card.querySelector(".feed-meta");
    meta.textContent = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
    meta.className = "feed-meta";

    const list = card.querySelector(".article-list");
    list.innerHTML = "";
    articles.forEach(({
        title,
        link,
        date
     }) => {
        const li = document.createElement("li");
        li.className = "article-item";

        const a = document.createElement("a");
        a.className = "article-link";
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = title;

        const t = document.createElement("span");
        t.className = "article-time";
        t.textContent = relativeTime(date);

        li.append(a, t);
        list.appendChild(li);
    });
}

function errorCard(card, msg) {
    card.querySelector(".feed-meta").className = "feed-meta error";
    card.querySelector(".feed-meta").textContent = "failed";
    card.querySelector(".article-list").innerHTML = `<li class="feed-error">Could not load feed — ${msg}</li>`;
}

// ----
// Core
// ----

async function loadCard(feed, card) {
    try {
        const articles = await fetchFeed(feed.url);
        fillCard(card, articles);
    } catch (err) {
        errorCard(card, err.message);
    }
}

function buildDashboard() {
    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    FEEDS.forEach(feed => {
        const card = createCard(feed);
        grid.appendChild(card);
        loadCard(feed, card);
    });
    document.getElementById("last-refresh").textContent =
        `Refreshed ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

// ----
// Init
// ----

document.addEventListener("DOMContentLoaded", () => {
    buildDashboard();
    document.getElementById("refresh-btn").addEventListener("click", buildDashboard);
    setInterval(buildDashboard, REFRESH_MS);
});
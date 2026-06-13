const REMOTE_API_BASE = 'http://USER_API_BASE';
const API_KEY = 'lsq_USER_API_KEY';
const API_BASE = shouldUseLocalProxy() ? '' : REMOTE_API_BASE;
const STORAGE_KEY = 'lsqlite_blog_demo_state';

const initialState = {
  view: 'feed',
  posts: [],
  comments: [],
  selectedPostId: null,
  adminFilter: 'all',
  ready: false,
  busy: false,
  error: ''
};

let state = { ...initialState };
let toastTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const viewRoot = $('#viewRoot');
const connectionBadge = $('#connectionBadge');
const toast = $('#toast');

const savedClientState = readClientState();

boot();

document.addEventListener('click', (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  const postId = Number(actionEl.dataset.postId || 0);
  const commentId = Number(actionEl.dataset.commentId || 0);
  const view = actionEl.dataset.view;

  if (action === 'set-view') setView(view);
  if (action === 'open-post') openPost(postId);
  if (action === 'like-post') likePost(postId);
  if (action === 'toggle-post') togglePost(postId);
  if (action === 'delete-post') deletePost(postId);
  if (action === 'delete-comment') deleteComment(commentId);
  if (action === 'refresh') refreshData({ silent: false });
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  event.preventDefault();
  if (form.id === 'composeForm') submitPost(form);
  if (form.id === 'commentForm') submitComment(form);
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.id === 'adminFilter') {
    state = { ...state, adminFilter: target.value };
    render();
  }
});

async function boot() {
  setConnection('pending', '连接中');
  renderLoading();

  try {
    await ensureSchema();
    await seedIfEmpty();
    await refreshData({ silent: true });
    state = { ...state, ready: true, error: '' };
    setConnection('ok', '已连接');
    render();
  } catch (error) {
    state = { ...state, ready: false, error: getErrorMessage(error) };
    setConnection('error', '连接失败');
    renderError();
  }
}

async function ensureSchema() {
  await apiTransaction([
    {
      mode: 'write',
      sql: `create table if not exists demo_blog_posts (
        id integer primary key autoincrement,
        title text not null,
        author text not null,
        excerpt text not null,
        content text not null,
        category text not null default '随笔',
        likes integer not null default 0,
        status text not null default 'published',
        created_at text not null default CURRENT_TIMESTAMP,
        updated_at text not null default CURRENT_TIMESTAMP
      )`
    },
    {
      mode: 'write',
      sql: `create table if not exists demo_blog_comments (
        id integer primary key autoincrement,
        post_id integer not null,
        author text not null,
        content text not null,
        status text not null default 'visible',
        created_at text not null default CURRENT_TIMESTAMP
      )`
    },
    {
      mode: 'write',
      sql: 'create index if not exists idx_demo_blog_posts_status_created on demo_blog_posts(status, created_at)'
    },
    {
      mode: 'write',
      sql: 'create index if not exists idx_demo_blog_comments_post on demo_blog_comments(post_id, created_at)'
    }
  ]);
}

async function seedIfEmpty() {
  const result = await apiQuery({
    mode: 'read',
    sql: 'select count(*) as count from demo_blog_posts'
  });
  const count = Number(result.results[0]?.rows?.[0]?.count || 0);
  if (count > 0) return;

  const now = new Date().toISOString();
  await apiTransaction([
    {
      mode: 'write',
      sql: `insert into demo_blog_posts(title, author, excerpt, content, category, likes, status, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        '用 Lsqlite 搭一个轻量博客',
        'Demo Admin',
        '这个示例把文章、点赞、评论和管理后台都放在一个静态页面里，数据直接写入 SQLite 服务。',
        '这是第一篇演示文章。页面启动时会自动确认表结构，随后通过 HTTP SQL API 读取和写入数据。\n\n你可以在「发帖」里新增文章，在文章详情里点赞和评论，也可以进入「管理后台」隐藏、恢复或删除内容。',
        '工程实践',
        12,
        'published',
        now,
        now
      ]
    },
    {
      mode: 'write',
      sql: `insert into demo_blog_posts(title, author, excerpt, content, category, likes, status, created_at, updated_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        '静态前端也能拥有完整数据流',
        'Lsqlite Bot',
        '不需要额外后端路由，浏览器即可通过 key 访问独立 SQLite 数据库。',
        '这个 demo 的边界很清晰：\n\n- 前端负责页面状态、交互和展示。\n- Lsqlite 服务负责认证、SQL 执行和 SQLite 持久化。\n- 管理后台是同一份数据上的管理视图。\n\n适合快速验证内容型产品、活动页和内部工具原型。',
        '产品原型',
        8,
        'published',
        now,
        now
      ]
    },
    {
      mode: 'write',
      sql: `insert into demo_blog_comments(post_id, author, content, status, created_at)
        values (?, ?, ?, ?, ?)`,
      params: [1, '访客', '界面很清爽，点赞和评论也能实时更新。', 'visible', now]
    }
  ]);
}

async function refreshData({ silent } = { silent: false }) {
  if (!silent) setBusy(true);
  try {
    const [postsResult, commentsResult] = await Promise.all([
      apiQuery({
        mode: 'read',
        sql: `select
          p.*,
          coalesce(c.comment_count, 0) as comment_count
        from demo_blog_posts p
        left join (
          select post_id, count(*) as comment_count
          from demo_blog_comments
          where status = 'visible'
          group by post_id
        ) c on c.post_id = p.id
        order by datetime(p.created_at) desc, p.id desc`
      }),
      apiQuery({
        mode: 'read',
        sql: `select *
        from demo_blog_comments
        order by datetime(created_at) asc, id asc`
      })
    ]);

    state = {
      ...state,
      posts: postsResult.results[0]?.rows || [],
      comments: commentsResult.results[0]?.rows || [],
      error: ''
    };
    setConnection('ok', '已连接');
    render();
    if (!silent) showToast('数据已刷新');
  } catch (error) {
    state = { ...state, error: getErrorMessage(error) };
    setConnection('error', '连接失败');
    render();
    showToast(state.error, 'error');
  } finally {
    if (!silent) setBusy(false);
  }
}

async function submitPost(form) {
  const data = Object.fromEntries(new FormData(form));
  const title = normalizeText(data.title);
  const author = normalizeText(data.author) || '匿名作者';
  const category = normalizeText(data.category) || '随笔';
  const excerpt = normalizeText(data.excerpt);
  const content = normalizeText(data.content);

  if (!title || !excerpt || !content) {
    showToast('标题、摘要和正文不能为空', 'error');
    return;
  }

  setBusy(true);
  try {
    const now = new Date().toISOString();
    await apiQuery({
      mode: 'write',
      sql: `insert into demo_blog_posts(title, author, excerpt, content, category, likes, status, created_at, updated_at)
        values (?, ?, ?, ?, ?, 0, 'published', ?, ?)`,
      params: [title, author, excerpt, content, category, now, now]
    });
    form.reset();
    await refreshData({ silent: true });
    state = { ...state, view: 'feed' };
    render();
    showToast('文章已发布');
  } catch (error) {
    showToast(getErrorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function submitComment(form) {
  const postId = Number(form.dataset.postId || 0);
  const data = Object.fromEntries(new FormData(form));
  const author = normalizeText(data.author) || '匿名访客';
  const content = normalizeText(data.content);

  if (!postId || !content) {
    showToast('评论内容不能为空', 'error');
    return;
  }

  setBusy(true);
  try {
    await apiQuery({
      mode: 'write',
      sql: `insert into demo_blog_comments(post_id, author, content, status, created_at)
        values (?, ?, ?, 'visible', ?)`,
      params: [postId, author, content, new Date().toISOString()]
    });
    form.reset();
    await refreshData({ silent: true });
    state = { ...state, view: 'detail', selectedPostId: postId };
    render();
    showToast('评论已发布');
  } catch (error) {
    showToast(getErrorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function likePost(postId) {
  if (!postId) return;
  const likedPosts = new Set(savedClientState.likedPosts || []);
  if (likedPosts.has(postId)) {
    showToast('这个浏览器已经点过赞了');
    return;
  }

  setBusy(true);
  try {
    await apiQuery({
      mode: 'write',
      sql: `update demo_blog_posts
        set likes = likes + 1, updated_at = ?
        where id = ?`,
      params: [new Date().toISOString(), postId]
    });
    likedPosts.add(postId);
    savedClientState.likedPosts = Array.from(likedPosts);
    writeClientState(savedClientState);
    await refreshData({ silent: true });
    state = { ...state, view: state.view, selectedPostId: postId };
    render();
    showToast('点赞成功');
  } catch (error) {
    showToast(getErrorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function togglePost(postId) {
  const post = state.posts.find((item) => Number(item.id) === postId);
  if (!post) return;
  const nextStatus = post.status === 'published' ? 'hidden' : 'published';

  setBusy(true);
  try {
    await apiQuery({
      mode: 'write',
      sql: `update demo_blog_posts
        set status = ?, updated_at = ?
        where id = ?`,
      params: [nextStatus, new Date().toISOString(), postId]
    });
    await refreshData({ silent: true });
    showToast(nextStatus === 'published' ? '文章已恢复展示' : '文章已隐藏');
  } catch (error) {
    showToast(getErrorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function deletePost(postId) {
  const post = state.posts.find((item) => Number(item.id) === postId);
  if (!post) return;
  if (!confirm(`确认删除文章「${post.title}」及其评论？`)) return;

  setBusy(true);
  try {
    await apiTransaction([
      {
        mode: 'write',
        sql: 'delete from demo_blog_comments where post_id = ?',
        params: [postId]
      },
      {
        mode: 'write',
        sql: 'delete from demo_blog_posts where id = ?',
        params: [postId]
      }
    ]);
    await refreshData({ silent: true });
    state = { ...state, view: 'admin', selectedPostId: null };
    render();
    showToast('文章已删除');
  } catch (error) {
    showToast(getErrorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function deleteComment(commentId) {
  if (!commentId) return;
  if (!confirm('确认删除这条评论？')) return;

  setBusy(true);
  try {
    await apiQuery({
      mode: 'write',
      sql: 'delete from demo_blog_comments where id = ?',
      params: [commentId]
    });
    await refreshData({ silent: true });
    render();
    showToast('评论已删除');
  } catch (error) {
    showToast(getErrorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

function setView(view) {
  if (!['feed', 'compose', 'admin'].includes(view)) return;
  state = { ...state, view, selectedPostId: null };
  render();
}

function openPost(postId) {
  const post = state.posts.find((item) => Number(item.id) === postId);
  if (!post) return;
  state = { ...state, view: 'detail', selectedPostId: postId };
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  updateNav();

  if (!state.ready && state.error) {
    renderError();
    return;
  }

  if (state.view === 'compose') renderCompose();
  else if (state.view === 'admin') renderAdmin();
  else if (state.view === 'detail') renderDetail();
  else renderFeed();
}

function renderLoading() {
  viewRoot.innerHTML = `
    <section class="loading-card">
      <div class="loader"></div>
      <div>
        <strong>正在连接服务</strong>
        <p>初始化博客表结构并读取文章数据。</p>
      </div>
    </section>
  `;
}

function renderError() {
  viewRoot.innerHTML = `
    <section class="empty-state">
      <div>
        <h2>服务暂时不可用</h2>
        <p>${escapeHtml(state.error || '请检查服务地址、访问 key 或网络连接。')}</p>
        <button class="primary-button" type="button" data-action="refresh">重新连接</button>
      </div>
    </section>
  `;
}

function renderFeed() {
  const publishedPosts = state.posts.filter((post) => post.status === 'published');
  const stats = buildStats();

  viewRoot.innerHTML = `
    <section class="hero">
      <div class="hero-card">
        <span class="eyebrow">简单博客 Demo</span>
        <h1>发帖、点赞、评论和管理后台，一页完成。</h1>
        <p>这个 demo 使用静态前端直连 Lsqlite 服务，所有文章与互动数据都落在当前项目实际部署的 SQLite 数据库中。</p>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-action="set-view" data-view="compose">发布新文章</button>
          <button class="ghost-button" type="button" data-action="set-view" data-view="admin">进入管理后台</button>
        </div>
      </div>
      <aside class="stats-card" aria-label="博客统计">
        ${statItem('文章', stats.publishedPosts)}
        ${statItem('点赞', stats.likes)}
        ${statItem('评论', stats.visibleComments)}
        ${statItem('隐藏', stats.hiddenPosts)}
      </aside>
    </section>

    <section class="layout-grid">
      <div>
        <div class="section-title">
          <div>
            <h2>最新文章</h2>
            <p>只展示已发布文章，隐藏内容可在后台恢复。</p>
          </div>
          <button class="ghost-button" type="button" data-action="refresh">刷新</button>
        </div>
        <div class="feed-list">
          ${publishedPosts.length ? publishedPosts.map(renderPostCard).join('') : renderEmpty('还没有已发布文章，先发一篇吧。')}
        </div>
      </div>
      <aside>
        <section class="panel">
          <h2>数据后端</h2>
          <p class="field-hint">服务地址</p>
          <p>${escapeHtml(REMOTE_API_BASE)}</p>
          <p class="field-hint">当前能力</p>
          <p>初始化表结构、发布文章、点赞、评论、隐藏、恢复、删除。</p>
        </section>
        <section class="panel">
          <h2>快速入口</h2>
          <div class="form-grid">
            <button class="primary-button" type="button" data-action="set-view" data-view="compose">发帖</button>
            <button class="ghost-button" type="button" data-action="set-view" data-view="admin">管理后台</button>
          </div>
        </section>
      </aside>
    </section>
  `;
}

function renderPostCard(post) {
  return `
    <article class="post-card ${post.status !== 'published' ? 'is-hidden' : ''}">
      <div class="post-meta">
        <span class="badge">${escapeHtml(post.category)}</span>
        <span>${escapeHtml(post.author)}</span>
        <span>${formatDate(post.created_at)}</span>
      </div>
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.excerpt)}</p>
      <div class="row-actions">
        <button class="primary-button" type="button" data-action="open-post" data-post-id="${post.id}">阅读全文</button>
        <button class="ghost-button" type="button" data-action="like-post" data-post-id="${post.id}">${hasLiked(post.id) ? '已赞' : '点赞'} · ${Number(post.likes || 0)}</button>
        <span class="badge is-muted">评论 ${Number(post.comment_count || 0)}</span>
      </div>
    </article>
  `;
}

function renderCompose() {
  viewRoot.innerHTML = `
    <section class="layout-grid">
      <div class="panel">
        <h2>发布新文章</h2>
        <form id="composeForm" class="form-grid">
          <div class="field">
            <label for="title">标题</label>
            <input id="title" name="title" maxlength="120" placeholder="例如：一次快速产品验证" required />
          </div>
          <div class="field">
            <label for="author">作者</label>
            <input id="author" name="author" maxlength="60" placeholder="默认：匿名作者" />
          </div>
          <div class="field">
            <label for="category">分类</label>
            <input id="category" name="category" maxlength="40" placeholder="默认：随笔" />
          </div>
          <div class="field">
            <label for="excerpt">摘要</label>
            <textarea id="excerpt" name="excerpt" maxlength="260" placeholder="一句话说明这篇文章的价值" required></textarea>
          </div>
          <div class="field">
            <label for="content">正文</label>
            <textarea id="content" name="content" maxlength="8000" placeholder="写下完整内容" required></textarea>
          </div>
          <div class="form-actions">
            <button class="primary-button" type="submit" ${state.busy ? 'disabled' : ''}>发布文章</button>
            <button class="ghost-button" type="button" data-action="set-view" data-view="feed">取消</button>
          </div>
        </form>
      </div>
      <aside class="panel">
        <h2>发帖说明</h2>
        <p>提交后会立即写入远程 SQLite，并出现在博客首页。管理后台可以隐藏或删除文章。</p>
      </aside>
    </section>
  `;
}

function renderDetail() {
  const post = state.posts.find((item) => Number(item.id) === Number(state.selectedPostId));
  if (!post) {
    state = { ...state, view: 'feed', selectedPostId: null };
    renderFeed();
    return;
  }

  const comments = state.comments.filter((comment) => Number(comment.post_id) === Number(post.id) && comment.status === 'visible');

  viewRoot.innerHTML = `
    <section class="post-detail">
      <header class="post-detail-header">
        <div class="post-meta">
          <span class="badge">${escapeHtml(post.category)}</span>
          <span>${escapeHtml(post.author)}</span>
          <span>${formatDate(post.created_at)}</span>
        </div>
        <h1>${escapeHtml(post.title)}</h1>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="row-actions">
          <button class="ghost-button" type="button" data-action="set-view" data-view="feed">返回列表</button>
          <button class="ghost-button" type="button" data-action="like-post" data-post-id="${post.id}">${hasLiked(post.id) ? '已点赞' : '点赞'} · ${Number(post.likes || 0)}</button>
        </div>
      </header>

      <section class="panel">
        <div class="post-detail-body">${escapeHtml(post.content)}</div>
      </section>

      <section class="layout-grid">
        <div class="panel">
          <h2>评论 ${comments.length}</h2>
          <div class="comment-list">
            ${comments.length ? comments.map(renderCommentCard).join('') : renderEmpty('还没有评论，来抢第一条。')}
          </div>
        </div>
        <aside class="panel">
          <h2>发表评论</h2>
          <form id="commentForm" class="form-grid" data-post-id="${post.id}">
            <div class="field">
              <label for="commentAuthor">昵称</label>
              <input id="commentAuthor" name="author" maxlength="60" placeholder="默认：匿名访客" />
            </div>
            <div class="field">
              <label for="commentContent">内容</label>
              <textarea id="commentContent" name="content" maxlength="1000" placeholder="写下你的想法" required></textarea>
            </div>
            <button class="primary-button" type="submit" ${state.busy ? 'disabled' : ''}>提交评论</button>
          </form>
        </aside>
      </section>
    </section>
  `;
}

function renderCommentCard(comment) {
  return `
    <article class="comment-card">
      <div class="comment-meta">
        <strong>${escapeHtml(comment.author)}</strong>
        <span>${formatDate(comment.created_at)}</span>
      </div>
      <p>${escapeHtml(comment.content)}</p>
    </article>
  `;
}

function renderAdmin() {
  const stats = buildStats();
  const visiblePosts = state.posts.filter((post) => {
    if (state.adminFilter === 'all') return true;
    return post.status === state.adminFilter;
  });
  const visibleComments = state.comments.filter((comment) => comment.status === 'visible');

  viewRoot.innerHTML = `
    <section class="hero">
      <div class="hero-card">
        <span class="eyebrow">管理后台</span>
        <h1>统一管理文章、评论和展示状态。</h1>
        <p>后台直接操作同一份 SQLite 数据。适合演示内容审核、下架恢复、互动维护等基础 CMS 流程。</p>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-action="set-view" data-view="compose">新增文章</button>
          <button class="ghost-button" type="button" data-action="refresh">刷新数据</button>
        </div>
      </div>
      <aside class="stats-card" aria-label="后台统计">
        ${statItem('总文章', stats.totalPosts)}
        ${statItem('已发布', stats.publishedPosts)}
        ${statItem('总评论', stats.visibleComments)}
        ${statItem('总点赞', stats.likes)}
      </aside>
    </section>

    <section class="layout-grid">
      <div class="panel">
        <div class="section-title">
          <div>
            <h2>文章管理</h2>
            <p>隐藏后不在首页展示，但后台仍可恢复。</p>
          </div>
          <div class="admin-toolbar">
            <select id="adminFilter" aria-label="筛选文章状态">
              <option value="all" ${state.adminFilter === 'all' ? 'selected' : ''}>全部</option>
              <option value="published" ${state.adminFilter === 'published' ? 'selected' : ''}>已发布</option>
              <option value="hidden" ${state.adminFilter === 'hidden' ? 'selected' : ''}>已隐藏</option>
            </select>
          </div>
        </div>
        <div class="admin-list">
          ${visiblePosts.length ? visiblePosts.map(renderAdminPostRow).join('') : renderEmpty('当前筛选条件下没有文章。')}
        </div>
      </div>

      <aside class="panel">
        <h2>评论管理</h2>
        <div class="comment-list">
          ${visibleComments.length ? visibleComments.slice(-8).reverse().map(renderAdminCommentRow).join('') : renderEmpty('暂无评论。')}
        </div>
      </aside>
    </section>
  `;
}

function renderAdminPostRow(post) {
  return `
    <article class="admin-row">
      <div>
        <div class="admin-meta">
          <span class="badge ${post.status === 'published' ? '' : 'is-danger'}">${post.status === 'published' ? '已发布' : '已隐藏'}</span>
          <span>${escapeHtml(post.author)}</span>
          <span>${formatDate(post.created_at)}</span>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        <p class="field-hint">点赞 ${Number(post.likes || 0)} · 评论 ${Number(post.comment_count || 0)} · 分类 ${escapeHtml(post.category)}</p>
      </div>
      <div class="row-actions">
        <button class="ghost-button" type="button" data-action="open-post" data-post-id="${post.id}">查看</button>
        <button class="ghost-button" type="button" data-action="toggle-post" data-post-id="${post.id}">${post.status === 'published' ? '隐藏' : '恢复'}</button>
        <button class="danger-button" type="button" data-action="delete-post" data-post-id="${post.id}">删除</button>
      </div>
    </article>
  `;
}

function renderAdminCommentRow(comment) {
  const post = state.posts.find((item) => Number(item.id) === Number(comment.post_id));
  return `
    <article class="comment-card">
      <div class="comment-meta">
        <strong>${escapeHtml(comment.author)}</strong>
        <span>${formatDate(comment.created_at)}</span>
      </div>
      <p>${escapeHtml(comment.content)}</p>
      <p class="field-hint">文章：${escapeHtml(post?.title || '已删除文章')}</p>
      <div class="comment-actions">
        <button class="danger-button" type="button" data-action="delete-comment" data-comment-id="${comment.id}">删除评论</button>
      </div>
    </article>
  `;
}

function statItem(label, value) {
  return `
    <div class="stat-item">
      <span>${escapeHtml(label)}</span>
      <strong>${Number(value || 0)}</strong>
    </div>
  `;
}

function renderEmpty(message) {
  return `
    <div class="empty-state">
      <div>${escapeHtml(message)}</div>
    </div>
  `;
}

function buildStats() {
  return {
    totalPosts: state.posts.length,
    publishedPosts: state.posts.filter((post) => post.status === 'published').length,
    hiddenPosts: state.posts.filter((post) => post.status !== 'published').length,
    likes: state.posts.reduce((sum, post) => sum + Number(post.likes || 0), 0),
    visibleComments: state.comments.filter((comment) => comment.status === 'visible').length
  };
}

function updateNav() {
  $$('.nav-button').forEach((button) => {
    const view = button.dataset.view;
    const active = view === state.view || (state.view === 'detail' && view === 'feed');
    button.classList.toggle('is-active', active);
  });
}

function setConnection(status, text) {
  connectionBadge.textContent = text;
  connectionBadge.className = `connection-badge is-${status}`;
}

function setBusy(busy) {
  state = { ...state, busy };
  document.body.classList.toggle('is-busy', busy);
}

async function apiQuery(payload) {
  const response = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response);
}

async function apiTransaction(statements) {
  const response = await fetch(`${API_BASE}/api/transaction`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ statements })
  });
  return parseApiResponse(response);
}

function apiHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const message = payload?.error?.message || `请求失败：${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function showToast(message, type = 'info') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast is-visible ${type === 'error' ? 'is-error' : ''}`;
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
  }, 2600);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function formatDate(value) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getErrorMessage(error) {
  if (error instanceof TypeError) return '无法访问服务，请确认网络、服务地址或浏览器 CORS 策略。';
  return error?.message || '未知错误';
}

function readClientState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"likedPosts":[]}');
  } catch {
    return { likedPosts: [] };
  }
}

function writeClientState(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function shouldUseLocalProxy() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:';
}

function hasLiked(postId) {
  return (savedClientState.likedPosts || []).includes(Number(postId));
}
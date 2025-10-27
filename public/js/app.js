import { buildApiUrl, describeFetchError } from './api-client.js';

let currentUser = null;
let currentCategory = null;
let accessToken = localStorage.getItem('access_token');

async function init() {
  if (accessToken) {
    await checkSession();
  }
  updateUI();
  setupEventListeners();
  await loadCategories();
  await loadPosts();
}

async function checkSession() {
  try {
    const response = await fetch(buildApiUrl('/api/auth/session'), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (data.session?.user) {
      currentUser = data.session.user;
    } else {
      clearSession();
    }
  } catch (error) {
    console.error('Session check failed:', error);
    clearSession();
  }
}

function clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  accessToken = null;
  currentUser = null;
}

function updateUI() {
  const loginLink = document.getElementById('login-link');
  const logoutBtn = document.getElementById('logout-btn');
  const newPostBtn = document.getElementById('new-post-btn');

  if (currentUser) {
    loginLink.style.display = 'none';
    logoutBtn.style.display = 'flex';
    newPostBtn.style.display = 'flex';
  } else {
    loginLink.style.display = 'flex';
    logoutBtn.style.display = 'none';
    newPostBtn.style.display = 'none';
  }
}

function setupEventListeners() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    clearSession();
    updateUI();
    showView('post-list');
    await loadPosts();
  });

  document.getElementById('new-post-btn').addEventListener('click', () => {
    showCreatePostModal();
  });

  document
    .getElementById('close-create-post-modal')
    .addEventListener('click', hideCreatePostModal);

  document.getElementById('create-post-form').addEventListener('submit', handleCreatePost);

  document.getElementById('back-btn').addEventListener('click', () => {
    showView('post-list');
    loadPosts();
  });

  document.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      hideCreatePostModal();
    }
  });
}

function showCreatePostModal() {
  document.getElementById('create-post-modal').style.display = 'flex';
  document.getElementById('post-title').focus();
}

function hideCreatePostModal() {
  document.getElementById('create-post-modal').style.display = 'none';
  document.getElementById('create-post-form').reset();
  document.getElementById('create-post-error').style.display = 'none';
}

async function handleCreatePost(e) {
  e.preventDefault();

  if (!currentUser) {
    alert('Please login to create a post');
    window.location.href = '/login';
    return;
  }

  const title = document.getElementById('post-title').value;
  const categoryId = document.getElementById('post-category').value;
  const content = document.getElementById('post-content').value;
  const errorDiv = document.getElementById('create-post-error');

  try {
    const response = await fetch(buildApiUrl('/api/posts'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        title,
        content,
        category_id: categoryId,
        author_id: currentUser.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create post');
    }

    hideCreatePostModal();
    await loadPosts();
  } catch (error) {
    errorDiv.textContent = describeFetchError(error, 'Failed to create post');
    errorDiv.style.display = 'block';
  }
}

async function loadCategories() {
  try {
    const response = await fetch(buildApiUrl('/api/categories'));
    const data = await response.json();

    const categoryList = document.getElementById('category-list');
    categoryList.innerHTML = '<button class="category-btn active" data-category="">All Posts</button>';

    const categorySelect = document.getElementById('post-category');
    categorySelect.innerHTML = '<option value="">Select a category</option>';

    data.forEach((category) => {
      const btn = document.createElement('button');
      btn.className = 'category-btn';
      btn.textContent = category.name;
      btn.dataset.category = category.slug;
      btn.addEventListener('click', () => {
        currentCategory = category.slug;
        document.querySelectorAll('.category-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        showView('post-list');
        loadPosts();
      });
      categoryList.appendChild(btn);

      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categoryList.querySelector('[data-category=""]').addEventListener('click', () => {
      currentCategory = null;
      document.querySelectorAll('.category-btn').forEach((b) => b.classList.remove('active'));
      categoryList.querySelector('[data-category=""]').classList.add('active');
      showView('post-list');
      loadPosts();
    });
  } catch (error) {
    console.error('Error loading categories:', error);
  }
}

async function loadPosts() {
  showLoading(true);

  try {
    const url = currentCategory
      ? buildApiUrl('/api/posts', { category: currentCategory })
      : buildApiUrl('/api/posts');

    const response = await fetch(url);
    const data = await response.json();

    displayPosts(data);
  } catch (error) {
    console.error('Error loading posts:', error);
  } finally {
    showLoading(false);
  }
}

function displayPosts(posts) {
  const postList = document.getElementById('post-list');

  if (posts.length === 0) {
    postList.innerHTML = '<div class="empty-state">No posts yet. Be the first to create one!</div>';
    return;
  }

  postList.innerHTML = posts
    .map(
      (post) => `
    <div class="post-card" data-post-id="${post.id}">
      <h3 class="post-title">${escapeHtml(post.title)}</h3>
      <p class="post-excerpt">${escapeHtml(post.content)}</p>
      <div class="post-meta">
        <span class="post-author">${escapeHtml(post.profiles?.username || 'Anonymous')}</span>
        <span class="post-time">
          <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${formatDate(post.created_at)}
        </span>
        ${post.categories ? `<span class="post-category-badge">${escapeHtml(post.categories.name)}</span>` : ''}
        <span class="post-comments">
          <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          ${post.comment_count}
        </span>
      </div>
    </div>
  `
    )
    .join('');

  document.querySelectorAll('.post-card').forEach((card) => {
    card.addEventListener('click', () => {
      loadPostDetail(card.dataset.postId);
    });
  });
}

async function loadPostDetail(postId) {
  showView('post-detail');
  showLoading(true);

  try {
    const [postResponse, commentsResponse] = await Promise.all([
      fetch(buildApiUrl(`/api/posts/${postId}`)),
      fetch(buildApiUrl('/api/comments', { post_id: postId }))
    ]);

    const post = await postResponse.json();
    const comments = await commentsResponse.json();

    displayPostDetail(post, comments);
  } catch (error) {
    console.error('Error loading post:', error);
  } finally {
    showLoading(false);
  }
}

function displayPostDetail(post, comments) {
  const postContent = document.getElementById('post-content');
  const commentsSection = document.getElementById('comments-section');

  postContent.innerHTML = `
    <div class="post-detail-header">
      <h1 class="post-detail-title">${escapeHtml(post.title)}</h1>
      <div class="post-meta">
        <span class="post-author">${escapeHtml(post.profiles?.username || 'Anonymous')}</span>
        <span class="post-time">
          <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${formatDate(post.created_at)}
        </span>
        ${post.categories ? `<span class="post-category-badge">${escapeHtml(post.categories.name)}</span>` : ''}
      </div>
    </div>
    <div class="post-detail-content">${escapeHtml(post.content)}</div>
  `;

  commentsSection.innerHTML = `
    <h3 class="comments-title">Comments (${comments.length})</h3>
    ${
      currentUser
        ? `
      <form class="comment-form" id="comment-form">
        <div class="form-group">
          <textarea id="comment-content" placeholder="Write a comment..." rows="3" required></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Post Comment</button>
      </form>
    `
        : '<p class="empty-state">Please <a href="/login">login</a> to comment</p>'
    }
    <div class="comment-list">
      ${comments
        .map(
          (comment) => `
        <div class="comment-card">
          <div class="comment-author">${escapeHtml(comment.profiles?.username || 'Anonymous')}</div>
          <div class="comment-content">${escapeHtml(comment.content)}</div>
          <div class="comment-time">${formatDate(comment.created_at)}</div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  if (currentUser) {
    document.getElementById('comment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCreateComment(post.id);
    });
  }
}

async function handleCreateComment(postId) {
  if (!currentUser) {
    alert('Please login to comment');
    window.location.href = '/login';
    return;
  }

  const content = document.getElementById('comment-content').value;

  try {
    const response = await fetch(buildApiUrl('/api/comments'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        content,
        post_id: postId,
        author_id: currentUser.id
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create comment');
    }

    await loadPostDetail(postId);
  } catch (error) {
    console.error('Error creating comment:', describeFetchError(error, 'Failed to create comment'));
    alert('Failed to create comment');
  }
}

function showView(viewName) {
  document.getElementById('post-list').style.display = viewName === 'post-list' ? 'block' : 'none';
  document.getElementById('post-detail').style.display = viewName === 'post-detail' ? 'block' : 'none';
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init();

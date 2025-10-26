const API_URL = window.location.origin;
let currentUser = null;
let profileUser = null;
let accessToken = localStorage.getItem('access_token');
console.log('accessToken:', localStorage.getItem('access_token'));


// Pega o ID do usuário da URL
const userId = window.location.pathname.split('/').pop();

async function init() {
  console.log('currentUser antes do checkSession:', currentUser);

  if (accessToken) {
    await checkSession();
  }

  console.log('currentUser depois do checkSession:', currentUser);

  updateUI();
  setupEventListeners();
  await loadProfile();
  await loadUserPosts();
}


async function checkSession() {
  try {
    const response = await fetch(`${API_URL}/api/auth/session`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    console.log('data.session:', data.session); // verifique se tem o user

    if (data.session?.user) {
      currentUser = data.session.user; // <-- currentUser agora tem valor
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
    if (loginLink) loginLink.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'flex';
    if (newPostBtn) newPostBtn.style.display = 'flex';
  } else {
    if (loginLink) loginLink.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (newPostBtn) newPostBtn.style.display = 'none';
  }
}

function setupEventListeners() {
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    clearSession();
    window.location.href = '/';
  });

  document.getElementById('new-post-btn')?.addEventListener('click', () => {
    window.location.href = '/';
  });

  document.getElementById('edit-profile-btn')?.addEventListener('click', showEditProfileModal);
  document.getElementById('close-edit-profile-modal')?.addEventListener('click', hideEditProfileModal);
  document.getElementById('edit-profile-form')?.addEventListener('submit', handleEditProfile);
}

async function loadProfile() {
  showLoading(true);

  try {
    const response = await fetch(`${API_URL}/api/users/${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to load profile');
    }

    profileUser = data;
    displayProfile(data);
  } catch (error) {
    console.error('Error loading profile:', error);
    const profileContent = document.getElementById('profile-content');
    if (profileContent) profileContent.innerHTML = '<div class="empty-state">User not found</div>';
  } finally {
    showLoading(false);
    const profileContent = document.getElementById('profile-content');
    if (profileContent) profileContent.style.display = 'block';
  }
}

console.log('currentUser.id:', currentUser?.id);
console.log('userId from URL:', userId);
console.log('Are they equal?', String(currentUser?.id) === String(userId));


function displayProfile(profile) {
  const usernameEl = document.getElementById('profile-username');
  const bioEl = document.getElementById('profile-bio');
  const editBtn = document.getElementById('edit-profile-btn');

  if (usernameEl) usernameEl.textContent = profile.username || 'Anonymous';
  if (bioEl) bioEl.textContent = profile.bio || 'No bio yet';

  // Mostra o botão de edição apenas se o usuário logado for o mesmo do perfil
  if (editBtn && currentUser && String(currentUser.id) === String(userId)) {
    editBtn.style.display = 'flex';
  }
}

async function loadUserPosts() {
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}/posts`);
    const data = await response.json();

    const postCountEl = document.getElementById('profile-post-count');
    if (postCountEl) postCountEl.textContent = `${data.length} post${data.length !== 1 ? 's' : ''}`;

    displayPosts(data);
  } catch (error) {
    console.error('Error loading user posts:', error);
  }
}

function displayPosts(posts) {
  const userPosts = document.getElementById('user-posts');

  if (!userPosts) return;

  if (posts.length === 0) {
    userPosts.innerHTML = '<div class="empty-state">No posts yet</div>';
    return;
  }

  userPosts.innerHTML = posts.map(post => `
    <div class="post-card" onclick="window.location.href='/?post=${post.id}'">
      <h3 class="post-title">${escapeHtml(post.title)}</h3>
      <p class="post-excerpt">${escapeHtml(post.content)}</p>
      <div class="post-meta">
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
  `).join('');
}

function showEditProfileModal() {
  if (!profileUser) return;

  const usernameInput = document.getElementById('edit-username');
  const bioInput = document.getElementById('edit-bio');
  const modal = document.getElementById('edit-profile-modal');

  if (usernameInput) usernameInput.value = profileUser.username || '';
  if (bioInput) bioInput.value = profileUser.bio || '';
  if (modal) modal.style.display = 'flex';
}

function hideEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  const form = document.getElementById('edit-profile-form');
  const errorDiv = document.getElementById('edit-profile-error');

  if (modal) modal.style.display = 'none';
  if (form) form.reset();
  if (errorDiv) errorDiv.style.display = 'none';
}

async function handleEditProfile(e) {
  e.preventDefault();

  const username = document.getElementById('edit-username')?.value;
  const bio = document.getElementById('edit-bio')?.value;
  const errorDiv = document.getElementById('edit-profile-error');

  try {
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ username, bio })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Failed to update profile');

    profileUser = data;
    displayProfile(data);
    hideEditProfileModal();
  } catch (error) {
    if (errorDiv) {
      errorDiv.textContent = error.message;
      errorDiv.style.display = 'block';
    }
  }
}

function showLoading(show) {
  const loadingEl = document.getElementById('loading');
  if (loadingEl) loadingEl.style.display = show ? 'flex' : 'none';
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

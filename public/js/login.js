import { buildApiUrl, describeFetchError } from './api-client.js';

const loginEndpoint = buildApiUrl('/api/auth/login');
const sessionEndpoint = buildApiUrl('/api/auth/session');

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');
  const spinner = submitBtn.querySelector('.spinner');
  const btnText = submitBtn.querySelector('span');

  errorDiv.style.display = 'none';
  submitBtn.disabled = true;
  spinner.style.display = 'block';
  btnText.textContent = 'Logging in...';

  try {
    const response = await fetch(loginEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.data?.session?.access_token) {
      localStorage.setItem('access_token', data.data.session.access_token);
      localStorage.setItem('user', JSON.stringify(data.data.user));

      const profileResponse = await fetch(sessionEndpoint, {
        headers: {
          Authorization: `Bearer ${data.data.session.access_token}`
        }
      });

      if (profileResponse.ok) {
        window.location.href = '/';
      }
    } else {
      throw new Error('Invalid response from server');
    }
  } catch (error) {
    errorDiv.textContent = describeFetchError(error, 'Login failed');
    errorDiv.style.display = 'block';
    submitBtn.disabled = false;
    spinner.style.display = 'none';
    btnText.textContent = 'Login';
  }
});

import { buildApiUrl, describeFetchError } from './api-client.js';

const signupEndpoint = buildApiUrl('/api/auth/signup');

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const errorDiv = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');
  const spinner = submitBtn.querySelector('.spinner');
  const btnText = submitBtn.querySelector('span');

  errorDiv.style.display = 'none';

  if (username.length < 3) {
    errorDiv.textContent = 'Username must be at least 3 characters';
    errorDiv.style.display = 'block';
    return;
  }

  if (password !== confirmPassword) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.style.display = 'block';
    return;
  }

  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters';
    errorDiv.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  spinner.style.display = 'block';
  btnText.textContent = 'Creating account...';

  try {
    const response = await fetch(signupEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Signup failed');
    }

    if (data.data?.session?.access_token) {
      localStorage.setItem('access_token', data.data.session.access_token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      window.location.href = '/';
    } else if (data.data?.user) {
      errorDiv.textContent =
        'Account created! Please check your email to verify your account, then login.';
      errorDiv.style.display = 'block';
      errorDiv.style.background = '#d1fae5';
      errorDiv.style.color = '#065f46';
      errorDiv.style.borderLeft = '4px solid #10b981';

      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    }
  } catch (error) {
    errorDiv.textContent = describeFetchError(error, 'Signup failed');
    errorDiv.style.display = 'block';
    submitBtn.disabled = false;
    spinner.style.display = 'none';
    btnText.textContent = 'Sign Up';
  }
});

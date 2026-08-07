const content = document.getElementById("content");

function renderSuccess(message) {
  content.innerHTML = `
    <div class="icon">&#10004;</div>
    <h1>Email updated!</h1>
    <p>${message}</p>
    <a class="btn" href="/">Go to Home</a>
  `;
}

function renderError(title, message) {
  content.innerHTML = `
    <div class="icon">&#10060;</div>
    <h1>${title}</h1>
    <p>${message}</p>
  `;
}

async function verify() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    renderError("Invalid verification link", "This link is missing a verification token. Please request a new one.");
    return;
  }

  try {
    const res = await fetch("/api/v1/users/me/email/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const result = await res.json();

    if (res.ok) {
      renderSuccess(result.data?.message || "Your email has been updated.");
    } else if (res.status === 400) {
      renderError("Invalid request", result.message || "The verification request was invalid.");
    } else if (res.status === 401) {
      renderError("Sign in required", "Please sign in again and try the link once more.");
    } else if (res.status === 404) {
      renderError("Link not found", "This verification link is invalid. Please request a new one.");
    } else if (res.status === 410) {
      renderError("Link expired", "This verification link has expired or already been used. Please request a new one.");
    } else {
      renderError("Something went wrong", result.message || "Please try again later.");
    }
  } catch (err) {
    renderError("Connection error", "Could not reach the server. Please try again.");
  }
}

verify();

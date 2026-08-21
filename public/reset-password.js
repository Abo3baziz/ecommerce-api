const content = document.getElementById("content");

function clearContent() {
  while (content.firstChild) {
    content.removeChild(content.firstChild);
  }
}

function makeElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

function renderSuccess(message) {
  clearContent();
  content.appendChild(makeElement("div", "icon", "\u2704"));
  content.appendChild(makeElement("h1", null, "Password updated"));
  content.appendChild(makeElement("p", null, message));
  const link = makeElement("a", "btn-link", "Go to Home");
  link.href = "/";
  content.appendChild(link);
}

function renderError(title, message) {
  clearContent();
  content.appendChild(makeElement("div", "icon", "\u274C"));
  content.appendChild(makeElement("h1", null, title));
  content.appendChild(makeElement("p", null, message));
}

function showFormError(message) {
  let box = document.getElementById("form-error");
  if (!box) {
    box = makeElement("p", "hint");
    box.id = "form-error";
    box.style.color = "#c81e1e";
    const form = document.getElementById("reset-form");
    form.insertBefore(box, form.firstChild);
  }
  box.textContent = message;
}

async function submitReset(event) {
  event.preventDefault();

  const token = new URLSearchParams(window.location.search).get("token");
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const submitBtn = document.getElementById("submit-btn");

  if (!token) {
    renderError(
      "Invalid reset link",
      "This link is missing a reset token. Please request a new password reset email.",
    );
    return;
  }

  if (newPassword !== confirmPassword) {
    showFormError("The passwords do not match.");
    return;
  }

  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/v1/auth/password-reset/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token, new_password: newPassword }),
    });

    if (res.status === 204) {
      renderSuccess(
        "Your password has been changed. You can now sign in with your new password.",
      );
      return;
    }

    let result = {};
    try {
      result = await res.json();
    } catch (parseErr) {
      result = {};
    }

    if (res.status === 400) {
      showFormError(result.message || "The chosen password does not meet the requirements.");
    } else if (res.status === 404) {
      renderError(
        "Link not found",
        "This password reset link is invalid. Please request a new one.",
      );
    } else if (res.status === 410) {
      renderError(
        "Link expired",
        "This password reset link has expired or already been used. Please request a new one.",
      );
    } else {
      renderError("Something went wrong", result.message || "Please try again later.");
    }
  } catch (err) {
    renderError("Connection error", "Could not reach the server. Please try again.");
  } finally {
    submitBtn.disabled = false;
  }
}

const form = document.getElementById("reset-form");
form.addEventListener("submit", submitReset);

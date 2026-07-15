/**
 * Shared UI: theme toggle, mobile sidebar, connection status pill.
 */
(function () {
  const STORAGE_KEY = "pf-theme";

  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.setAttribute("title", theme === "dark" ? "Light mode" : "Dark mode");
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function initThemeToggle() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", toggleTheme);
    });
  }

  function initMobileNav() {
    const shell = document.querySelector(".app-shell");
    const toggle = document.querySelector("[data-nav-toggle]");
    const backdrop = document.querySelector("[data-nav-backdrop]");
    if (!shell || !toggle) return;

    const close = () => {
      shell.classList.remove("nav-open");
      backdrop?.classList.remove("nav-open");
    };

    toggle.addEventListener("click", () => {
      shell.classList.toggle("nav-open");
      backdrop?.classList.toggle("nav-open", shell.classList.contains("nav-open"));
    });

    backdrop?.addEventListener("click", close);
    document.querySelectorAll(".nav-item:not(.disabled)").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 900) close();
      });
    });
  }

  function formatStatus(el, ok, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("ok", "error", "pending");
    el.classList.add(ok ? "ok" : "error");
  }

  function formatStatusPending(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("ok", "error");
    el.classList.add("pending");
  }

  window.PathFinderUI = {
    applyTheme,
    toggleTheme,
    formatStatus,
    formatStatusPending,
    init() {
      applyTheme(getPreferredTheme());
      initThemeToggle();
      initMobileNav();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.PathFinderUI.init());
  } else {
    window.PathFinderUI.init();
  }
})();

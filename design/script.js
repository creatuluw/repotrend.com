/**
 * LLMNGN Site JavaScript
 * FAQ accordion and scroll animations
 */

document.addEventListener("DOMContentLoaded", () => {
  initFAQAccordion();
  initScrollAnimations();
  initNavScroll();
  initTerminalTyping();
});

/**
 * FAQ Accordion with smooth animation
 */
function initFAQAccordion() {
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");
    const answer = item.querySelector(".faq-answer");

    question.addEventListener("click", (e) => {
      e.preventDefault();

      const isOpen = item.hasAttribute("open");

      // Close all other items
      faqItems.forEach((otherItem) => {
        if (otherItem !== item && otherItem.hasAttribute("open")) {
          otherItem.removeAttribute("open");
          animateAnswer(otherItem.querySelector(".faq-answer"), false);
        }
      });

      // Toggle current item
      if (isOpen) {
        item.removeAttribute("open");
        animateAnswer(answer, false);
      } else {
        item.setAttribute("open", "");
        animateAnswer(answer, true);
      }
    });
  });
}

function animateAnswer(answer, isOpening) {
  if (isOpening) {
    answer.style.display = "block";
    answer.style.opacity = "0";
    answer.style.transform = "translateY(-10px)";

    requestAnimationFrame(() => {
      answer.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      answer.style.opacity = "1";
      answer.style.transform = "translateY(0)";
    });
  } else {
    answer.style.transition = "opacity 0.2s ease, transform 0.2s ease";
    answer.style.opacity = "0";
    answer.style.transform = "translateY(-10px)";

    setTimeout(() => {
      answer.style.display = "none";
    }, 200);
  }
}

/**
 * Scroll-triggered animations using Intersection Observer
 */
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -200px 0px",
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate-in");
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Elements to animate on scroll
  const animateElements = document.querySelectorAll(
    ".feature-card, .type-item, .install-step, .faq-item",
  );

  animateElements.forEach((el, index) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s`;
    observer.observe(el);
  });

  // Add CSS for animate-in state
  const style = document.createElement("style");
  style.textContent = `
    .animate-in {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Navigation scroll behavior
 */
function initNavScroll() {
  const nav = document.querySelector(".terminal-nav");
  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > 100) {
          nav.style.background = "rgba(10, 10, 10, 0.98)";
          nav.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.3)";
        } else {
          nav.style.background = "rgba(10, 10, 10, 0.9)";
          nav.style.boxShadow = "none";
        }

        lastScrollY = currentScrollY;
        ticking = false;
      });
      ticking = true;
    }
  });
}

/**
 * Terminal cursor blink synchronization
 */
function initTerminalTyping() {
  const cursors = document.querySelectorAll(
    ".terminal-cursor-block, .t-cursor",
  );

  cursors.forEach((cursor) => {
    cursor.style.animation = "blink 1s step-end infinite";
  });

  // Add blink keyframes if not already in CSS
  if (!document.querySelector("#blink-style")) {
    const style = document.createElement("style");
    style.id = "blink-style";
    style.textContent = `
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Smooth scroll for anchor links
 */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const href = this.getAttribute("href");

    // Special case for href="#" - scroll to top
    if (href === "#") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }

    const target = document.querySelector(href);
    if (target) {
      const navHeight = document.querySelector(".terminal-nav").offsetHeight;
      const targetPosition =
        target.getBoundingClientRect().top + window.scrollY - navHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });
    }
  });
});

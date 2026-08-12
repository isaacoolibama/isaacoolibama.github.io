document.getElementById('year').textContent = new Date().getFullYear();

/* nav scroll state */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

/* mobile menu */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => navLinks.classList.remove('open'))
);

/* active link on scroll */
const sections = document.querySelectorAll('section[id], header[id]');
const linkMap = new Map(
  [...navLinks.querySelectorAll('a')].map(a => [a.getAttribute('href').slice(1), a])
);
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const link = linkMap.get(entry.target.id);
    if (!link) return;
    if (entry.isIntersecting) {
      linkMap.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach(s => navObserver.observe(s));

/* scroll reveal */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* project filter */
const filterBtns = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    projectCards.forEach(card => {
      const show = filter === 'all' || card.dataset.type === filter;
      card.style.display = show ? '' : 'none';
    });
  });
});

/* konami code easter egg */
const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let progress = 0;
const toast = document.getElementById('eggToast');
let toastTimer;

window.addEventListener('keydown', (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  progress = key === konami[progress] ? progress + 1 : (key === konami[0] ? 1 : 0);
  if (progress === konami.length) {
    progress = 0;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }
});

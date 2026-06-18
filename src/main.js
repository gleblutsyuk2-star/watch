import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { init3D, updateProgress } from './watch3d.js';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
  setupLoaderAnd3D();
});

function setupLoaderAnd3D() {
  const progressFill = document.getElementById('loader-progress');
  const statusText = document.getElementById('loader-status');
  const loader = document.getElementById('loader');

  // Callback during resource loading (HDR + GLTF)
  const onProgress = (percent) => {
    progressFill.style.width = `${percent}%`;
    statusText.innerText = `Assembling calibre... ${percent}%`;
  };

  // Callback when loading is 100% complete
  const onLoad = () => {
    statusText.innerText = 'Calibre assembled. Initiating...';
    
    setTimeout(() => {
      // Fade out preloader
      loader.classList.add('loaded');
      
      // Initialize scroll animations and smooth scroll after preloader disappears
      initSmoothScrollAndAnimations();
    }, 800);
  };

  // Start 3D watch engine
  init3D(onProgress, onLoad);
}

function initSmoothScrollAndAnimations() {
  // 1. Initialize Lenis Smooth Scroll
  const lenis = new Lenis({
    duration: 1.4,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // premium ease out
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.2,
    infinite: false,
  });

  // Connect Lenis to requestAnimationFrame
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Synchronize Lenis with GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // 2. Bind Scroll Progress to 3D Watch Assembly with Dynamic Snapping to Sections
  const sections = gsap.utils.toArray('.section');
  
  // Calculate relative progress position for each section offset
  const getSnapPoints = () => {
    const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (totalScroll <= 0) return 0;
    return sections.map(sec => sec.offsetTop / totalScroll);
  };

  ScrollTrigger.create({
    trigger: '#scroll-container',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.15, // subtle scrubbing lag for extra smoothness
    onUpdate: (self) => {
      updateProgress(self.progress);
    },
    snap: {
      snapTo: getSnapPoints(),
      duration: { min: 0.4, max: 0.8 },
      delay: 0.12, // subtle delay to let scroll finish naturally, then snap
      ease: 'power2.out'
    }
  });

  // 3. Section Transitions and Content Animations
  
  // Hero Text Animation
  gsap.fromTo('.hero-title', 
    { opacity: 0, y: 50 },
    { opacity: 1, y: 0, duration: 1.5, ease: 'power4.out', delay: 0.2 }
  );
  gsap.fromTo('.hero-subtitle', 
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.6 }
  );
  gsap.fromTo('.scroll-prompt', 
    { opacity: 0 },
    { opacity: 0.8, duration: 1.5, ease: 'power2.out', delay: 1.2 }
  );

  // Philosophy Section fade-in
  gsap.from('.philosophy-text-block > *', {
    scrollTrigger: {
      trigger: '#philosophy',
      start: 'top 70%',
      end: 'top 30%',
      scrub: 1
    },
    opacity: 0,
    y: 30,
    stagger: 0.1,
    duration: 1
  });
  
  gsap.from('.philosophy-visual', {
    scrollTrigger: {
      trigger: '#philosophy',
      start: 'top 65%',
      end: 'top 25%',
      scrub: 1
    },
    opacity: 0,
    x: 50,
    duration: 1.2
  });

  // Craftsmanship Steps (Highlights active steps on scroll)
  const steps = document.querySelectorAll('.craft-step');
  steps.forEach((step, index) => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 75%',
      end: 'bottom 45%',
      onEnter: () => step.classList.add('active'),
      onLeave: () => step.classList.remove('active'),
      onEnterBack: () => step.classList.add('active'),
      onLeaveBack: () => step.classList.remove('active')
    });
  });

  // Collections Cards staggered entrance
  gsap.from('.collection-card', {
    scrollTrigger: {
      trigger: '#collections',
      start: 'top 75%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 60,
    stagger: 0.15,
    duration: 1.2,
    ease: 'power3.out'
  });

  // Materials list fade-in
  gsap.from('.materials-item', {
    scrollTrigger: {
      trigger: '#materials',
      start: 'top 75%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    y: 30,
    stagger: 0.1,
    duration: 1,
    ease: 'power2.out'
  });

  // Precision (Numbers counting animation)
  const metricItems = document.querySelectorAll('.metric-item');
  metricItems.forEach((item) => {
    const valueEl = item.querySelector('.metric-value');
    const targetValue = parseInt(valueEl.getAttribute('data-value'), 10);
    const isAccuracy = valueEl.innerText.includes('±');

    let counter = { val: 0 };
    
    gsap.to(counter, {
      scrollTrigger: {
        trigger: '#precision',
        start: 'top 70%',
        toggleActions: 'play none none reverse'
      },
      val: targetValue,
      duration: 2.5,
      ease: 'power3.out',
      onUpdate: () => {
        if (isAccuracy) {
          valueEl.innerText = `±${Math.round(counter.val)}s`;
        } else if (targetValue === 120) {
          valueEl.innerText = `${Math.round(counter.val)}h`;
        } else {
          valueEl.innerText = Math.round(counter.val);
        }
      }
    });
  });

  // Experience timeline staggered entrance
  gsap.from('.timeline-item', {
    scrollTrigger: {
      trigger: '#experience',
      start: 'top 70%',
      toggleActions: 'play none none reverse'
    },
    opacity: 0,
    x: -30,
    stagger: 0.15,
    duration: 1,
    ease: 'power2.out'
  });

  // Final CTA button hover effect pulse
  const ctaBtn = document.getElementById('main-cta-btn');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      alert('Private consultation scheduling will open shortly. Thank you for your interest in AETERNA.');
    });
  }
  
  const headerCtaBtn = document.getElementById('header-cta-btn');
  if (headerCtaBtn) {
    headerCtaBtn.addEventListener('click', () => {
      alert('Booking client portal loading...');
    });
  }
}

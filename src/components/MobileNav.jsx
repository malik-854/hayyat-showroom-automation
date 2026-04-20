import React from 'react';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { id: 'home',     label: 'Home',     icon: '⌂' },
  { id: 'showroom', label: 'Showroom', icon: '✦' },
  { id: 'story',    label: 'Our Story',icon: '📖' },
  { id: 'contact',  label: 'Contact',  icon: '✉' },
];

const MobileNav = ({ currentView, setView }) => {
  return (
    <motion.nav
      className="mobile-bottom-nav"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setView(item.id)}
            aria-label={item.label}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
            {isActive && (
              <motion.div
                className="mobile-nav-active-dot"
                layoutId="mobile-active-dot"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </motion.nav>
  );
};

export default MobileNav;

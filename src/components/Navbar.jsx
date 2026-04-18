import React from 'react';
import { motion } from 'framer-motion';

const Navbar = ({ setView }) => {
  return (
    <motion.nav 
      className="glass-navbar"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="navbar-container">
        <div className="logo" onClick={() => setView('home')}>Hayyat Furnishes</div>
        <div className="nav-links">
          <span className="nav-link" onClick={() => setView('home')}>Home</span>
          <span className="nav-link" onClick={() => setView('showroom')}>Showroom</span>
          <span className="nav-link" onClick={() => setView('story')}>Our Story</span>
          <span className="nav-link" onClick={() => setView('contact')}>Contact</span>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;

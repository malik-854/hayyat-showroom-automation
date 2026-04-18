import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar';
import Home from './components/Home';
import ProductPage from './components/ProductPage';
import OurStory from './components/OurStory';
import Contact from './components/Contact';
import SpotlightBackground from './components/SpotlightBackground';
import './App.css';

function App() {
  // view routing state: 'home' | 'product' | 'story' | 'contact'
  const [view, setView] = useState('home');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setView('product');
  };

  const handleSetView = (newView) => {
    if (newView === 'showroom') {
      setView('home'); // Map showroom back to home/grid
    } else {
      setView(newView);
    }
  };

  return (
    <div className="app-container">
      <SpotlightBackground />
      <Navbar setView={handleSetView} />
      
      <main className="main-content">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <Home key="home" onSelectProduct={handleSelectProduct} />
          )}
          {view === 'product' && selectedProduct && (
            <motion.div
              key="product"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <ProductPage product={selectedProduct} />
            </motion.div>
          )}
          {view === 'story' && (
            <OurStory key="story" />
          )}
          {view === 'contact' && (
            <Contact key="contact" />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;

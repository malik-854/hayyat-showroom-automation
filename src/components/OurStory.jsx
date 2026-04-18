import React from 'react';
import { motion } from 'framer-motion';

const OurStory = () => {
  return (
    <motion.div 
      className="story-container"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <section className="story-hero">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 1 }}
          className="story-title"
        >
          A Legacy of Craftsmanship
        </motion.h1>
      </section>
      
      <section className="story-content container">
        <div className="story-grid">
          <motion.div 
            className="story-text"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2>Inherited Artistry</h2>
            <p>
              Founded in the heart of Lahore, Hayyat Furnishes began as a small atelier dedicated to the 
              art of hand-carved wood. For generations, we have preserved the techniques that 
              define premium furniture—blending traditional wisdom with modern innovation.
            </p>
          </motion.div>
          
          <motion.div 
            className="story-image-placeholder"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            {/* Using a generated image or placeholder style */}
            <div className="placeholder-box">The Art of Wood</div>
          </motion.div>
        </div>

        <motion.div 
          className="story-philosophy"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 1 }}
          viewport={{ once: true }}
        >
          <h3>Our Philosophy</h3>
          <p>
            We believe that every piece of furniture should tell a story. Not just the story of its 
            materials, but the story of the home it inhabits. Every grain of walnut and every 
            stitch of leather is a testament to our commitment to excellence.
          </p>
        </motion.div>
      </section>
    </motion.div>
  );
};

export default OurStory;

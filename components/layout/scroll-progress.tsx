"use client"

import React, { useState, useEffect } from 'react';

interface ScrollProgressProps {
    progress: number;
  }
  
  const ScrollProgress: React.FC<ScrollProgressProps> = ({ progress }) => {
  return (
    <div
      style={{
        height: '2px',
        marginBottom: "-1px",
        background: '#595959',
        width: `${progress}%`,
        transition: 'width 0s',
        position: 'absolute',
        bottom: 0, // Position at the bottom of the TopBar
      }}
    />
  );
};

export default ScrollProgress;

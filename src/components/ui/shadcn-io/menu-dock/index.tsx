'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Home, Briefcase, Calendar, Shield, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconComponentType = React.ElementType<{ className?: string }>;

export interface MenuDockItem {
  label: string;
  icon: IconComponentType;
  onClick?: () => void;
}

export interface MenuDockProps {
  items?: MenuDockItem[];
  className?: string;
  variant?: 'default' | 'compact' | 'large';
  orientation?: 'horizontal' | 'vertical';
  showLabels?: boolean;
  animated?: boolean;
}

const defaultItems: MenuDockItem[] = [
    { label: 'home', icon: Home },
    { label: 'work', icon: Briefcase },
    { label: 'calendar', icon: Calendar },
    { label: 'security', icon: Shield },
    { label: 'settings', icon: Settings },
];

export const MenuDock: React.FC<MenuDockProps> = ({ 
  items, 
  className,
  variant = 'default',
  orientation = 'horizontal',
  showLabels = true,
  animated = true
}) => {

  const finalItems = useMemo(() => {
     const isValid = items && Array.isArray(items) && items.length >= 2 && items.length <= 8;
     if (!isValid) {
        console.warn("MenuDock: 'items' prop is invalid or missing. Using default items.", items);
        return defaultItems;
     }
     return items;
  }, [items]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [underlineWidth, setUnderlineWidth] = useState(0);
  const [underlineLeft, setUnderlineLeft] = useState(0);
  
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
      if (activeIndex >= finalItems.length && activeIndex !== 0) {
           
          setActiveIndex(0);
      }
  }, [finalItems, activeIndex]);

  useEffect(() => {
    let rafId: number;

    const updateUnderline = () => {
      const activeButton = itemRefs.current[activeIndex];
      const activeText = textRefs.current[activeIndex];
      
      if (activeButton && activeText && showLabels && orientation === 'horizontal') {
        const buttonRect = activeButton.getBoundingClientRect();
        const textRect = activeText.getBoundingClientRect();
        const containerRect = activeButton.parentElement?.getBoundingClientRect();
        
        if (containerRect) {
          setUnderlineWidth(textRect.width);
          setUnderlineLeft(buttonRect.left - containerRect.left + (buttonRect.width - textRect.width) / 2);
        }
      }
    };

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateUnderline();
      });
    };

    updateUnderline();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, [activeIndex, finalItems, showLabels, orientation]);

  const handleItemClick = (index: number, item: MenuDockItem) => {
    setActiveIndex(index);
    item.onClick?.();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'compact':
        return {
          container: 'p-1',
          item: 'p-2 min-w-12',
          icon: 'h-4 w-4',
          text: 'text-xs'
        };
      case 'large':
        return {
          container: 'p-3',
          item: 'p-3 min-w-16',
          icon: 'h-6 w-6',
          text: 'text-base'
        };
      default:
        return {
          container: 'p-2',
          item: 'p-2 min-w-14',
          icon: 'h-5 w-5',
          text: 'text-sm'
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <nav
      className={cn(
        'relative inline-flex items-center rounded-xl bg-card border shadow-sm',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        styles.container,
        className
      )}
      role="navigation"
    >
      {finalItems.map((item, index) => {
        const isActive = index === activeIndex;
        const IconComponent = item.icon;

        return (
          <button
            key={`${item.label}-${index}`}
            ref={(el) => { itemRefs.current[index] = el; }}
            className={cn(
              'relative flex flex-col items-center justify-center rounded-lg transition-all duration-200',
              'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              styles.item,
              isActive && 'text-primary',
              !isActive && 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => handleItemClick(index, item)}
            aria-label={item.label}
            type="button"
          >
            <div className={cn(
              'flex items-center justify-center transition-all duration-200',
              animated && isActive && 'animate-bounce',
              orientation === 'horizontal' && showLabels ? 'mb-1' : '',
              orientation === 'vertical' && showLabels ? 'mb-1' : ''
            )}>
              <IconComponent className={cn(styles.icon, 'transition-colors duration-200')} />
            </div>
            
            {showLabels && (
              <span
                ref={(el) => { textRefs.current[index] = el; }}
                className={cn(
                  'font-medium transition-colors duration-200 capitalize',
                  styles.text,
                  'whitespace-nowrap'
                )}
              >
                {item.label}
              </span>
            )}
          </button>
        );
      })}
      
      {/* Animated underline for horizontal orientation with labels */}
      {showLabels && orientation === 'horizontal' && (
        <div
          className={cn(
            'absolute bottom-2 h-0.5 bg-primary rounded-full transition-all duration-300 ease-out',
            animated ? 'transition-all duration-300' : ''
          )}
          style={{
            width: `${underlineWidth}px`,
            left: `${underlineLeft}px`,
          }}
        />
      )}
      
      {/* Active indicator for vertical orientation or no labels */}
      {(!showLabels || orientation === 'vertical') && (
        <div
          className={cn(
            'absolute bg-primary rounded-full transition-all duration-300',
            orientation === 'vertical' 
              ? 'left-1 w-1 h-6' 
              : 'bottom-0.5 h-0.5 w-6',
          )}
          style={{
            [orientation === 'vertical' ? 'top' : 'left']: 
              orientation === 'vertical' 
                ? `${(activeIndex * (variant === 'large' ? 64 : variant === 'compact' ? 56 : 60)) + (variant === 'large' ? 19 : variant === 'compact' ? 16 : 18)}px`
                : `${(activeIndex * (variant === 'large' ? 64 : variant === 'compact' ? 56 : 60)) + (variant === 'large' ? 19 : variant === 'compact' ? 16 : 18)}px`
          }}
        />
      )}
    </nav>
  );
};
'use client';
 
import * as React from 'react';
import { Star } from 'lucide-react';
import {
  motion,
  type HTMLMotionProps,
} from 'motion/react';
import { useQuery } from '@tanstack/react-query';
 
import { cn } from '@/lib/utils';
 
function formatNumber(num: number, formatted: boolean): string {
  if (formatted) {
    if (num < 1000) {
      return num.toString();
    }
    const units = ['k', 'M', 'B', 'T'];
    let unitIndex = 0;
    let n = num;
    while (n >= 1000 && unitIndex < units.length) {
      n /= 1000;
      unitIndex++;
    }
    return n.toFixed(1) + (units[unitIndex - 1] ?? '');
  } else {
    return num.toLocaleString('en-US');
  }
}
 
type GitHubStarsButtonProps = HTMLMotionProps<'a'> & {
  username: string;
  repo: string;
  formatted?: boolean;
};
 
function GitHubStarsButton({
  username,
  repo,
  formatted = false,
  className,
  ...props
}: GitHubStarsButtonProps) {
  const repoUrl = React.useMemo(
    () => `https://github.com/${username}/${repo}`,
    [username, repo],
  );

  const { data: stars, isLoading } = useQuery({
    queryKey: ['github-stars', username, repo],
    queryFn: async () => {
      // Check localStorage first
      const cached = localStorage.getItem(`github-stars-${username}-${repo}`);
      if (cached) {
        const { stars, timestamp } = JSON.parse(cached);
        const fiveDays = 1000 * 60 * 60 * 24 * 5;
        if (Date.now() - timestamp < fiveDays) {
          return stars;
        }
      }
      
      // Fetch from API
      const response = await fetch(`https://api.github.com/repos/${username}/${repo}`);
      const data = await response.json();
      const starCount = data.stargazers_count as number;
      
      // Save to localStorage
      localStorage.setItem(
        `github-stars-${username}-${repo}`,
        JSON.stringify({ stars: starCount, timestamp: Date.now() })
      );
      
      return starCount;
    },
    staleTime: 1000 * 60 * 60 * 24 * 5,  // Revalidate every 5 days
    gcTime: 1000 * 60 * 60 * 24 * 5, // Keep in cache for 5 days
  });
 
  const formattedStars = formatNumber(stars ?? 0, formatted);
 
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      window.open(repoUrl, '_blank');
    },
    [repoUrl],
  );
 
  return (
    <motion.a
      href={repoUrl}
      rel="noopener noreferrer"
      target="_blank"
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.02 }}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 text-sm bg-white/80 text-gray-700 border border-gray-200 rounded-lg px-4 py-2 h-10 has-[>svg]:px-3 cursor-pointer whitespace-nowrap font-medium transition-colors hover:bg-white hover:border-gray-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] shrink-0 [&_svg]:shrink-0 outline-none shadow-sm",
        className,
      )}
      {...props}
    >
      <svg role="img" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
      <span>GitHub Stars</span>
      <Star
        className="fill-yellow-500 text-yellow-500"
        size={18}
        aria-hidden="true"
      />
      {isLoading ? (
        <span className="inline-block h-4 w-8 animate-pulse rounded bg-gray-200" />
      ) : (
        <span className="tabular-nums text-gray-700">
          {formattedStars}
        </span>
      )}
    </motion.a>
  );
}
 
export { GitHubStarsButton, type GitHubStarsButtonProps };
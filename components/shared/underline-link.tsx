import Link from 'next/link';
import React from 'react';

interface UnderlineLinkProps {
  href: string;
  text: string;
  className?: string;
}

const UnderlineLink: React.FC<UnderlineLinkProps> = ({ href, text, className = '' }) => {
  return (
    <Link href={href} passHref>
      <span
        className={`cursor-pointer underline decoration-from-font underline-offset-2 hover:opacity-80 ${className}`}
        rel="ugc"
      >
        {text}
      </span>
    </Link>
  );
};

export default UnderlineLink;

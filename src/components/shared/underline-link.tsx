import { LocalizedLink as Link } from "@/i18n/navigation";
import React from "react";

interface UnderlineLinkProps {
  href: string;
  text: string;
  className?: string;
}

const UnderlineLink: React.FC<UnderlineLinkProps> = ({ href, text, className = '' }) => {
  return (
    <Link
      to={href}
      className={`cursor-pointer underline decoration-from-font underline-offset-2 hover:opacity-80 ${className}`}
    >
      {text}
    </Link>
  );
};

export default UnderlineLink;

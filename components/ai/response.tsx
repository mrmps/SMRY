/**
 * Copyright 2023 Vercel, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';

import { cn } from '@/lib/utils';
import type { ComponentProps, HTMLAttributes } from 'react';
import { memo } from 'react';
import {
  Streamdown,
  defaultRehypePlugins,
  type StreamdownProps,
} from 'streamdown';
import { code } from '@streamdown/code';
import { harden } from 'rehype-harden';

export type ResponseProps = HTMLAttributes<HTMLDivElement> & {
  children: ComponentProps<typeof Streamdown>['children'];
  /** Whether the content is currently streaming (enables animation) */
  isAnimating?: boolean;
  /** Text direction for RTL language support */
  dir?: 'rtl' | 'ltr';
  /** Language code for the content */
  lang?: string;
};

// Security configuration for AI-generated content
const hardenConfig = {
  defaultOrigin: 'https://13ft.app',
  allowedLinkPrefixes: [
    'https://13ft.app',
    'https://github.com',
    'https://twitter.com',
    'https://x.com',
    'https://en.wikipedia.org',
    'https://wikipedia.org',
  ],
  allowedProtocols: ['http', 'https', 'mailto'],
  allowDataImages: false,
};

// Mobile-optimized typography: inherits parent font-size, uses relative line-heights
// Desktop: 14px, Mobile: 16px (set in parent article-chat.tsx)
const components: StreamdownProps['components'] = {
  p: ({ node: _node, children, className, ...props }) => (
    <p className={cn('mb-3 last:mb-0 leading-[1.65]', className)} {...props}>
      {children}
    </p>
  ),
  ol: ({ node: _node, children, className, ...props }) => (
    <ol className={cn('ml-5 mb-3 mt-2 list-outside list-decimal space-y-2', className)} {...props}>
      {children}
    </ol>
  ),
  li: ({ node: _node, children, className, ...props }) => (
    <li className={cn('leading-[1.6] my-1.5', className)} {...props}>
      {children}
    </li>
  ),
  ul: ({ node: _node, children, className, ...props }) => (
    <ul className={cn('ml-5 mb-3 mt-2 list-outside list-disc space-y-2', className)} {...props}>
      {children}
    </ul>
  ),
  hr: ({ node: _node, className, ...props }) => (
    <hr className={cn('my-4 border-border', className)} {...props} />
  ),
  strong: ({ node: _node, children, className, ...props }) => (
    <span className={cn('font-bold', className)} {...props}>
      {children}
    </span>
  ),
  a: ({ node: _node, children, className, ...props }) => (
    <a
      className={cn('font-medium text-primary underline underline-offset-2', className)}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ node: _node, children, className, ...props }) => (
    <h1
      className={cn('mt-4 mb-2 font-semibold text-xl leading-7', className)}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ node: _node, children, className, ...props }) => (
    <h2
      className={cn('mt-3 mb-2 font-semibold text-lg leading-7', className)}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ node: _node, children, className, ...props }) => (
    <h3 className={cn('mt-3 mb-2 font-semibold text-base leading-6', className)} {...props}>
      {children}
    </h3>
  ),
  h4: ({ node: _node, children, className, ...props }) => (
    <h4 className={cn('mt-3 mb-2 font-semibold text-[15px] leading-6', className)} {...props}>
      {children}
    </h4>
  ),
  h5: ({ node: _node, children, className, ...props }) => (
    <h5
      className={cn('mt-3 mb-2 font-semibold text-sm leading-5', className)}
      {...props}
    >
      {children}
    </h5>
  ),
  h6: ({ node: _node, children, className, ...props }) => (
    <h6 className={cn('mt-3 mb-2 font-semibold text-sm leading-5', className)} {...props}>
      {children}
    </h6>
  ),
  table: ({ node: _node, children, className, ...props }) => (
    <div className="my-4 overflow-x-auto">
      <table
        className={cn('w-full border-collapse border border-border', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ node: _node, children, className, ...props }) => (
    <thead className={cn('bg-muted/50', className)} {...props}>
      {children}
    </thead>
  ),
  tbody: ({ node: _node, children, className, ...props }) => (
    <tbody className={cn('divide-y divide-border', className)} {...props}>
      {children}
    </tbody>
  ),
  tr: ({ node: _node, children, className, ...props }) => (
    <tr className={cn('border-border border-b', className)} {...props}>
      {children}
    </tr>
  ),
  th: ({ node: _node, children, className, ...props }) => (
    <th
      className={cn('px-4 py-2 text-left font-semibold text-sm', className)}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ node: _node, children, className, ...props }) => (
    <td className={cn('px-4 py-2 text-sm', className)} {...props}>
      {children}
    </td>
  ),
  blockquote: ({ node: _node, children, className, ...props }) => (
    <blockquote
      className={cn(
        'my-4 border-muted-foreground/30 border-l-4 pl-4 text-muted-foreground italic',
        className
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ node, className, ...props }) => {
    const inline = node?.position?.start.line === node?.position?.end.line;
    if (!inline) {
      // Block code is handled by @streamdown/code plugin
      return <code className={className} {...props} />;
    }
    return (
      <code
        className={cn(
          'rounded bg-muted px-1.5 py-0.5 font-mono text-sm',
          className
        )}
        {...props}
      />
    );
  },
};

export const Response = memo(
  ({
    className,
    children,
    isAnimating = false,
    dir,
    lang,
    ...props
  }: ResponseProps) => {
    return (
      <div
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          className
        )}
        dir={dir}
        lang={lang}
        {...props}
      >
        <Streamdown
          components={components}
          isAnimating={isAnimating}
          mode={isAnimating ? 'streaming' : 'static'}
          parseIncompleteMarkdown={isAnimating}
          animated={isAnimating ? { animation: 'blurIn', duration: 80, easing: 'ease-out', sep: 'char' } : false}
          caret={isAnimating ? 'circle' : undefined}
          plugins={{ code }}
          rehypePlugins={[
            defaultRehypePlugins.raw,
            [harden, hardenConfig],
          ]}
          controls={{
            code: true,
          }}
        >
          {children}
        </Streamdown>
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.dir === nextProps.dir &&
    prevProps.isAnimating === nextProps.isAnimating
);

Response.displayName = 'Response';

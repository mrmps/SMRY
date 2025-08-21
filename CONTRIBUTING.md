# Contributing to SMRY

Thanks for wanting to contribute to SMRY. This guide covers everything you need to know to get started.

## Getting Started

SMRY is an app that bypasses paywalls and generates AI summaries of articles. Before contributing, please:

1. Read this document
2. Check existing issues
3. Set up your dev environment
4. Test your changes

### How you can contribute

- Bug fixes and better error handling
- New features
- Docs improvements
- UI/UX
- Performance optimizations
- Code cleanup and refactoring

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Installation

1. **Fork and clone**
   ```bash
   git clone https://github.com/mrmps/SMRY.git
   cd SMRY
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**
   ```bash
   cp .env.example .env.local
   ```

4. **Start dev**
   ```bash
   npm run dev
   ```

5. Go to `http://localhost:3000`

### Important files

- **Article Processing**: `lib/fetch-with-timeout.ts`, `components/article-content.tsx`
- **UI Components**: `components/ui/` (Radix UI + Tailwind)
- **Data Fetching**: Server actions in `app/actions/`
- **Caching**: Redis/KV integration

## Development Guidelines

### Code Style

- Use TypeScript for everything new
- Follow the existing prettier/ESLint setup
- Stick to tailwind for styling

### Component patterns

```tsx
// Good: Proper TypeScript interface
interface MyComponentProps {
  title: string;
  optional?: boolean;
}

export const MyComponent: React.FC<MyComponentProps> = ({ 
  title, 
  optional = false 
}) => {
  return (
    <div className="p-4 rounded-lg border">
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
};

export default MyComponent;
```

### State Management

- Use React hooks (`useState`, `useEffect`, `useRef`)
- Use React Server Components when you can
- Cache API responses properly

## Pull Request Process

### Before submitting

1. Test your changes
2. Run `npm run build` to check for TypeScript errors
3. Run `npm run lint`
4. Test with different article sources

### PR requirements

1. **Good title**

2. **Clear description**
   ```markdown
   ## Changes
   - Added timeout handling requests
   - Improved error messages for users
   - Updated fallback logic

   ## Testing
   - Verified error messages display correctly
   - Confirmed fallback to other sources works

   ## Screenshots
   [Add screenshots here]
   ```

3. **Link issues**: Use "Fixes #123" or "Addresses #456"

4. One feature/fix per PR when possible

### Review process

- PRs need maintainer review
- Be open to suggestions

## Env Variables required

Create `.env.local` with these:

```env
OPENAI_API_KEY=your_openai_api_key

KV_URL=your_kv_url
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token

PROXY_URL=your_proxy_url

DIFFBOT_API_KEY=your_diffbot_api_key

RESEND_API_KEY=your_resend_api_key
EMAIL_TO_ADDRESS=your_email@example.com

NEXT_PUBLIC_URL=http://localhost:3000
```

## Testing

### Testing different article sources

The app supports multiple sources. Test with:

- etc etc

### Environment issues

- Double check your `.env.local` 
- Restart the dev server
- Check for missing API keys

### Article extraction problems

- Test with multiple article sources
- Check the browser network tab for failed requests
- Look at server logs for extraction errors

## Community Guidelines

### Code of conduct

- Be respectful and professional
- Help others learn and improve
- Focus on the code, not the person

### Getting help

- Check existing issues first
- Ask questions in issue comments
- Be specific about what you're trying to do
- Include error messages and steps to reproduce

### Communication

- Use clear commit messages
- Comment your code when it's not obvious
- Update documentation when you change behavior
- Respond to review feedback

## Questions?

If you have questions that aren't covered here:

1. Check existing issues and discussions
2. Open a new issue with the "question" label
3. Please be specific about what you're trying to do

Thanks for contributing to SMR =)

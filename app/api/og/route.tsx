import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Use Node.js runtime (default) as per Vercel docs
// @vercel/og automatically adds correct caching headers

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'Article';
    const siteName = searchParams.get('siteName') || 'SMRY';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FAFAFA',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Header with branding */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '48px 64px',
              borderBottom: '1px solid #E5E7EB',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: '600',
                color: '#111827',
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              SMRY
            </div>
            <div
              style={{
                fontSize: '16px',
                color: '#6B7280',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {siteName}
            </div>
          </div>

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 64px',
              maxWidth: '1000px',
            }}
          >
            {/* Title */}
            <div
              style={{
                fontSize: title.length > 60 ? '52px' : title.length > 40 ? '60px' : '72px',
                fontWeight: '700',
                color: '#111827',
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                marginBottom: '24px',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </div>

            {/* Subtle accent line */}
            <div
              style={{
                width: '80px',
                height: '4px',
                backgroundColor: '#111827',
                borderRadius: '2px',
              }}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '48px 64px',
              borderTop: '1px solid #E5E7EB',
            }}
          >
            <div
              style={{
                fontSize: '15px',
                color: '#6B7280',
                fontWeight: '500',
                letterSpacing: '0.01em',
              }}
            >
              Read without limits
            </div>
            <div
              style={{
                fontSize: '15px',
                color: '#9CA3AF',
                fontWeight: '500',
              }}
            >
              smry.ai
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    console.error('Error generating OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}


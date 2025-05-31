import React from 'react';

const TemporaryMaintenance: React.FC = () => {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#FAFAFA',
          zIndex: 99999,
          overflow: 'auto',
        }}
      >
        {/* Background gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at top, rgba(251, 247, 25, 0.03), transparent 50%)',
            pointerEvents: 'none',
          }}
        />
        
        {/* Subtle grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e4e4e7' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          {/* Main content card */}
          <div
            style={{
              maxWidth: '640px',
              width: '100%',
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #e4e4e7',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
              padding: '48px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Gradient accent */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #FBF719 0%, #F59E0B 100%)',
              }}
            />

            {/* Status badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                padding: '6px 12px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '500',
                marginBottom: '32px',
                border: '1px solid #FDE68A',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#F59E0B',
                  animation: 'pulse 2s infinite',
                }}
              />
              Maintenance Mode
            </div>

            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: '700',
                color: '#18181B',
                marginBottom: '16px',
                lineHeight: '1.2',
                letterSpacing: '-0.02em',
              }}
            >
              Hey, I&apos;m really sorry about this
            </h1>

            <p
              style={{
                fontSize: '1.125rem',
                color: '#3F3F46',
                marginBottom: '32px',
                lineHeight: '1.6',
                fontWeight: '400',
              }}
            >
              I know you came here to read an article, maybe bypass a paywall that was blocking important information you needed. I get it—it&apos;s incredibly frustrating when you can&apos;t access content you need for work, research, or just staying informed.
            </p>

            {/* Personal message card */}
            <div
              style={{
                backgroundColor: '#FEF8E7',
                border: '1px solid #FDE68A',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#92400E',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>👋</span>
                A personal message from Mike
              </h3>
              <p style={{ fontSize: '0.9375rem', color: '#78350F', margin: '0 0 16px 0', lineHeight: '1.6' }}>
                I&apos;m Mike, the developer behind SMRY. I built this tool because I believe information should be accessible to everyone. When major news sites started blocking more content, when research papers disappeared behind expensive paywalls, when important journalism became a luxury—I knew we needed a solution.
              </p>
              <p style={{ fontSize: '0.9375rem', color: '#78350F', margin: 0, lineHeight: '1.6' }}>
                Right now, many websites have changed their systems, and our usual methods aren&apos;t working. I&apos;m working around the clock to fix this because I know how much you rely on SMRY. This isn&apos;t just a technical issue to me—it&apos;s about keeping knowledge free and accessible.
              </p>
            </div>

            {/* Info cards */}
            <div style={{ marginBottom: '32px' }}>
              <div
                style={{
                  backgroundColor: '#FAFAFA',
                  border: '1px solid #e4e4e7',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '16px',
                }}
              >
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#18181B',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  What happened?
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#71717A', margin: 0, lineHeight: '1.5' }}>
                  Major websites updated their paywall systems. The methods we used to help you access content—archive services, search engine crawlers—are being blocked more aggressively. It&apos;s an ongoing battle for information freedom.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#FAFAFA',
                  border: '1px solid #e4e4e7',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '16px',
                }}
              >
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#18181B',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 13h2v8H3zm6 0h2v8H9zm6 0h2v8h-2zm6-10v18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM19 3H5v18h14V3z"/>
                  </svg>
                  Database growing pains
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#71717A', margin: 0, lineHeight: '1.5' }}>
                  We cache every website to give you instant access, but our database has exceeded capacity. Imagine a library where we&apos;ve run out of shelf space—that&apos;s what&apos;s happening with our servers. This is causing slowdowns and access issues.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#FAFAFA',
                  border: '1px solid #e4e4e7',
                  borderRadius: '12px',
                  padding: '20px',
                }}
              >
                <h3
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#18181B',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                  What I&apos;m doing about it
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#71717A', margin: 0, lineHeight: '1.5' }}>
                  I&apos;m working on multiple fronts: expanding our database capacity, optimizing how we cache websites, developing new bypass methods, and building a completely redesigned SMRY. This isn&apos;t just a patch—it&apos;s a complete overhaul to ensure we can keep serving you reliably.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
              <a
                href="https://buymeacoffee.com/jotarokujo"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: '1 1 0',
                  minWidth: '200px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#18181B',
                  color: 'white',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s ease',
                  border: '1px solid #18181B',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#27272A';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#18181B';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                ☕ Help Keep SMRY Alive
              </a>
              
              <a
                href="https://github.com/mrmps/SMRY"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: '1 1 0',
                  minWidth: '200px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: 'white',
                  color: '#18181B',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s ease',
                  border: '1px solid #e4e4e7',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FAFAFA';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Star & Contribute
              </a>
            </div>

            {/* Contact section */}
            <div
              style={{
                textAlign: 'center',
                paddingTop: '24px',
                borderTop: '1px solid #e4e4e7',
              }}
            >
              <p style={{ fontSize: '0.875rem', color: '#71717A', marginBottom: '8px' }}>
                I read every single email. Tell me what articles you need, what&apos;s not working, or just vent about paywalls.
              </p>
              <a
                href="mailto:contact@smry.ai"
                style={{
                  color: '#18181B',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  borderBottom: '1px solid #e4e4e7',
                  paddingBottom: '1px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderBottomColor = '#18181B';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderBottomColor = '#e4e4e7';
                }}
              >
                contact@smry.ai
              </a>
              <p style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '12px' }}>
                — Mike
              </p>
            </div>
          </div>

          {/* Bottom links */}
          <div
            style={{
              marginTop: '32px',
              display: 'flex',
              gap: '24px',
              fontSize: '0.75rem',
              color: '#71717A',
            }}
          >
            <a
              href="https://smry.ai"
              style={{
                color: '#71717A',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#18181B'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717A'; }}
            >
              SMRY.ai
            </a>
            <span>•</span>
            <a
              href="https://github.com/mrmps/SMRY"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#71717A',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#18181B'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717A'; }}
            >
              Open Source
            </a>
            <span>•</span>
            <span>749+ Stars on GitHub</span>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          @media (max-width: 640px) {
            .maintenance-card {
              padding: 32px 24px !important;
            }
          }
        `
      }} />
    </>
  );
};

export default TemporaryMaintenance;

type JsonLdProps = {
  data: Record<string, unknown>
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SMRY',
  url: 'https://smry.ai',
  logo: 'https://smry.ai/logo.svg',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@smry.ai',
    contactType: 'customer support',
  },
}

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SMRY',
  url: 'https://smry.ai',
  description: 'AI-powered reader that bypasses paywalls and summarizes any article.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://smry.ai/?url={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

export const faqSchema = (faqs: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
})

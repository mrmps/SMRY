import DashboardWrapper from "@/components/dashboard-wrapper";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // In Next.js 15+, searchParams and params are now Promises that need to be awaited
  await params;
  await searchParams;

  return (
    <DashboardWrapper />
  );
}

// We add a wrapper component to avoid suspending the entire page while the OpenAI request is being made

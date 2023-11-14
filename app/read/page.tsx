import DashboardWrapper from "@/components/dashboard-wrapper";

export const runtime = "edge";


export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {

  return (
    <DashboardWrapper />
  );
}

// We add a wrapper component to avoid suspending the entire page while the OpenAI request is being made

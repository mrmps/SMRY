import Nav from "@/components/nav";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div><Nav />{children}</div>
}

export default function Template({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="route-shell">
      <div className="route-shell__layer">{children}</div>
    </div>
  );
}

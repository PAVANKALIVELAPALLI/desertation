import ExecutionDetailView from "./ExecutionDetailView";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <ExecutionDetailView />;
}

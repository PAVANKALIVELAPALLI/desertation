import WorkflowDetailView from "./WorkflowDetailView";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function Page() {
  return <WorkflowDetailView />;
}

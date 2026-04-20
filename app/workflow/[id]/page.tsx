import type { Metadata } from "next";
import { WorkflowEditorClient } from "@/components/WorkflowEditorClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Workflow Editor" };

export default async function WorkflowPage({ params }: PageProps) {
  const { id } = await params;
  return <WorkflowEditorClient workflowId={id} />;
}

import { PrismaClient } from "@prisma/client";
import type { WorkflowNode, WorkflowEdge } from "../types/nodes";
import { encodeHandleId } from "../types/nodes";

const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────────
// SAMPLE WORKFLOW: Product Marketing Kit Generator
//
// Graph:
//   TextNode(description) ──text──► LLMNode(generate copy) ─────────────────────────► TextNode(final kit)
//   UploadImageNode ──image──► CropImageNode(square) ──image──► LLMNode(analyze image) ─► ↑
//   UploadVideoNode ──video──► ExtractFrameNode ──image──► LLMNode(analyze frame) ──────► ↑
//
// Demonstrates: parallel branches, convergence, all 6 node types
// ────────────────────────────────────────────────────────────

const DEMO_USER_ID = "user_3CRdvxJm2acYUbo1Lyy0Fw4DtTE"; // replace with real Clerk userId

async function main() {
  // Upsert demo user
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "demo@nextflow.ai",
      name: "Demo User",
    },
  });

  // ── Nodes
  const nodes: WorkflowNode[] = [
    // 1. Product description text node
    {
      id: "node_text_desc",
      type: "text",
      position: { x: 60, y: 200 },
      data: {
        label: "Product Description",
        text: "Introducing AuraX Pro — a revolutionary AI-powered ergonomic chair that adapts to your posture in real-time. Premium mesh, 7-zone lumbar support, 4D armrests.",
        status: "idle",
      },
    },
    // 2. LLM: Generate marketing copy
    {
      id: "node_llm_copy",
      type: "llm",
      position: { x: 400, y: 100 },
      data: {
        label: "Generate Marketing Copy",
        model: "gemini-1.5-flash",
        systemPrompt: "You are an expert product marketer specializing in DTC brands. Write punchy, conversion-focused copy.",
        userMessage: "",
        userMessageConnected: true,
        imageInputsConnected: false,
        status: "idle",
      },
    },
    // 3. Upload product image
    {
      id: "node_img_upload",
      type: "upload_image",
      position: { x: 60, y: 420 },
      data: { label: "Product Photo", status: "idle" },
    },
    // 4. Crop to square for socials
    {
      id: "node_crop",
      type: "crop_image",
      position: { x: 360, y: 380 },
      data: {
        label: "Square Crop (1:1)",
        x: 0, y: 0, width: 512, height: 512,
        imageInputConnected: true,
        status: "idle",
      },
    },
    // 5. LLM: Analyze cropped image
    {
      id: "node_llm_image",
      type: "llm",
      position: { x: 660, y: 340 },
      data: {
        label: "Analyze Product Image",
        model: "gemini-1.5-flash",
        systemPrompt: "You are a visual designer. Analyze the product image and write 3 compelling alt-text descriptions and 2 social media captions.",
        userMessage: "Analyze this product image.",
        userMessageConnected: false,
        imageInputsConnected: true,
        status: "idle",
      },
    },
    // 6. Upload product video
    {
      id: "node_vid_upload",
      type: "upload_video",
      position: { x: 60, y: 620 },
      data: { label: "Product Video", status: "idle" },
    },
    // 7. Extract thumbnail frame
    {
      id: "node_frame",
      type: "extract_frame",
      position: { x: 360, y: 580 },
      data: {
        label: "Extract Thumbnail",
        timeOffsetSeconds: 2,
        outputFormat: "jpg",
        videoInputConnected: true,
        status: "idle",
      },
    },
    // 8. LLM: Analyze frame
    {
      id: "node_llm_frame",
      type: "llm",
      position: { x: 660, y: 560 },
      data: {
        label: "Analyze Video Frame",
        model: "gemini-1.5-flash",
        systemPrompt: "You are a video content strategist. Describe what you see and suggest YouTube thumbnail text overlays.",
        userMessage: "Analyze this video thumbnail.",
        userMessageConnected: false,
        imageInputsConnected: true,
        status: "idle",
      },
    },
    // 9. Final assembly text node
    {
      id: "node_final",
      type: "text",
      position: { x: 980, y: 340 },
      data: {
        label: "Marketing Kit Output",
        text: "",
        status: "idle",
      },
    },
  ] as WorkflowNode[];

  // ── Edges
  const edges: WorkflowEdge[] = [
    // Text → LLM copy (text wire)
    {
      id: "edge_1",
      source: "node_text_desc",
      target: "node_llm_copy",
      sourceHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
      targetHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
      type: "custom",
    },
    // Upload image → Crop (image wire)
    {
      id: "edge_2",
      source: "node_img_upload",
      target: "node_crop",
      sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
      targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
      type: "custom",
    },
    // Crop → LLM image (image wire)
    {
      id: "edge_3",
      source: "node_crop",
      target: "node_llm_image",
      sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
      targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
      type: "custom",
    },
    // Upload video → Extract frame (video wire)
    {
      id: "edge_4",
      source: "node_vid_upload",
      target: "node_frame",
      sourceHandle: encodeHandleId({ portDataType: "video", portIndex: 0 }),
      targetHandle: encodeHandleId({ portDataType: "video", portIndex: 0 }),
      type: "custom",
    },
    // Extract frame → LLM frame (image wire)
    {
      id: "edge_5",
      source: "node_frame",
      target: "node_llm_frame",
      sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
      targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
      type: "custom",
    },
    // LLM copy → final (text) - convergence node
    {
      id: "edge_6",
      source: "node_llm_copy",
      target: "node_final",
      sourceHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
      targetHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
      type: "custom",
    },
  ] as WorkflowEdge[];

  // ── Create workflow
  const workflow = await prisma.workflow.upsert({
    where: { id: "wf_sample_marketing_kit" },
    update: { nodes: nodes as unknown as object[], edges: edges as unknown as object[] },
    create: {
      id: "wf_sample_marketing_kit",
      userId: DEMO_USER_ID,
      name: "Product Marketing Kit Generator",
      description: "Demonstrates parallel execution, all 6 node types, and convergence. Upload a product image and video to generate a complete marketing kit.",
      nodes: nodes as unknown as object[],
      edges: edges as unknown as object[],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  });

  console.log(`✅ Seeded sample workflow: ${workflow.id}`);
  console.log(`   Name: ${workflow.name}`);
  console.log(`   Nodes: ${nodes.length}`);
  console.log(`   Edges: ${edges.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

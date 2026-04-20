import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encodeHandleId } from "@/types/nodes";
import type { WorkflowNode, WorkflowEdge } from "@/types/nodes";

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const nodes: WorkflowNode[] = [
      {
        id: "node_text_desc",
        type: "text",
        position: { x: 60, y: 200 },
        data: {
          label: "Product Description",
          text: "Introducing AuraX Pro — a revolutionary AI-powered ergonomic chair that adapts to your posture in real-time.",
          status: "idle",
        },
      },
      {
        id: "node_llm_copy",
        type: "llm",
        position: { x: 400, y: 100 },
        data: {
          label: "Generate Marketing Copy",
          model: "gemini-2.5-flash",
          systemPrompt: "You are an expert product marketer. Write punchy, conversion-focused copy.",
          userMessage: "",
          userMessageConnected: true,
          imageInputsConnected: false,
          status: "idle",
        },
      },
      {
        id: "node_img_upload",
        type: "upload_image",
        position: { x: 60, y: 420 },
        data: {
          label: "Product Photo",
          status: "idle",
          uploadedUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000",
          uploadedFileName: "red-nike-shoe.jpg"
        },
      },
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
      {
        id: "node_llm_image",
        type: "llm",
        position: { x: 660, y: 340 },
        data: {
          label: "Analyze Product Image",
          model: "gemini-2.5-flash",
          systemPrompt: "You are a visual designer. Analyze the product image.",
          userMessage: "Analyze this image.",
          userMessageConnected: false,
          imageInputsConnected: true,
          status: "idle",
        },
      },
      {
        id: "node_vid_upload",
        type: "upload_video",
        position: { x: 60, y: 620 },
        data: {
          label: "Product Video",
          status: "idle",
          uploadedUrl: "https://res.cloudinary.com/demo/video/upload/elephants.mp4",
          uploadedFileName: "demo-elephants.mp4"
        },
      },
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
      {
        id: "node_llm_frame",
        type: "llm",
        position: { x: 660, y: 560 },
        data: {
          label: "Analyze Video Frame",
          model: "gemini-2.5-flash",
          systemPrompt: "You are a video content strategist.",
          userMessage: "Analyze this video thumbnail.",
          userMessageConnected: false,
          imageInputsConnected: true,
          status: "idle",
        },
      },
      {
        id: "node_final",
        type: "text",
        position: { x: 980, y: 340 },
        data: {
          label: "Final Output",
          text: "",
          status: "idle",
          // Add a dummy property to ensure an input handle exists if your TextNode supports it
        },
        // Add an input handle for 'text' if your node system supports explicit handle definitions
        inputs: [
          {
            id: encodeHandleId({ portDataType: "text", portIndex: 0 }),
            type: "text"
          }
        ]
      },
    ] as WorkflowNode[];

    const edges: WorkflowEdge[] = [
      {
        id: "edge_1",
        source: "node_text_desc",
        target: "node_llm_copy",
        sourceHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_2",
        source: "node_img_upload",
        target: "node_crop",
        sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_3",
        source: "node_crop",
        target: "node_llm_image",
        sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_4",
        source: "node_vid_upload",
        target: "node_frame",
        sourceHandle: encodeHandleId({ portDataType: "video", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "video", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_5",
        source: "node_frame",
        target: "node_llm_frame",
        sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_6",
        source: "node_llm_copy",
        target: "node_final",
        sourceHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        type: "custom",
      },
    ] as WorkflowEdge[];

    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: "CLOUDINARY FIXED: Multimodal Test",
        description: "FIXED: Tests 3 parallel branches (Text, Image, Video) using reliable Cloudinary hosting and patched FFmpeg binaries.",
        nodes: nodes as unknown as object[],
        edges: edges as unknown as object[],
        viewport: { x: 0, y: 0, zoom: 0.85 },
      },
    });

    return NextResponse.json({ success: true, workflow });
  } catch (error) {
    console.error("[POST /api/workflows/seed]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

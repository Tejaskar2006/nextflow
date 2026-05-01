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
        id: "node_img_upload",
        type: "upload_image",
        position: { x: 50, y: 50 },
        data: {
          label: "Upload Image",
          status: "idle",
          uploadedUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000",
          uploadedFileName: "red-nike-shoe.jpg"
        }
      },
      {
        id: "node_crop",
        type: "crop_image",
        position: { x: 350, y: 50 },
        data: {
          label: "Crop Image",
          x: 0, y: 0, width: 512, height: 512,
          imageInputConnected: true,
          status: "idle",
        }
      },
      {
        id: "node_text_1",
        type: "text",
        position: { x: 50, y: 250 },
        data: {
          label: "System Prompt",
          text: "You are a professional marketing copywriter. Generate a compelling one-paragraph product description.",
          status: "idle",
        }
      },
      {
        id: "node_text_2",
        type: "text",
        position: { x: 50, y: 400 },
        data: {
          label: "Product Details",
          text: "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
          status: "idle",
        }
      },
      {
        id: "node_llm_1",
        type: "llm",
        position: { x: 350, y: 250 },
        data: {
          label: "LLM Node #1",
          model: "gemini-2.5-flash",
          systemPrompt: "",
          systemPromptConnected: true,
          userMessage: "",
          userMessageConnected: true,
          imageInputsConnected: true,
          status: "idle",
        }
      },
      {
        id: "node_vid_upload",
        type: "upload_video",
        position: { x: 50, y: 600 },
        data: {
          label: "Upload Video",
          status: "idle",
          uploadedUrl: "https://res.cloudinary.com/demo/video/upload/elephants.mp4",
          uploadedFileName: "demo-elephants.mp4"
        }
      },
      {
        id: "node_frame",
        type: "extract_frame",
        position: { x: 350, y: 600 },
        data: {
          label: "Extract Frame",
          timeOffsetSeconds: 2,
          outputFormat: "jpg",
          videoInputConnected: true,
          status: "idle",
        }
      },
      {
        id: "node_text_3",
        type: "text",
        position: { x: 650, y: 250 },
        data: {
          label: "System Prompt",
          text: "You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.",
          status: "idle",
        }
      },
      {
        id: "node_llm_2",
        type: "llm",
        position: { x: 950, y: 400 },
        data: {
          label: "Final Marketing Summary",
          model: "gemini-2.5-flash",
          systemPrompt: "",
          systemPromptConnected: true,
          userMessage: "",
          userMessageConnected: true,
          imageInputsConnected: true,
          status: "idle",
        }
      }
    ] as WorkflowNode[];

    const edges: WorkflowEdge[] = [
      {
        id: "edge_img_crop",
        source: "node_img_upload",
        target: "node_crop",
        sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_text1_llm1",
        source: "node_text_1",
        target: "node_llm_1",
        sourceHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "text", portIndex: 1 }),
        type: "custom",
      },
      {
        id: "edge_text2_llm1",
        source: "node_text_2",
        target: "node_llm_1",
        sourceHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_crop_llm1",
        source: "node_crop",
        target: "node_llm_1",
        sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_vid_frame",
        source: "node_vid_upload",
        target: "node_frame",
        sourceHandle: encodeHandleId({ portDataType: "video", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "video", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_text3_llm2",
        source: "node_text_3",
        target: "node_llm_2",
        sourceHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "text", portIndex: 1 }),
        type: "custom",
      },
      {
        id: "edge_llm1_llm2",
        source: "node_llm_1",
        target: "node_llm_2",
        sourceHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "text", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_crop_llm2",
        source: "node_crop",
        target: "node_llm_2",
        sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        type: "custom",
      },
      {
        id: "edge_frame_llm2",
        source: "node_frame",
        target: "node_llm_2",
        sourceHandle: encodeHandleId({ portDataType: "image", portIndex: 0 }),
        targetHandle: encodeHandleId({ portDataType: "image", portIndex: 1 }),
        type: "custom",
      }
    ] as WorkflowEdge[];

    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: "Product Marketing Kit Generator",
        description: "Branch A: Image Processing + Copy. Branch B: Video Extraction. Convergence: Final Tweet.",
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

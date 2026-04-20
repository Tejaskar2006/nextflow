import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Returns the authenticated Clerk userId or throws a 401 response.
 * Use this in every API route handler.
 */
/**
 * LIGHTWEIGHT: Returns the authenticated Clerk userId from the local JWT.
 * Does NOT perform network requests or DB writes. Use this for 90% of requests.
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthError("Unauthorized");
  }
  return userId;
}

/**
 * HEAVY: Fetches full user profile from Clerk and syncs it to our DB.
 * Only use this when creating resources or on first sign-in.
 */
export async function requireUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthError("Unauthorized");
  }

  // Import here to avoid circular deps
  const { currentUser } = await import("@clerk/nextjs/server");
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new AuthError("User not found in Clerk");
  }

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      imageUrl: clerkUser.imageUrl,
    },
    create: {
      id: userId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim(),
      imageUrl: clerkUser.imageUrl,
    },
  });

  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Wrap an API handler with standard auth + error handling.
 */
export function withAuthHandler(
  handler: (userId: string, req: Request) => Promise<NextResponse>
) {
  return async (req: Request) => {
    try {
      const userId = await requireAuth();
      return await handler(userId, req);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: 401 });
      }
      console.error("[API Error]", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

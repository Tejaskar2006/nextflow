import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-canvas)",
        gap: "32px",
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #a970ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              boxShadow: "0 0 20px rgba(124,58,237,0.5)",
            }}
          >
            ⚡
          </div>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              background: "linear-gradient(135deg, #f0f0ff, #a970ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.5px",
            }}
          >
            NextFlow
          </span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Visual LLM workflow builder
        </p>
      </div>

      <SignIn
        appearance={{
          elements: {
            formFieldLabel: {
              color: "#ffffff",
            },
            rootBox: {
              width: "100%",
              display: "flex",
              justifyContent: "center",
            },
            card: {
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              borderRadius: "16px",
            },
            headerTitle: { color: "#ffffff" },
            headerSubtitle: { color: "#ffffff" },
            socialButtonsBlockButton: {
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              color: "#ffffff",
            },
            alternativeMethodsBlockButton: {
              color: "#ffffff",
            },
            identityPreviewText: {
              color: "#ffffff",
            },
            otpCodeFieldInput: {
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              color: "#ffffff",
            },
            formResendCodeLink: {
              color: "#a970ff",
            },
            formFieldInput: {
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              color: "#ffffff",
            },
            formButtonPrimary: {
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow: "0 0 20px rgba(124,58,237,0.3)",
            },
            footerActionLink: { color: "var(--purple-400)" },
          },
        }}
      />
    </div>
  );
}

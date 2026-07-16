import * as React from "react";
import { ContactClient } from "./contact-client";
export const metadata = { title: "お問い合わせ" };
export default function ContactPage() {
  return (
    <main style={{ maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1rem" }}>お問い合わせ</h1>
      <p style={{ color: "#666", marginBottom: "1rem" }}>下記フォームよりお問い合わせください。担当者より折り返しご連絡いたします。</p>
      <ContactClient />
    </main>
  );
}

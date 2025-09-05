"use client";

import React from "react";
import Link from "next/link";

export default function PayPalSuccessPage() {
  return (
    <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center", padding: 32, border: "1px solid #e0e0e0", borderRadius: 12, background: "#fafcff" }}>
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 24 }}>
        <circle cx="12" cy="12" r="12" fill="#4BB543"/>
        <path d="M7 13l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <h1 style={{ color: "#222", marginBottom: 12 }}>Thanh toán thành công!</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Cảm ơn bạn đã thanh toán qua PayPal.<br />
        Đơn hàng của bạn đã được xử lý thành công.
      </p>
      <Link href="/paypal">Quay lại trang PayPal</Link>
    </div>
  );
}

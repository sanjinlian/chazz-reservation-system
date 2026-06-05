import { useState, useEffect, useCallback } from "react";
import logoSvg from "./logo.svg";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// REPLACE THESE with your actual values after deploying the Apps Script
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxCJVAgbIbEMh9iAOPxV3m1VetbJa5zL7qMbrcTtrELtUfsgyG67ja_sDpwJA_az-QZ/exec",
  // Password is fetched from Google Sheets at runtime (default: 95432942)
};

// ─── TIME SLOTS ──────────────────────────────────────────────────────────────
const TIME_SLOTS = [
  "10:30-13:00", "11:00-13:30", "11:30-14:00", "12:00-14:30",
  "12:30-15:00", "13:00-15:30", "13:30-16:00", "14:00-16:30",
  "14:30-17:00", "15:00-17:30", "15:30-18:00", "16:00-18:30",
  "16:30-19:00", "17:00-19:30", "17:30-20:00", "18:00-20:30",
  "18:30-21:00", "19:00-21:30", "19:30-22:00", "其他（自訂）",
];

const LOCATIONS = ["教室", "小包廂"];

const STATUS_LABELS = {
  Pending:    { label: "待審核", color: "#B8860B", bg: "#FFF9E6" },
  Approved:   { label: "已核准", color: "#2E7D32", bg: "#E8F5E9" },
  Rejected:   { label: "已拒絕", color: "#C62828", bg: "#FFEBEE" },
  Conflict:   { label: "時段衝突", color: "#7B3F00", bg: "#FFF3E0" },
  Cancelled:  { label: "已取消", color: "#546E7A", bg: "#ECEFF1" },
  SyncFailed: { label: "同步失敗", color: "#5C3317", bg: "#FBE9E7" },
  Draft:      { label: "草稿", color: "#546E7A", bg: "#F5F5F5" },
};

// ─── MOCK API (used when no Apps Script URL is set) ──────────────────────────
let mockDB = {
  password: "95432942",
  managerPassword: "chazz_admin_2025",
  reservations: [
    {
      id: "RES-001", createdAt: "2025-06-01T10:00:00Z",
      brandName: "棉花手作", contactName: "林小雨", email: "lin@example.com",
      phone: "0912-345-678", eventName: "夏日刺繡初階班",
      location: "教室", date: "2025-06-15", startTime: "10:30", endTime: "13:00",
      status: "Approved", notes: "需要音響", calendarEventId: "cal123",
      approvedAt: "2025-06-02T09:00:00Z", approvedBy: "admin"
    },
    {
      id: "RES-002", createdAt: "2025-06-02T14:00:00Z",
      brandName: "日向皮革", contactName: "陳大明", email: "chen@example.com",
      phone: "0923-456-789", eventName: "基礎皮革課",
      location: "小包廂", date: "2025-06-20", startTime: "14:00", endTime: "17:00",
      status: "Pending", notes: "", calendarEventId: "",
      approvedAt: "", approvedBy: ""
    },
  ]
};

async function apiCall(action, payload = {}) {
  // If real Apps Script URL is configured, use it
  if (CONFIG.APPS_SCRIPT_URL && !CONFIG.APPS_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")) {
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set("action", action);
    const res = await fetch(url.toString(), {
      method: payload && Object.keys(payload).length ? "POST" : "GET",
      headers: { "Content-Type": "text/plain" },
      body: Object.keys(payload).length ? JSON.stringify({ action, ...payload }) : undefined,
    });
    return res.json();
  }

  // Mock implementation
  await new Promise(r => setTimeout(r, 600));
  switch (action) {
    case "getPassword": return { success: true, password: mockDB.password };
    case "getManagerPassword": return { success: true, managerPassword: mockDB.managerPassword };
    case "getReservations":
      if (payload.email) {
        return { success: true, data: mockDB.reservations.filter(r => r.email === payload.email) };
      }
      return { success: true, data: mockDB.reservations };
    case "createReservation": {
      const events = payload.events || [payload];
      const created = [];
      events.forEach((ev, idx) => {
        const newRes = {
          brandName: payload.brandName || ev.brandName,
          contactName: payload.contactName || ev.contactName,
          email: payload.email || ev.email,
          phone: payload.phone || ev.phone,
          eventName: ev.eventName,
          location: ev.location,
          date: ev.date,
          startTime: ev.startTime,
          endTime: ev.endTime,
          notes: ev.notes || "",
          id: "RES-" + String(mockDB.reservations.length + 1).padStart(3, "0"),
          createdAt: new Date().toISOString(),
          status: Math.random() > 0.85 ? "Conflict" : "Pending",
          calendarEventId: "mock_" + Date.now() + "_" + idx,
          approvedAt: "", approvedBy: ""
        };
        mockDB.reservations.push(newRes);
        created.push(newRes);
      });
      return { success: true, data: payload.events ? created : created[0] };
    }
    case "updateReservation": {
      const idx = mockDB.reservations.findIndex(r => r.id === payload.id);
      if (idx >= 0) {
        mockDB.reservations[idx] = {
          ...mockDB.reservations[idx],
          ...payload,
          status: "Pending" // Reset to pending when edited
        };
      }
      return { success: true };
    }
    case "updateStatus": {
      const idx = mockDB.reservations.findIndex(r => r.id === payload.id);
      if (idx >= 0) {
        mockDB.reservations[idx].status = payload.status;
        if (payload.status === "Approved") {
          mockDB.reservations[idx].approvedAt = new Date().toISOString();
          mockDB.reservations[idx].approvedBy = "admin";
        }
      }
      return { success: true };
    }
    default: return { success: false, error: "Unknown action" };
  }
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500&family=Noto+Sans+TC:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --chazz-purple: #6F65A9;
    --chazz-purple-light: #EBE9F6;
    --chazz-purple-mid: #9E97C8;
    --chazz-purple-dark: #4A4378;
    --chazz-cream: #FAF8F4;
    --chazz-warm: #F5F0E8;
    --chazz-text: #2C2825;
    --chazz-text-mid: #6B6460;
    --chazz-text-light: #A09890;
    --chazz-border: #E8E2D8;
    --chazz-border-mid: #D4CCBF;
    --font-serif: 'Noto Serif TC', serif;
    --font-sans: 'Noto Sans TC', sans-serif;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
  }

  body { font-family: var(--font-sans); background: var(--chazz-cream); color: var(--chazz-text); min-height: 100vh; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* HEADER */
  .header { background: white; border-bottom: 1px solid var(--chazz-border); padding: 0 24px; height: 56px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
  .header-logo { font-family: var(--font-serif); font-size: 18px; font-weight: 400; letter-spacing: 0.12em; color: var(--chazz-purple); cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .header-logo span { font-size: 11px; font-weight: 300; color: var(--chazz-text-light); letter-spacing: 0.08em; }
  .header-nav { display: flex; gap: 4px; }
  .nav-btn { background: none; border: none; font-family: var(--font-sans); font-size: 13px; color: var(--chazz-text-mid); cursor: pointer; padding: 6px 12px; border-radius: var(--radius-sm); transition: all 0.2s; }
  .nav-btn:hover { background: var(--chazz-warm); color: var(--chazz-text); }
  .nav-btn.active { background: var(--chazz-purple-light); color: var(--chazz-purple); font-weight: 500; }
  .nav-btn.logout { color: var(--chazz-text-light); font-size: 12px; }

  /* MAIN */
  .main { flex: 1; padding: 32px 24px; max-width: 760px; margin: 0 auto; width: 100%; }

  /* PASSWORD GATE */
  .gate { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 32px; background: var(--chazz-cream); }
  .gate-card { background: white; border: 1px solid var(--chazz-border); border-radius: var(--radius-lg); padding: 48px 40px; max-width: 400px; width: 100%; text-align: center; }
  .gate-logo { font-family: var(--font-serif); font-size: 32px; font-weight: 300; letter-spacing: 0.2em; color: var(--chazz-purple); margin-bottom: 4px; }
  .gate-sub { font-size: 12px; letter-spacing: 0.15em; color: var(--chazz-text-light); margin-bottom: 8px; text-transform: uppercase; }
  .gate-brand-logo { max-width: 80%; max-height: 48px; width: auto; height: auto; margin: 0 auto 16px; display: block; }
  .gate-divider { width: 40px; height: 1px; background: var(--chazz-border-mid); margin: 0 auto 24px; }
  .gate-label { font-size: 13px; color: var(--chazz-text-mid); margin-bottom: 8px; text-align: left; }
  .gate-input { width: 100%; border: 1px solid var(--chazz-border); border-radius: var(--radius-sm); padding: 10px 14px; font-size: 16px; font-family: var(--font-sans); background: var(--chazz-cream); color: var(--chazz-text); outline: none; transition: border-color 0.2s; letter-spacing: 0.15em; text-align: center; }
  .gate-input:focus { border-color: var(--chazz-purple-mid); }
  .gate-error { font-size: 12px; color: #C62828; margin-top: 6px; }
  .gate-hint { font-size: 11px; color: var(--chazz-text-light); margin-top: 24px; }

  /* BUTTONS */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: var(--radius-sm); font-family: var(--font-sans); font-weight: 500; cursor: pointer; transition: all 0.2s; text-decoration: none; }
  .btn-primary { background: var(--chazz-purple); color: white; padding: 10px 20px; font-size: 14px; }
  .btn-primary:hover { background: var(--chazz-purple-dark); }
  .btn-primary:disabled { background: var(--chazz-purple-mid); cursor: not-allowed; }
  .btn-secondary { background: white; color: var(--chazz-text); border: 1px solid var(--chazz-border-mid); padding: 8px 16px; font-size: 13px; }
  .btn-secondary:hover { border-color: var(--chazz-purple-mid); color: var(--chazz-purple); }
  .btn-ghost { background: none; color: var(--chazz-text-mid); padding: 6px 12px; font-size: 13px; }
  .btn-ghost:hover { background: var(--chazz-warm); color: var(--chazz-text); }
  .btn-danger { background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; padding: 6px 14px; font-size: 13px; }
  .btn-danger:hover { background: #FFCDD2; }
  .btn-success { background: #E8F5E9; color: #2E7D32; border: 1px solid #C8E6C9; padding: 6px 14px; font-size: 13px; }
  .btn-success:hover { background: #C8E6C9; }
  .btn-full { width: 100%; }
  .btn-lg { padding: 13px 28px; font-size: 15px; }

  /* FORM */
  .form-card { background: white; border: 1px solid var(--chazz-border); border-radius: var(--radius-lg); padding: 32px; margin-bottom: 24px; }
  .form-section-title { font-family: var(--font-serif); font-size: 13px; letter-spacing: 0.12em; color: var(--chazz-purple); margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid var(--chazz-purple-light); }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .form-field { display: flex; flex-direction: column; gap: 6px; }
  .form-field.full { grid-column: 1 / -1; }
  .form-label { font-size: 12px; color: var(--chazz-text-mid); letter-spacing: 0.05em; }
  .form-label .req { color: var(--chazz-purple); margin-left: 2px; }
  .form-input { border: 1px solid var(--chazz-border); border-radius: var(--radius-sm); padding: 9px 12px; font-size: 14px; font-family: var(--font-sans); color: var(--chazz-text); background: var(--chazz-cream); outline: none; transition: border-color 0.2s; width: 100%; }
  .form-input:focus { border-color: var(--chazz-purple-mid); background: white; }
  .form-input.error { border-color: #E57373; }
  .form-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%236B6460' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
  .form-textarea { resize: vertical; min-height: 80px; }
  .form-error { font-size: 11px; color: #C62828; }
  .form-hint { font-size: 11px; color: var(--chazz-text-light); }

  /* PAGE TITLES */
  .page-title { font-family: var(--font-serif); font-size: 22px; font-weight: 400; letter-spacing: 0.08em; color: var(--chazz-text); margin-bottom: 4px; }
  .page-sub { font-size: 13px; color: var(--chazz-text-light); margin-bottom: 28px; letter-spacing: 0.02em; }

  /* STATUS BADGES */
  .badge { display: inline-block; font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 20px; white-space: nowrap; }

  /* RESERVATION CARDS */
  .res-card { background: white; border: 1px solid var(--chazz-border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 12px; transition: border-color 0.2s; }
  .res-card:hover { border-color: var(--chazz-purple-mid); }
  .res-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .res-event-name { font-family: var(--font-serif); font-size: 16px; font-weight: 400; color: var(--chazz-text); }
  .res-brand { font-size: 12px; color: var(--chazz-text-light); margin-top: 2px; }
  .res-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--chazz-text-mid); }
  .res-meta-item { display: flex; align-items: center; gap: 4px; }
  .res-actions { display: flex; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--chazz-border); }

  /* ADMIN DASHBOARD */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-card { background: white; border: 1px solid var(--chazz-border); border-radius: var(--radius-md); padding: 16px; text-align: center; }
  .stat-num { font-family: var(--font-serif); font-size: 28px; font-weight: 300; color: var(--chazz-purple); }
  .stat-label { font-size: 11px; color: var(--chazz-text-light); margin-top: 4px; letter-spacing: 0.05em; }

  /* TABS */
  .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--chazz-border); margin-bottom: 24px; }
  .tab { background: none; border: none; font-family: var(--font-sans); font-size: 13px; color: var(--chazz-text-light); cursor: pointer; padding: 10px 16px; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s; }
  .tab:hover { color: var(--chazz-text-mid); }
  .tab.active { color: var(--chazz-purple); border-bottom-color: var(--chazz-purple); font-weight: 500; }

  /* SEARCH */
  .search-bar { position: relative; margin-bottom: 16px; }
  .search-input { width: 100%; border: 1px solid var(--chazz-border); border-radius: var(--radius-sm); padding: 9px 12px 9px 36px; font-size: 13px; font-family: var(--font-sans); color: var(--chazz-text); background: white; outline: none; transition: border-color 0.2s; }
  .search-input:focus { border-color: var(--chazz-purple-mid); }
  .search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--chazz-text-light); font-size: 14px; }

  /* EMPTY STATE */
  .empty { text-align: center; padding: 48px 24px; }
  .empty-icon { font-size: 32px; color: var(--chazz-border-mid); margin-bottom: 12px; }
  .empty-text { font-size: 14px; color: var(--chazz-text-light); }

  /* SUCCESS PAGE */
  .success-card { background: white; border: 1px solid var(--chazz-border); border-radius: var(--radius-lg); padding: 48px 40px; text-align: center; max-width: 480px; margin: 0 auto; }
  .success-icon { width: 64px; height: 64px; border-radius: 50%; background: var(--chazz-purple-light); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; color: var(--chazz-purple); }
  .success-title { font-family: var(--font-serif); font-size: 20px; font-weight: 400; margin-bottom: 8px; }
  .success-detail { font-size: 13px; color: var(--chazz-text-mid); line-height: 1.6; }

  /* LOADING */
  .loading { display: flex; align-items: center; justify-content: center; padding: 48px; }
  .spinner { width: 24px; height: 24px; border: 2px solid var(--chazz-border); border-top-color: var(--chazz-purple); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* TOAST */
  .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--chazz-text); color: white; padding: 10px 20px; border-radius: var(--radius-sm); font-size: 13px; z-index: 1000; animation: fadeUp 0.3s ease; white-space: nowrap; }
  .toast.success { background: #2E7D32; }
  .toast.error { background: #C62828; }
  @keyframes fadeUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* MY RESERVATIONS EMAIL GATE */
  .lookup-card { background: white; border: 1px solid var(--chazz-border); border-radius: var(--radius-lg); padding: 32px; max-width: 400px; margin: 0 auto; }

  /* ADMIN LOGIN */
  .admin-gate { display: flex; align-items: center; justify-content: center; min-height: 80vh; }
  .admin-login-card { background: white; border: 1px solid var(--chazz-border); border-radius: var(--radius-lg); padding: 40px; max-width: 360px; width: 100%; }
  .admin-login-title { font-family: var(--font-serif); font-size: 18px; font-weight: 400; color: var(--chazz-text); margin-bottom: 4px; }
  .admin-login-sub { font-size: 12px; color: var(--chazz-text-light); margin-bottom: 24px; }

  /* DETAIL MODAL */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 24px; }
  .modal { background: white; border-radius: var(--radius-lg); padding: 32px; max-width: 520px; width: 100%; max-height: 80vh; overflow-y: auto; }
  .modal-title { font-family: var(--font-serif); font-size: 18px; font-weight: 400; margin-bottom: 20px; }
  .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--chazz-border); font-size: 13px; }
  .detail-label { color: var(--chazz-text-light); }
  .detail-value { color: var(--chazz-text); font-weight: 500; text-align: right; }

  /* NOTICE BOX */
  .notice { background: var(--chazz-purple-light); border: 1px solid #D4CFF0; border-radius: var(--radius-sm); padding: 12px 16px; font-size: 12px; color: var(--chazz-purple-dark); margin-bottom: 16px; display: flex; gap: 8px; align-items: flex-start; }
  .notice.conflict { background: #FFF3E0; border-color: #FFE082; color: #7B3F00; }
  .notice.info { background: #E3F2FD; border-color: #BBDEFB; color: #1565C0; }

  /* CALENDAR */
  .cal-container { background: white; border: 1px solid var(--chazz-border); border-radius: var(--radius-lg); padding: 32px; margin-bottom: 24px; }
  .cal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .cal-header-left { display: flex; align-items: center; gap: 16px; }
  .cal-month-num { font-size: 56px; font-weight: 500; font-family: var(--font-sans); line-height: 1; color: var(--chazz-text); }
  .cal-divider { width: 1px; height: 50px; background: var(--chazz-border-mid); }
  .cal-month-text { display: flex; flex-direction: column; }
  .cal-month-en { font-size: 20px; font-weight: 500; font-family: var(--font-sans); letter-spacing: 0.05em; color: var(--chazz-text); }
  .cal-year { font-size: 16px; font-family: var(--font-sans); color: var(--chazz-text-mid); }
  .cal-nav { display: flex; gap: 8px; }
  .cal-nav-btn { background: none; border: 1px solid var(--chazz-border); border-radius: var(--radius-sm); padding: 6px 12px; cursor: pointer; color: var(--chazz-text-mid); transition: all 0.2s; }
  .cal-nav-btn:hover { background: var(--chazz-warm); color: var(--chazz-text); }
  
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); border-top: 1px solid var(--chazz-border-mid); border-left: 1px solid var(--chazz-border-mid); }
  .cal-day-header { padding: 12px 0; text-align: center; font-size: 11px; letter-spacing: 0.1em; color: var(--chazz-text); border-right: 1px solid var(--chazz-border-mid); border-bottom: 1px solid var(--chazz-border-mid); }
  .cal-cell { aspect-ratio: 1; border-right: 1px solid var(--chazz-border-mid); border-bottom: 1px solid var(--chazz-border-mid); padding: 6px; display: flex; flex-direction: column; gap: 4px; }
  .cal-cell.empty { background: var(--chazz-cream); opacity: 0.3; }
  .cal-date-num { font-size: 12px; font-family: var(--font-sans); color: var(--chazz-text-mid); }
  .cal-dots { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; justify-content: center; padding-bottom: 4px; }
  .cal-dot { width: 14px; height: 14px; border-radius: 50%; }
  
  .cal-legend { display: flex; justify-content: center; gap: 24px; margin-top: 32px; }
  .cal-legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--chazz-text-mid); }

  /* MOBILE MENU */
  .mobile-menu-toggle { display: none; background: none; border: none; font-size: 30px; color: var(--chazz-text-light); cursor: pointer; padding: 4px; }
  .mobile-nav-overlay { display: none; }

  @media (max-width: 600px) {
    .header-nav { display: none; }
    .mobile-menu-toggle { display: block; }
    .mobile-nav-overlay { 
      display: flex; position: absolute; top: 56px; left: 0; right: 0; 
      background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--chazz-border); padding: 16px 24px; 
      flex-direction: column; gap: 8px; z-index: 90;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .mobile-nav-overlay .nav-btn { padding: 12px; text-align: left; font-size: 15px; }
    .mobile-nav-overlay .logout { margin-top: 8px; border-top: 1px solid var(--chazz-border); padding-top: 16px; text-align: center; }

    .form-grid { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .form-card { padding: 20px; }
    .gate-card { padding: 32px 24px; }
    .main { padding: 20px 16px; }
    .header { padding: 0 16px; }
    
    /* Mobile Calendar Adjustments */
    .cal-container { padding: 24px 16px; }
    .cal-header { flex-direction: column; gap: 16px; align-items: center; }
    .cal-month-num { font-size: 48px; }
    .cal-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); width: 100%; }
    .cal-day-header { font-size: 10px; letter-spacing: 0; padding: 8px 0; min-width: 0; overflow: hidden; }
    .cal-cell { padding: 4px; gap: 2px; min-width: 0; }
    .cal-date-num { font-size: 11px; }
    .cal-legend { gap: 12px; flex-wrap: wrap; }
    .cal-dot { width: 10px; height: 10px; }
  }
`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: "#546E7A", bg: "#ECEFF1" };
  return (
    <span className="badge" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`toast ${type}`}>{message}</div>;
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 className="modal-title" style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: "4px 8px", fontSize: 18, color: "#A09890" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── PASSWORD GATE ────────────────────────────────────────────────────────────
function PasswordGate({ onSuccess }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sysPassword, setSysPassword] = useState("");

  useEffect(() => {
    apiCall("getPassword").then(r => {
      if (r.success) setSysPassword(r.password);
    });
  }, []);

  const handleSubmit = async () => {
    if (!input.trim()) { setError("請輸入密碼"); return; }
    setLoading(true);
    setError("");
    const pass = sysPassword || "95432942";
    if (input.trim() === pass) {
      sessionStorage.setItem("chazz_auth", "true");
      sessionStorage.setItem("chazz_auth_exp", String(Date.now() + 24 * 3600 * 1000));
      onSuccess();
    } else {
      setError("密碼錯誤，請重新輸入");
    }
    setLoading(false);
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-logo">且自</div>
        <div className="gate-sub">手作 與 咖啡 </div>
        <img src={logoSvg} alt="CHAZZ Logo" className="gate-brand-logo" />
        <div className="gate-divider" />
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "var(--chazz-text-mid)", lineHeight: 1.7, marginBottom: 16 }}>
            歡迎使用且自空間預約系統<br />請輸入平台密碼以繼續
          </p>
        </div>
        <div className="form-field" style={{ marginBottom: 16 }}>
          <label className="gate-label">平台密碼</label>
          <input
            type="password"
            className="gate-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="••••••••"
            autoFocus
          />
          {error && <div className="gate-error">{error}</div>}
        </div>
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={handleSubmit}
          disabled={loading}
          style={{ borderRadius: 8 }}
        >
          {loading ? "驗證中..." : "進入預約平台"}
        </button>
        <div className="gate-hint">密碼可向且自工作室索取</div>
      </div>
    </div>
  );
}


// ─── TIME FORMAT HELPER ──────────────────────────────────────────────────────
function formatTimeText(startTimeStr, endTimeStr) {
  const parseTimeStr = (str) => {
    if (!str) return { period: "", time: "" };
    let timePart = str;
    if (str.includes("T")) {
      const dateObj = new Date(str);
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const minutes = String(dateObj.getMinutes()).padStart(2, "0");
      timePart = `${hours}:${minutes}`;
    }
    const parts = timePart.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parts[1].substring(0, 2);
      const period = h >= 12 ? "下午" : "上午";
      return { period, time: `${String(h).padStart(2, "0")}:${m}` };
    }
    return { period: "", time: str };
  };

  const start = parseTimeStr(startTimeStr);
  const end = parseTimeStr(endTimeStr);
  
  if (!start.time || !end.time) return `${startTimeStr}–${endTimeStr}`;
  return `${start.period} ${start.time} 到 ${end.period} ${end.time}`;
}

// ─── CUSTOM TIME PICKER ──────────────────────────────────────────────────────
function CustomTimePicker({ label, value, onChange, error }) {
  let period = "上午";
  let hour = "09";
  let minute = "00";

  if (value && value.includes(":")) {
    const [hStr, mStr] = value.split(":");
    const hNum = parseInt(hStr, 10);
    if (hNum >= 12) {
      period = "下午";
    } else {
      period = "上午";
    }
    hour = hStr;
    minute = mStr;
  }

  const handlePeriodChange = (newPeriod) => {
    let newHour = parseInt(hour, 10);
    if (newPeriod === "上午" && newHour >= 12) {
      newHour = newHour - 12;
    } else if (newPeriod === "下午" && newHour < 12) {
      newHour = newHour + 12;
    }
    const newHourStr = String(newHour).padStart(2, "0");
    onChange(`${newHourStr}:${minute}`);
  };

  const handleHourChange = (newHourStr) => {
    onChange(`${newHourStr}:${minute}`);
  };

  const handleMinuteChange = (newMinStr) => {
    onChange(`${hour}:${newMinStr}`);
  };

  const hours = period === "上午"
    ? Array.from({ length: 12 }, (_, i) => String(i).padStart(2, "0"))
    : Array.from({ length: 12 }, (_, i) => String(i + 12).padStart(2, "0"));

  const minutes = ["00", "10", "20", "30", "40", "50"];

  return (
    <div className="form-field">
      <label className="form-label">{label} <span className="req">*</span></label>
      <div style={{ display: "flex", gap: 6 }}>
        <select
          className="form-input form-select"
          style={{ flex: 1, paddingRight: "20px", minWidth: 0, textOverflow: "ellipsis" }}
          value={period}
          onChange={e => handlePeriodChange(e.target.value)}
        >
          <option value="上午">上午</option>
          <option value="下午">下午</option>
        </select>
        
        <select
          className="form-input form-select"
          style={{ flex: 1, paddingRight: "20px", minWidth: 0, textOverflow: "ellipsis" }}
          value={hour}
          onChange={e => handleHourChange(e.target.value)}
        >
          {hours.map(h => <option key={h} value={h}>{h} 點</option>)}
        </select>

        <select
          className="form-input form-select"
          style={{ flex: 1, paddingRight: "20px", minWidth: 0, textOverflow: "ellipsis" }}
          value={minute}
          onChange={e => handleMinuteChange(e.target.value)}
        >
          {minutes.map(m => <option key={m} value={m}>{m} 分</option>)}
        </select>
      </div>
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

// ─── RESERVATION FORM ─────────────────────────────────────────────────────────
function ReservationForm({ onSuccess, showToast }) {
  const [brandForm, setBrandForm] = useState({
    brandName: "", contactName: "", email: "", phone: ""
  });
  const [eventsList, setEventsList] = useState([
    {
      id: Date.now(),
      eventName: "", location: "教室", month: "",
      date: "", timeSlot: "10:30-13:00", startTime: "", endTime: "", notes: ""
    }
  ]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleBrandChange = (field, value) => {
    setBrandForm(p => ({ ...p, [field]: value }));
    setErrors(p => { const n = { ...p }; delete n[field]; return n; });
  };

  const handleEventChange = (index, field, value) => {
    setEventsList(p => {
      const newList = [...p];
      let updatedEvent = { ...newList[index], [field]: value };
      if (field === "timeSlot" && value === "其他（自訂）") {
        if (!updatedEvent.startTime) updatedEvent.startTime = "09:00";
        if (!updatedEvent.endTime) updatedEvent.endTime = "10:00";
      }
      newList[index] = updatedEvent;
      return newList;
    });
    setErrors(p => {
      const n = { ...p };
      if (n.events && n.events[index]) {
        const newEventsErr = [...n.events];
        const itemErr = { ...newEventsErr[index] };
        delete itemErr[field];
        newEventsErr[index] = itemErr;
        n.events = newEventsErr;
      }
      return n;
    });
  };

  const addEvent = () => {
    const lastEvent = eventsList[eventsList.length - 1];
    setEventsList(p => [
      ...p,
      {
        id: Date.now() + Math.random(),
        eventName: lastEvent ? lastEvent.eventName : "",
        location: lastEvent ? lastEvent.location : "教室",
        month: "",
        date: "",
        timeSlot: lastEvent ? lastEvent.timeSlot : "10:30-13:00",
        startTime: lastEvent ? lastEvent.startTime : "",
        endTime: lastEvent ? lastEvent.endTime : "",
        notes: lastEvent ? lastEvent.notes : ""
      }
    ]);
  };

  const removeEvent = (index) => {
    if (eventsList.length <= 1) return;
    setEventsList(p => p.filter((_, i) => i !== index));
    setErrors(p => {
      const n = { ...p };
      if (n.events) {
        n.events = n.events.filter((_, i) => i !== index);
      }
      return n;
    });
  };

  const validate = () => {
    const e = {};
    if (!brandForm.brandName.trim()) e.brandName = "請填寫品牌名稱";
    if (!brandForm.contactName.trim()) e.contactName = "請填寫聯絡人姓名";
    if (!brandForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brandForm.email)) e.email = "請填寫有效 Email";

    const eventErrors = [];
    eventsList.forEach((ev, idx) => {
      const err = {};
      if (!ev.eventName.trim()) err.eventName = "請填寫活動名稱";
      if (!ev.date) err.date = "請選擇活動日期";
      const isCustomTime = ev.timeSlot === "其他（自訂）";
      if (isCustomTime && !ev.startTime) err.startTime = "請填寫開始時間";
      if (isCustomTime && !ev.endTime) err.endTime = "請填寫結束時間";
      if (Object.keys(err).length > 0) {
        eventErrors[idx] = err;
      }
    });

    if (eventErrors.some(err => err && Object.keys(err).length > 0)) {
      e.events = eventErrors;
    }
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      const payloadEvents = eventsList.map(ev => {
        let startTime = ev.startTime;
        let endTime = ev.endTime;
        if (ev.timeSlot !== "其他（自訂）") {
          [startTime, endTime] = ev.timeSlot.split("-");
        }
        return {
          eventName: ev.eventName,
          location: ev.location,
          month: ev.month,
          date: ev.date,
          startTime,
          endTime,
          notes: ev.notes
        };
      });

      const res = await apiCall("createReservation", {
        ...brandForm,
        events: payloadEvents
      });

      if (res.success) {
        onSuccess(res.data);
      } else {
        showToast("送出失敗，請稍後再試", "error");
      }
    } catch {
      showToast("連線錯誤，請稍後再試", "error");
    }
    setSubmitting(false);
  };

  const months = Array.from({ length: 12 }, (_, i) => ({ val: String(i + 1), label: `${i + 1} 月` }));

  return (
    <div>
      <h1 className="page-title">空間預約申請</h1>
      <p className="page-sub">填寫申請表單後，店主將於 2–3 個工作天內審核並回覆。支援多個場次合併申請。</p>

      <div className="notice">
        <span>✦</span>
        <span>本系統僅供場地申請使用。預約成功後請等候審核確認信，如有需要設備（投影機、音響）請於備註中說明。</span>
      </div>

      {/* 品牌資訊 */}
      <div className="form-card">
        <div className="form-section-title">品牌資訊</div>
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">品牌名稱 <span className="req">*</span></label>
            <input
              className={`form-input${errors.brandName ? " error" : ""}`}
              placeholder="手作品牌名稱"
              value={brandForm.brandName}
              onChange={e => handleBrandChange("brandName", e.target.value)}
            />
            {errors.brandName && <div className="form-error">{errors.brandName}</div>}
          </div>
          <div className="form-field">
            <label className="form-label">聯絡人姓名 <span className="req">*</span></label>
            <input
              className={`form-input${errors.contactName ? " error" : ""}`}
              placeholder="您的姓名"
              value={brandForm.contactName}
              onChange={e => handleBrandChange("contactName", e.target.value)}
            />
            {errors.contactName && <div className="form-error">{errors.contactName}</div>}
          </div>
          <div className="form-field">
            <label className="form-label">Email <span className="req">*</span></label>
            <input
              type="email"
              className={`form-input${errors.email ? " error" : ""}`}
              placeholder="your@email.com"
              value={brandForm.email}
              onChange={e => handleBrandChange("email", e.target.value)}
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
            <div className="form-hint">用於查詢預約紀錄及接收通知</div>
          </div>
          <div className="form-field">
            <label className="form-label">電話</label>
            <input
              className="form-input"
              placeholder="09xx-xxx-xxx（選填）"
              value={brandForm.phone}
              onChange={e => handleBrandChange("phone", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 活動資訊清單 */}
      {eventsList.map((event, index) => {
        const isCustomTime = event.timeSlot === "其他（自訂）";
        const itemErrors = errors.events?.[index] || {};
        return (
          <div key={event.id} className="form-card" style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 10, borderBottom: "1px solid var(--chazz-purple-light)" }}>
              <div className="form-section-title" style={{ margin: 0, padding: 0, border: "none" }}>
                活動場次 #{index + 1}
              </div>
              {eventsList.length > 1 && (
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6 }}
                  onClick={() => removeEvent(index)}
                >
                  ✕ 刪除此場次
                </button>
              )}
            </div>

            <div className="form-grid">
              <div className="form-field full">
                <label className="form-label">活動名稱 <span className="req">*</span></label>
                <input
                  className={`form-input${itemErrors.eventName ? " error" : ""}`}
                  placeholder="例：夏日刺繡初階班"
                  value={event.eventName}
                  onChange={e => handleEventChange(index, "eventName", e.target.value)}
                />
                {itemErrors.eventName && <div className="form-error">{itemErrors.eventName}</div>}
              </div>
              <div className="form-field">
                <label className="form-label">使用地點 <span className="req">*</span></label>
                <select
                  className="form-input form-select"
                  value={event.location}
                  onChange={e => handleEventChange(index, "location", e.target.value)}
                >
                  {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">月份 <span className="req">*</span></label>
                <select
                  className="form-input form-select"
                  value={event.month}
                  onChange={e => handleEventChange(index, "month", e.target.value)}
                >
                  <option value="">請選擇月份</option>
                  {months.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">活動日期 <span className="req">*</span></label>
                <input
                  type="date"
                  className={`form-input${itemErrors.date ? " error" : ""}`}
                  value={event.date}
                  onChange={e => handleEventChange(index, "date", e.target.value)}
                />
                {itemErrors.date && <div className="form-error">{itemErrors.date}</div>}
              </div>
              <div className="form-field full">
                <label className="form-label">時段 <span className="req">*</span></label>
                <select
                  className="form-input form-select"
                  value={event.timeSlot}
                  onChange={e => handleEventChange(index, "timeSlot", e.target.value)}
                >
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {isCustomTime && (
                <>
                  <CustomTimePicker
                    label="開始時間"
                    value={event.startTime}
                    onChange={val => handleEventChange(index, "startTime", val)}
                    error={itemErrors.startTime}
                  />
                  <CustomTimePicker
                    label="結束時間"
                    value={event.endTime}
                    onChange={val => handleEventChange(index, "endTime", val)}
                    error={itemErrors.endTime}
                  />
                </>
              )}
              <div className="form-field full">
                <label className="form-label">備註</label>
                <textarea
                  className="form-input form-textarea"
                  value={event.notes}
                  onChange={e => handleEventChange(index, "notes", e.target.value)}
                  placeholder="插座、投影機、音響等需求"
                />
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          className="btn btn-secondary btn-full btn-lg"
          onClick={addEvent}
          style={{ borderStyle: "dashed", borderColor: "var(--chazz-purple)" }}
        >
          ＋ 再建立一個活動 (複製上述內容)
        </button>
      </div>

      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "送出中..." : "送出預約申請 →"}
      </button>
    </div>
  );
}

// ─── SUCCESS PAGE ─────────────────────────────────────────────────────────────
function SuccessPage({ data, onNew, onMyReservations }) {
  const list = Array.isArray(data) ? data : [data];
  const hasConflict = list.some(r => r.status === "Conflict");
  return (
    <div>
      <div className="success-card">
        <div className="success-icon">
          {hasConflict ? "⚠" : "✓"}
        </div>
        <h2 className="success-title">
          {hasConflict ? "申請包含衝突時段" : "申請送出成功"}
        </h2>
        <p className="success-detail">
          {hasConflict
            ? "部分申請時段與現有預約重疊。系統已記錄您的申請並標記為衝突，管理員將聯繫您調整時段。"
            : "您的申請已送出，店主將於 2–3 個工作天內審核。確認信將寄送至您的 Email。"}
        </p>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
          {list.map(r => (
            <div key={r.id} style={{ padding: "12px 16px", background: "var(--chazz-warm)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--chazz-text-mid)", border: "1px solid var(--chazz-border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span>申請編號：<strong>{r.id}</strong></span>
                <StatusBadge status={r.status} />
              </div>
              <div>活動：{r.eventName}｜地點：{r.location}｜日期：{r.date}（{formatTimeText(r.startTime, r.endTime)}）</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onMyReservations}>查看我的預約</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNew}>再次申請</button>
        </div>
      </div>
    </div>
  );
}

function VisualCalendar({ reservations }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrev = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentDate(new Date(year, month + 1, 1));

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const dotsByDate = {};
  reservations.forEach(r => {
    if (r.status === "Cancelled" || r.status === "Rejected") return;
    if (!r.date) return;
    
    const d = new Date(r.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!dotsByDate[day]) dotsByDate[day] = new Set();
      dotsByDate[day].add(r.location);
    }
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="cal-cell empty" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const locations = Array.from(dotsByDate[d] || []);
    cells.push(
      <div key={`day-${d}`} className="cal-cell">
        <div className="cal-date-num">{d}</div>
        <div className="cal-dots">
          {locations.map(loc => (
            <div 
              key={loc} 
              className="cal-dot" 
              style={{ background: loc === "教室" ? "var(--chazz-purple)" : "#E6A23C" }} 
              title={`${loc}預約`}
            />
          ))}
        </div>
      </div>
    );
  }

  const totalCells = cells.length;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) {
    cells.push(<div key={`empty-end-${i}`} className="cal-cell empty" />);
  }

  return (
    <div className="cal-container">
      <div className="cal-header">
        <div className="cal-header-left">
          <div className="cal-month-num">{String(month + 1).padStart(2, '0')}</div>
          <div className="cal-divider" />
          <div className="cal-month-text">
            <div className="cal-month-en">{monthNamesEn[month]}</div>
            <div className="cal-year">{year}</div>
          </div>
        </div>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={handlePrev}>上個月</button>
          <button className="cal-nav-btn" onClick={handleNext}>下個月</button>
        </div>
      </div>
      
      <div className="cal-grid">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(day => (
          <div key={day} className="cal-day-header">{day}</div>
        ))}
        {cells}
      </div>

      <div className="cal-legend">
        <div className="cal-legend-item">
          <div className="cal-dot" style={{ background: "var(--chazz-purple)" }} />
          <span>教室預約</span>
        </div>
        <div className="cal-legend-item">
          <div className="cal-dot" style={{ background: "#E6A23C" }} />
          <span>小包廂預約</span>
        </div>
      </div>
    </div>
  );
}

function EditReservationModal({ reservation, onClose, onSuccess, showToast }) {
  const [event, setEvent] = useState({
    eventName: reservation.eventName,
    location: reservation.location,
    date: reservation.date,
    timeSlot: "其他（自訂）",
    startTime: reservation.startTime,
    endTime: reservation.endTime,
    notes: reservation.notes || ""
  });

  useEffect(() => {
    const ts = `${reservation.startTime}-${reservation.endTime}`;
    if (TIME_SLOTS.includes(ts)) setEvent(p => ({ ...p, timeSlot: ts }));
  }, [reservation]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    let st = event.startTime;
    let et = event.endTime;
    if (event.timeSlot !== "其他（自訂）") {
      [st, et] = event.timeSlot.split("-");
    }
    const res = await apiCall("updateReservation", {
      id: reservation.id,
      eventName: event.eventName,
      location: event.location,
      date: event.date,
      startTime: st,
      endTime: et,
      notes: event.notes
    });
    if (res.success) {
      showToast("修改成功，已重新送審", "success");
      onSuccess();
    } else {
      showToast("修改失敗", "error");
    }
    setSubmitting(false);
  };

  return (
    <Modal title="編輯預約並重新送審" onClose={onClose}>
      <div className="form-grid">
        <div className="form-field full">
          <label className="form-label">活動名稱</label>
          <input className="form-input" value={event.eventName} onChange={e => setEvent({...event, eventName: e.target.value})} />
        </div>
        <div className="form-field">
          <label className="form-label">使用地點</label>
          <select className="form-input form-select" value={event.location} onChange={e => setEvent({...event, location: e.target.value})}>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">活動日期</label>
          <input type="date" className="form-input" value={event.date} onChange={e => setEvent({...event, date: e.target.value})} />
        </div>
        <div className="form-field full">
          <label className="form-label">時段</label>
          <select className="form-input form-select" value={event.timeSlot} onChange={e => setEvent({...event, timeSlot: e.target.value})}>
            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {event.timeSlot === "其他（自訂）" && (
          <>
            <CustomTimePicker label="開始時間" value={event.startTime} onChange={v => setEvent({...event, startTime: v})} />
            <CustomTimePicker label="結束時間" value={event.endTime} onChange={v => setEvent({...event, endTime: v})} />
          </>
        )}
        <div className="form-field full">
          <label className="form-label">備註</label>
          <textarea className="form-input form-textarea" value={event.notes} onChange={e => setEvent({...event, notes: e.target.value})} />
        </div>
      </div>
      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>取消</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting}>儲存並重新送審</button>
      </div>
    </Modal>
  );
}

// ─── MY RESERVATIONS ─────────────────────────────────────────────────────────
function MyReservations({ showToast }) {
  const [step, setStep] = useState("email"); // email | list
  const [email, setEmail] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingRes, setEditingRes] = useState(null);

  const lookup = async () => {
    if (!emailInput.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setError("請輸入有效的 Email"); return;
    }
    setLoading(true);
    const res = await apiCall("getReservations", { email: emailInput.trim() });
    if (res.success) {
      setEmail(emailInput.trim());
      setReservations(res.data);
      setStep("list");
    } else {
      setError("查詢失敗，請稍後再試");
    }
    setLoading(false);
  };

  if (step === "email") return (
    <div>
      <h1 className="page-title">我的預約紀錄</h1>
      <p className="page-sub">輸入申請時使用的 Email 查詢預約狀態</p>
      <div className="lookup-card">
        <div className="form-field" style={{ marginBottom: 16 }}>
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && lookup()}
            placeholder="your@email.com"
            autoFocus
          />
          {error && <div className="form-error">{error}</div>}
        </div>
        <button className="btn btn-primary btn-full" onClick={lookup} disabled={loading}>
          {loading ? "查詢中..." : "查詢我的預約"}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">我的預約紀錄</h1>
          <p className="page-sub">{email} 的所有預約</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setStep("email")}>切換帳號</button>
      </div>
      
      {reservations.length > 0 && <VisualCalendar reservations={reservations} />}
      
      {reservations.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-text">目前沒有預約紀錄</div>
        </div>
      ) : (
        reservations.map(r => (
          <div key={r.id} className="res-card">
            <div className="res-card-header">
              <div>
                <div className="res-event-name">{r.eventName}</div>
                <div className="res-brand">{r.brandName}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="res-meta">
              <span className="res-meta-item">📍 {r.location}</span>
              <span className="res-meta-item">📅 {r.date}</span>
              <span className="res-meta-item">🕐 {formatTimeText(r.startTime, r.endTime)}</span>
            </div>
            {r.notes && (
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--chazz-text-light)" }}>
                備註：{r.notes}
              </div>
            )}
            {r.status === "Conflict" && (
              <div className="notice conflict" style={{ marginTop: 12, marginBottom: 0 }}>
                <span>⚠</span>
                <span>此時段與其他預約重疊，管理員將聯繫您調整。</span>
              </div>
            )}
            {r.status !== "Cancelled" && r.status !== "Rejected" && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--chazz-border)" }}>
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setEditingRes(r)}>
                  ✎ 編輯並重新送審
                </button>
              </div>
            )}
          </div>
        ))
      )}
      {editingRes && (
        <EditReservationModal
          reservation={editingRes}
          onClose={() => setEditingRes(null)}
          onSuccess={() => { setEditingRes(null); lookup(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ─── ADMIN: LOGIN ─────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiCall("getManagerPassword").then(r => {
      if (r.success) setManagerPassword(r.managerPassword);
    });
  }, []);

  const submit = () => {
    if (loading) return;
    setLoading(true);
    const pass = managerPassword || "chazz_admin_2025";
    if (pw === pass) {
      sessionStorage.setItem("chazz_admin", "true");
      onLogin();
    } else {
      setErr("管理員密碼錯誤");
    }
    setLoading(false);
  };
  return (
    <div className="admin-gate">
      <div className="admin-login-card">
        <div style={{ fontSize: 24, marginBottom: 12 }}>🔐</div>
        <div className="admin-login-title">管理員登入</div>
        <div className="admin-login-sub">CHAZZ 空間預約後台</div>
        <div className="form-field" style={{ marginBottom: 14 }}>
          <label className="form-label">管理員密碼</label>
          <input
            type="password"
            className="form-input"
            value={pw}
            onChange={e => { setPw(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="••••••••"
            disabled={loading}
          />
          {err && <div className="form-error">{err}</div>}
        </div>
        <button className="btn btn-primary btn-full" onClick={submit} disabled={loading}>
          {loading ? "載入中..." : "登入後台"}
        </button>
      </div>
    </div>
  );
}

// ─── ADMIN: DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard({ showToast, onLogout }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiCall("getReservations", {});
    if (res.success) setReservations(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    const res = await apiCall("updateStatus", { id, status });
    if (res.success) {
      showToast(status === "Approved" ? "已核准" : "已拒絕", "success");
      setSelected(null);
      load();
    } else showToast("操作失敗", "error");
  };

  const filtered = reservations.filter(r => {
    if (tab === "pending" && r.status !== "Pending") return false;
    if (tab === "approved" && r.status !== "Approved") return false;
    if (tab === "conflict" && r.status !== "Conflict") return false;
    const q = search.toLowerCase();
    return !q || r.brandName.toLowerCase().includes(q) || r.eventName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
  });

  const counts = {
    all: reservations.length,
    pending: reservations.filter(r => r.status === "Pending").length,
    approved: reservations.filter(r => r.status === "Approved").length,
    conflict: reservations.filter(r => r.status === "Conflict").length,
  };

  const statCards = [
    { label: "全部申請", num: reservations.length, color: "var(--chazz-purple)" },
    { label: "待審核", num: counts.pending, color: "#B8860B" },
    { label: "已核准", num: counts.approved, color: "#2E7D32" },
    { label: "時段衝突", num: counts.conflict, color: "#C62828" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">管理後台</h1>
          <p className="page-sub">且自 CHAZZ 空間預約管理</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}>↺ 重新整理</button>
          <button className="btn btn-ghost" onClick={onLogout}>登出</button>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-num" style={{ color: s.color }}>{s.num}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <VisualCalendar reservations={reservations} />

      <div className="tabs">
        {[
          { key: "all", label: `全部 (${counts.all})` },
          { key: "pending", label: `待審核 (${counts.pending})` },
          { key: "approved", label: `已核准 (${counts.approved})` },
          { key: "conflict", label: `衝突 (${counts.conflict})` },
        ].map(t => (
          <button key={t.key} className={`tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋品牌名稱、活動名稱或 Email..."
        />
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-text">目前沒有符合條件的預約</div>
        </div>
      ) : (
        filtered.map(r => (
          <div key={r.id} className="res-card" style={{ cursor: "pointer" }} onClick={() => setSelected(r)}>
            <div className="res-card-header">
              <div>
                <div className="res-event-name">{r.eventName}</div>
                <div className="res-brand">{r.brandName} · {r.contactName} · {r.email}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="res-meta">
              <span className="res-meta-item">📍 {r.location}</span>
              <span className="res-meta-item">📅 {r.date}</span>
              <span className="res-meta-item">🕐 {formatTimeText(r.startTime, r.endTime)}</span>
              <span className="res-meta-item" style={{ color: "var(--chazz-text-light)" }}>#{r.id}</span>
            </div>
            {(r.status === "Pending" || r.status === "Conflict") && (
              <div className="res-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-success" onClick={() => updateStatus(r.id, "Approved")}>✓ 核准</button>
                <button className="btn btn-danger" onClick={() => updateStatus(r.id, "Rejected")}>✕ 拒絕</button>
              </div>
            )}
          </div>
        ))
      )}

      {selected && (
        <Modal title={selected.eventName} onClose={() => setSelected(null)}>
          {[
            ["申請編號", selected.id],
            ["申請時間", selected.createdAt?.slice(0, 10)],
            ["品牌名稱", selected.brandName],
            ["聯絡人", selected.contactName],
            ["Email", selected.email],
            ["電話", selected.phone || "—"],
            ["使用地點", selected.location],
            ["活動日期", selected.date],
            ["時段", formatTimeText(selected.startTime, selected.endTime)],
            ["備註", selected.notes || "—"],
            ["狀態", ""],
            ["核准時間", selected.approvedAt?.slice(0, 10) || "—"],
            ["Calendar ID", selected.calendarEventId || "—"],
          ].map(([label, value]) => (
            label === "狀態" ? (
              <div key={label} className="detail-row">
                <span className="detail-label">狀態</span>
                <StatusBadge status={selected.status} />
              </div>
            ) : (
              <div key={label} className="detail-row">
                <span className="detail-label">{label}</span>
                <span className="detail-value">{value}</span>
              </div>
            )
          ))}
          {(selected.status === "Pending" || selected.status === "Conflict") && (
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => updateStatus(selected.id, "Approved")}>✓ 核准預約</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => updateStatus(selected.id, "Rejected")}>✕ 拒絕預約</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(() => {
    const v = sessionStorage.getItem("chazz_auth");
    const exp = Number(sessionStorage.getItem("chazz_auth_exp") || 0);
    return v === "true" && Date.now() < exp;
  });
  const [page, setPage] = useState("form"); // form | my | admin
  const [adminAuthed, setAdminAuthed] = useState(() => sessionStorage.getItem("chazz_admin") === "true");
  const [successData, setSuccessData] = useState(null);
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [authed, page]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const handleNavClick = (newPage) => {
    setPage(newPage);
    setSuccessData(null);
    setMenuOpen(false);
  };

  const handleLogoutClick = () => {
    logout();
    setMenuOpen(false);
  };

  const logout = () => {
    sessionStorage.removeItem("chazz_auth");
    sessionStorage.removeItem("chazz_auth_exp");
    setAuthed(false);
    setPage("form");
    setSuccessData(null);
  };

  const adminLogout = () => {
    sessionStorage.removeItem("chazz_admin");
    setAdminAuthed(false);
    setPage("form");
  };

  if (!authed) return (
    <>
      <style>{CSS}</style>
      <PasswordGate onSuccess={() => setAuthed(true)} />
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <header className="header">
          <div className="header-logo" onClick={() => handleNavClick("form")}>
            且自 <img src={logoSvg} alt="CHAZZ Logo" style={{ height: 18, margin: "0 4px" }} /> <span>空間預約</span>
          </div>
          <button className="mobile-menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? "✕" : "☰"}
          </button>
          <nav className="header-nav">
            <button className={`nav-btn${page === "form" ? " active" : ""}`} onClick={() => handleNavClick("form")}>預約申請</button>
            <button className={`nav-btn${page === "my" ? " active" : ""}`} onClick={() => handleNavClick("my")}>我的預約</button>
            <button className={`nav-btn${page === "admin" ? " active" : ""}`} onClick={() => handleNavClick("admin")}>後台管理</button>
            <button className="nav-btn logout" onClick={handleLogoutClick}>登出</button>
          </nav>
          {menuOpen && (
            <div className="mobile-nav-overlay" onClick={() => setMenuOpen(false)}>
              <button className={`nav-btn${page === "form" ? " active" : ""}`} onClick={(e) => { e.stopPropagation(); handleNavClick("form"); }}>預約申請</button>
              <button className={`nav-btn${page === "my" ? " active" : ""}`} onClick={(e) => { e.stopPropagation(); handleNavClick("my"); }}>我的預約</button>
              <button className={`nav-btn${page === "admin" ? " active" : ""}`} onClick={(e) => { e.stopPropagation(); handleNavClick("admin"); }}>後台管理</button>
              <button className="nav-btn logout" onClick={(e) => { e.stopPropagation(); handleLogoutClick(); }}>登出</button>
            </div>
          )}
        </header>

        <main className="main">
          {page === "form" && (
            successData
              ? <SuccessPage
                  data={successData}
                  onNew={() => setSuccessData(null)}
                  onMyReservations={() => { setPage("my"); setSuccessData(null); }}
                />
              : <ReservationForm
                  onSuccess={data => setSuccessData(data)}
                  showToast={showToast}
                />
          )}
          {page === "my" && <MyReservations showToast={showToast} />}
          {page === "admin" && (
            adminAuthed
              ? <AdminDashboard showToast={showToast} onLogout={adminLogout} />
              : <AdminLogin onLogin={() => setAdminAuthed(true)} />
          )}
        </main>
      </div>
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}

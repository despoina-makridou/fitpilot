"""
FitPilot study report generator.

Pulls all study data from Supabase and produces a multi-page PDF comparing the
AI arm vs the non-AI arm on schedule adherence, effort, points, and trends.

Usage:
    1) pip install -r requirements.txt
    2) copy config.example.py -> config.py and paste your SERVICE_ROLE key
    3) python report.py            # writes fitpilot_report_<date>.pdf

Re-run any time for a fresh PDF from the latest cloud data.
"""

from __future__ import annotations
import sys
import datetime as dt
from pathlib import Path

import requests
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages

try:
    import config
except ImportError:
    sys.exit("Missing config.py — copy config.example.py to config.py and fill it in.")

# ---------------------------------------------------------------- theme
AI_COLOR = "#B4FF39"      # lime (matches the app accent)
NONAI_COLOR = "#5B8DEF"   # blue
OUTCOME_COLORS = {"completed": "#4ADE80", "partial": "#FBBF24", "skipped": "#F87171"}
BG = "#0B0F0E"
FG = "#F2F5F4"
DIM = "#9AA6A2"

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": BG, "savefig.facecolor": BG,
    "text.color": FG, "axes.labelcolor": FG, "xtick.color": DIM, "ytick.color": DIM,
    "axes.edgecolor": "#2A3330", "axes.titlecolor": FG, "font.size": 11,
})


# ---------------------------------------------------------------- data
def fetch(table: str) -> pd.DataFrame:
    """Fetch an entire table via the Supabase REST API (service_role)."""
    url = f"{config.SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": config.SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {config.SERVICE_ROLE_KEY}",
    }
    rows, offset, page = [], 0, 1000
    while True:
        r = requests.get(
            url,
            headers={**headers, "Range-Unit": "items", "Range": f"{offset}-{offset+page-1}"},
            params={"select": "*"},
            timeout=30,
        )
        r.raise_for_status()
        batch = r.json()
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return pd.DataFrame(rows)


def load() -> tuple[pd.DataFrame, pd.DataFrame]:
    profiles = fetch("profiles")
    logs = fetch("adherence_logs")
    if logs.empty:
        sys.exit("No adherence_logs found. Seed or collect some data first.")
    logs["logged_at"] = pd.to_datetime(logs["logged_at"], utc=True, errors="coerce")
    logs["session_date"] = pd.to_datetime(logs["session_date"], errors="coerce")
    for c in ("minutes", "target_minutes", "points", "base_points", "streak_bonus"):
        if c in logs:
            logs[c] = pd.to_numeric(logs[c], errors="coerce").fillna(0)
    return profiles, logs


# ---------------------------------------------------------------- stats
def arm_summary(logs: pd.DataFrame, profiles: pd.DataFrame) -> pd.DataFrame:
    g = logs.groupby("group")
    out = pd.DataFrame({
        "sessions": g.size(),
        "completed": logs.assign(x=logs.outcome.eq("completed")).groupby("group")["x"].sum(),
        "partial": logs.assign(x=logs.outcome.eq("partial")).groupby("group")["x"].sum(),
        "skipped": logs.assign(x=logs.outcome.eq("skipped")).groupby("group")["x"].sum(),
        "avg_minutes": g["minutes"].mean(),
        "total_points": g["points"].sum(),
    })
    out["adherence_pct"] = (100 * out["completed"] / out["sessions"]).round(1)
    parts = profiles.groupby("group").size() if not profiles.empty else pd.Series(dtype=int)
    out["participants"] = parts
    out["avg_points_per_user"] = (out["total_points"] / out["participants"]).round(1)
    return out.reindex(["ai", "non_ai"]).dropna(how="all")


def label_arm(g: str) -> str:
    return "AI Coach" if g == "ai" else "Standard"


def color_arm(g: str) -> str:
    return AI_COLOR if g == "ai" else NONAI_COLOR


# ---------------------------------------------------------------- pages
def page_title(pdf, summary):
    fig = plt.figure(figsize=(8.27, 11.69))  # A4 portrait
    fig.text(0.5, 0.82, "FitPilot", ha="center", fontsize=42, fontweight="bold", color=AI_COLOR)
    fig.text(0.5, 0.77, "AI vs Non-AI Adherence — Study Report", ha="center", fontsize=16, color=FG)
    fig.text(0.5, 0.73, dt.date.today().strftime("Generated %B %d, %Y"), ha="center", fontsize=11, color=DIM)

    # headline numbers
    y = 0.58
    for g in [x for x in ("ai", "non_ai") if x in summary.index]:
        s = summary.loc[g]
        fig.text(0.5, y, label_arm(g), ha="center", fontsize=15, fontweight="bold", color=color_arm(g))
        fig.text(0.5, y - 0.035,
                 f"{s.adherence_pct:.0f}% adherence   ·   "
                 f"{int(s.participants)} users   ·   "
                 f"{s.avg_points_per_user:.0f} avg pts",
                 ha="center", fontsize=12, color=FG)
        y -= 0.10

    # headline delta
    if {"ai", "non_ai"}.issubset(summary.index):
        delta = summary.loc["ai", "adherence_pct"] - summary.loc["non_ai", "adherence_pct"]
        verdict = ("The AI arm showed HIGHER adherence" if delta > 0
                   else "The AI arm showed LOWER adherence" if delta < 0
                   else "The two arms showed EQUAL adherence")
        fig.text(0.5, 0.30, f"{verdict} by {abs(delta):.1f} percentage points.",
                 ha="center", fontsize=13, color=AI_COLOR if delta > 0 else FG, style="italic")

    fig.text(0.5, 0.06, "Personal/health data stays on-device; the cloud stores only study data.",
             ha="center", fontsize=8, color=DIM)
    pdf.savefig(fig); plt.close(fig)


def page_adherence_pies(pdf, logs, summary):
    arms = [g for g in ("ai", "non_ai") if g in summary.index]
    fig, axes = plt.subplots(1, len(arms), figsize=(8.27, 5.5))
    if len(arms) == 1:
        axes = [axes]
    fig.suptitle("Session outcomes by arm", fontsize=16, fontweight="bold", y=0.95)
    for ax, g in zip(axes, arms):
        d = logs[logs.group == g]
        counts = [ (d.outcome == k).sum() for k in ("completed", "partial", "skipped") ]
        colors = [OUTCOME_COLORS[k] for k in ("completed", "partial", "skipped")]
        ax.pie(counts, labels=["Completed", "Partial", "Skipped"], colors=colors,
               autopct=lambda p: f"{p:.0f}%" if p > 3 else "", startangle=90,
               textprops={"color": FG, "fontsize": 10},
               wedgeprops={"edgecolor": BG, "linewidth": 2})
        ax.set_title(f"{label_arm(g)}\n{int(summary.loc[g,'sessions'])} sessions",
                     color=color_arm(g), fontsize=13, fontweight="bold")
    fig.text(0.5, 0.06, "Adherence = completed ÷ all scheduled sessions (missed days are auto-recorded).",
             ha="center", fontsize=9, color=DIM)
    pdf.savefig(fig); plt.close(fig)


def page_bars(pdf, summary):
    arms = [g for g in ("ai", "non_ai") if g in summary.index]
    labels = [label_arm(g) for g in arms]
    colors = [color_arm(g) for g in arms]
    fig, axes = plt.subplots(2, 2, figsize=(8.27, 8.5))
    fig.suptitle("Key metrics: AI vs Standard", fontsize=16, fontweight="bold", y=0.97)

    def bar(ax, values, title, fmt="{:.0f}"):
        b = ax.bar(labels, values, color=colors, edgecolor=BG)
        ax.set_title(title, fontsize=12)
        ax.spines[["top", "right"]].set_visible(False)
        for rect, v in zip(b, values):
            ax.text(rect.get_x()+rect.get_width()/2, v, fmt.format(v),
                    ha="center", va="bottom", color=FG, fontsize=11, fontweight="bold")

    bar(axes[0,0], [summary.loc[g,"adherence_pct"] for g in arms], "Adherence rate (%)")
    bar(axes[0,1], [summary.loc[g,"avg_points_per_user"] for g in arms], "Avg points / user")
    bar(axes[1,0], [summary.loc[g,"avg_minutes"] for g in arms], "Avg minutes / session", "{:.1f}")
    bar(axes[1,1], [summary.loc[g,"participants"] for g in arms], "Participants")
    fig.tight_layout(rect=[0, 0.02, 1, 0.95])
    pdf.savefig(fig); plt.close(fig)


def page_trend(pdf, logs):
    logs = logs.copy()
    logs["date"] = logs["session_date"].dt.date
    fig, ax = plt.subplots(figsize=(8.27, 5.5))
    fig.suptitle("Adherence over time", fontsize=16, fontweight="bold", y=0.95)
    for g in [x for x in ("ai", "non_ai") if x in logs.group.unique()]:
        d = logs[logs.group == g]
        daily = d.assign(done=d.outcome.eq("completed")).groupby("date")["done"].mean() * 100
        ax.plot(list(daily.index), list(daily.values), marker="o",
                color=color_arm(g), label=label_arm(g), linewidth=2)
    ax.set_ylabel("Completed (%)"); ax.set_ylim(0, 100)
    ax.legend(facecolor=BG, edgecolor="#2A3330", labelcolor=FG)
    ax.spines[["top", "right"]].set_visible(False)
    fig.autofmt_xdate()
    fig.text(0.5, 0.02, "Does the AI arm sustain adherence better across the study window?",
             ha="center", fontsize=9, color=DIM)
    pdf.savefig(fig); plt.close(fig)


def page_narrative(pdf, summary, logs):
    fig = plt.figure(figsize=(8.27, 11.69))
    fig.text(0.08, 0.93, "Findings", fontsize=20, fontweight="bold", color=AI_COLOR)

    lines = []
    if {"ai", "non_ai"}.issubset(summary.index):
        ai, non = summary.loc["ai"], summary.loc["non_ai"]
        delta = ai.adherence_pct - non.adherence_pct
        lines += [
            f"• Adherence: AI {ai.adherence_pct:.1f}% vs Standard {non.adherence_pct:.1f}% "
            f"(difference {delta:+.1f} pts).",
            f"• Effort: AI users averaged {ai.avg_minutes:.1f} min/session vs "
            f"{non.avg_minutes:.1f} for Standard.",
            f"• Points: AI users averaged {ai.avg_points_per_user:.0f} pts vs "
            f"{non.avg_points_per_user:.0f} for Standard.",
            f"• Sample: {int(ai.participants)} AI and {int(non.participants)} Standard "
            f"participants; {int(ai.sessions+non.sessions)} total scheduled sessions.",
            "",
            "Interpretation:",
        ]
        if delta > 5:
            lines.append("  The AI-coached arm adhered to their schedule notably more often,")
            lines.append("  consistent with the hypothesis that AI nudging improves adherence.")
        elif delta < -5:
            lines.append("  The Standard arm adhered more often — the AI features did not help,")
            lines.append("  or may have distracted. Worth investigating engagement quality.")
        else:
            lines.append("  The two arms performed similarly; no strong adherence effect from AI")
            lines.append("  at this sample size. More participants may be needed to detect an effect.")
        lines += [
            "",
            "Caveats:",
            "  • Group assignment is auto-balanced (not user choice).",
            "  • Missed sessions are auto-recorded, so adherence has a fair denominator.",
            "  • Personal/health metrics are not collected in the cloud (privacy by design).",
        ]
    else:
        lines.append("• Only one arm has data so far — collect more to compare.")

    fig.text(0.08, 0.86, "\n".join(lines), fontsize=12, color=FG, va="top", linespacing=1.7)
    pdf.savefig(fig); plt.close(fig)


def page_table(pdf, summary):
    fig, ax = plt.subplots(figsize=(8.27, 4.5))
    ax.axis("off")
    fig.suptitle("Summary table", fontsize=16, fontweight="bold", y=0.9)
    cols = ["participants", "sessions", "completed", "partial", "skipped",
            "adherence_pct", "avg_minutes", "avg_points_per_user"]
    disp = summary[cols].copy()
    disp.index = [label_arm(g) for g in disp.index]
    disp = disp.round(1)
    tbl = ax.table(cellText=disp.values, colLabels=disp.columns, rowLabels=disp.index,
                   loc="center", cellLoc="center")
    tbl.auto_set_font_size(False); tbl.set_fontsize(9); tbl.scale(1, 1.6)
    for (r, c), cell in tbl.get_celld().items():
        cell.set_edgecolor("#2A3330")
        cell.set_facecolor("#151B19" if r > 0 else "#1E2624")
        cell.set_text_props(color=FG)
    pdf.savefig(fig); plt.close(fig)


def main():
    print("Fetching data from Supabase…")
    profiles, logs = load()
    print(f"  {len(profiles)} profiles, {len(logs)} adherence rows")
    summary = arm_summary(logs, profiles)

    out = Path(__file__).parent / f"fitpilot_report_{dt.date.today():%Y%m%d}.pdf"
    with PdfPages(out) as pdf:
        page_title(pdf, summary)
        page_adherence_pies(pdf, logs, summary)
        page_bars(pdf, summary)
        page_trend(pdf, logs)
        page_table(pdf, summary)
        page_narrative(pdf, summary, logs)
    print(f"\nDone. Wrote {out}")


if __name__ == "__main__":
    main()

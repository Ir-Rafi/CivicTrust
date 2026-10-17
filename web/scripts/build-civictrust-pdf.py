"""Regenerate CivicTrust.pdf (features + tech stack), v2, matching the v1 ReportLab style."""
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, Flowable, KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUT = sys.argv[1]
FONT_DIR = "/Library/Frameworks/Python.framework/Versions/3.14/lib/python3.14/site-packages/matplotlib/mpl-data/fonts/ttf/"
pdfmetrics.registerFont(TTFont("Sans", FONT_DIR + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("Sans-Bold", FONT_DIR + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Serif-Bold", FONT_DIR + "DejaVuSerif-Bold.ttf"))
pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold", italic="Sans", boldItalic="Sans-Bold")

INK = colors.HexColor("#1f2328")
MUTED = colors.HexColor("#6b7280")
LINE = colors.HexColor("#d9dce1")
HEAD_BG = colors.HexColor("#f3f4f6")
BLUE = colors.HexColor("#1f55c4")
GREEN = colors.HexColor("#1a7f37")
HL_FILL = colors.HexColor("#e8eefb")

PAGE_W, PAGE_H = A4
MARGIN = 51
CONTENT_W = PAGE_W - 2 * MARGIN

title = ParagraphStyle("title", fontName="Serif-Bold", fontSize=34, leading=40, textColor=INK, spaceAfter=6)
subtitle = ParagraphStyle("subtitle", fontName="Sans", fontSize=13, leading=17, textColor=BLUE, spaceAfter=16)
lead = ParagraphStyle("lead", fontName="Sans", fontSize=11, leading=16, textColor=INK, spaceAfter=12)
h1 = ParagraphStyle("h1", fontName="Serif-Bold", fontSize=22, leading=27, textColor=INK, spaceBefore=6, spaceAfter=8)
h2 = ParagraphStyle("h2", fontName="Sans-Bold", fontSize=12.5, leading=16, textColor=INK, spaceBefore=8, spaceAfter=8)
h3 = ParagraphStyle("h3", fontName="Sans-Bold", fontSize=10.5, leading=14, textColor=BLUE, spaceBefore=10, spaceAfter=4)
legend = ParagraphStyle("legend", fontName="Sans", fontSize=8, leading=11, textColor=MUTED, spaceAfter=8)
cell = ParagraphStyle("cell", fontName="Sans", fontSize=8.3, leading=11.5, textColor=INK)
cell_b = ParagraphStyle("cell_b", parent=cell, fontName="Sans-Bold")
head = ParagraphStyle("head", fontName="Sans-Bold", fontSize=7.8, leading=10, textColor=MUTED)
note = ParagraphStyle("note", fontName="Sans", fontSize=8.6, leading=12.5, textColor=INK)
small = ParagraphStyle("small", fontName="Sans", fontSize=7.8, leading=10.5, textColor=MUTED, spaceBefore=4)

PRIO_COLOR = {"P0": BLUE, "P1": GREEN, "P2": MUTED}


def P(text, style=cell):
    return Paragraph(text, style)


def table(rows, widths, header=True, bold_first=False):
    data = []
    for i, row in enumerate(rows):
        out = []
        for j, v in enumerate(row):
            if isinstance(v, Flowable):
                out.append(v)
            elif header and i == 0:
                out.append(P(v, head))
            elif bold_first and j == 0:
                out.append(P(v, cell_b))
            else:
                out.append(P(v))
        data.append(out)
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), HEAD_BG), ("LINEABOVE", (0, 0), (-1, 0), 0.5, LINE)]
    else:
        style += [("LINEABOVE", (0, 0), (-1, 0), 0.5, LINE)]
    t.setStyle(TableStyle(style))
    return t


def feature_table(items, header):
    rows = [["Feature", "Priority"]] if header else []
    for text, prio in items:
        rows.append([text, P(f'<font name="Sans-Bold" color="{PRIO_COLOR[prio].hexval()}">{prio}</font>')])
    return table(rows, [CONTENT_W - 88, 88], header=header)


class Diagram(Flowable):
    """Architecture diagram drawn to match the v1 box style."""

    def __init__(self, width):
        super().__init__()
        self.width = width
        self.height = 252

    def box(self, c, x, y, w, h, title_text, lines, highlight=False, dashed=False):
        c.saveState()
        c.setStrokeColor(BLUE if highlight else LINE)
        c.setFillColor(HL_FILL if highlight else colors.white)
        c.setLineWidth(1.4 if highlight else 0.8)
        if dashed:
            c.setDash(3, 2)
        c.roundRect(x, y, w, h, 5, stroke=1, fill=1)
        c.setDash()
        c.setFillColor(INK)
        c.setFont("Sans-Bold", 8.6)
        top = y + h - 17
        c.drawCentredString(x + w / 2, top, title_text)
        c.setFillColor(MUTED)
        c.setFont("Sans", 7.2)
        for i, line in enumerate(lines):
            c.drawCentredString(x + w / 2, top - 13 - i * 10, line)
        c.restoreState()

    def arrow(self, c, x1, y1, x2, y2, label=None, dashed=False):
        c.saveState()
        c.setStrokeColor(MUTED)
        c.setFillColor(MUTED)
        c.setLineWidth(0.7)
        if dashed:
            c.setDash(2, 2)
        c.line(x1, y1, x2, y2)
        c.setDash()
        p = c.beginPath()
        p.moveTo(x2, y2)
        p.lineTo(x2 - 2.6, y2 + 5)
        p.lineTo(x2 + 2.6, y2 + 5)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        if label:
            c.setFont("Sans", 6.8)
            c.drawString(x1 + 5, (y1 + y2) / 2 - 2, label)
        c.restoreState()

    def draw(self):
        c = self.canv
        W = self.width
        gap = 22
        col = (W - 2 * gap) / 3
        x1, x2, x3 = 0, col + gap, 2 * (col + gap)
        bh = 48
        r1 = self.height - bh            # top row
        r2 = r1 - bh - 30
        r3 = r2 - bh - 30
        bar_y = r3 - 44

        # Row 1
        self.box(c, x1, r1, 2 * col + gap, bh, "Web app (Next.js 16, mobile-first)",
                 ["Citizen · Ward officer · Contractor · NGO · Public portal",
                  "camera + GPS · one-click roles · Bangla + English"])
        self.box(c, x3, r1, col, bh, "Public data",
                 ["OSM roads, schools & hospitals", "ward boundaries (source pending)"])
        # Row 2
        self.box(c, x1, r2, 2 * col + gap, bh, "Next.js server (route handlers + server actions)",
                 ["Reports · Severity score · Duplicate check · Work orders",
                  "SLA deadlines · Repair verification · Audit log"], highlight=True)
        self.box(c, x3, r2, col, bh, "Seed scripts", ["loaded once into", "PostGIS layers"])
        # Row 3
        self.box(c, x1, r3, col, bh, "AI APIs", ["Gemini: vision + embeddings", "Groq: Bangla-English text"],
                 highlight=True)
        self.box(c, x2, r3, col, bh, "Supabase", ["Postgres + PostGIS + pgvector", "private photo storage · Realtime"])
        self.box(c, x3, r3, col, bh, "Finals: self-hosted ML (ONNX)",
                 ["YOLO detector · CLIP similarity", "replaces Gemini vision"], dashed=True)

        # Arrows
        self.arrow(c, x1 + col / 2, r1, x1 + col / 2, r2 + bh, "server actions")
        self.arrow(c, x2 + col / 2, r1, x2 + col / 2, r2 + bh)
        self.arrow(c, x3 + col / 2, r1, x3 + col / 2, r2 + bh)
        self.arrow(c, x1 + col / 2, r2, x1 + col / 2, r3 + bh, "photos, facts")
        self.arrow(c, x2 + col / 2, r2, x2 + col / 2, r3 + bh, "SQL / RPC")
        # seed -> Supabase (elbow)
        c.saveState()
        c.setStrokeColor(MUTED)
        c.setLineWidth(0.7)
        mid = (r2 + r3 + bh) / 2
        c.line(x3 + col / 2, r2, x3 + col / 2, mid)
        c.line(x3 + col / 2, mid, x2 + col * 0.82, mid)
        c.restoreState()
        self.arrow(c, x2 + col * 0.82, mid, x2 + col * 0.82, r3 + bh)

        # External bar
        c.saveState()
        c.setFillColor(HEAD_BG)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.8)
        c.roundRect(0, bar_y, W, 30, 5, stroke=1, fill=1)
        c.setFillColor(INK)
        c.setFont("Sans", 8.2)
        c.drawCentredString(W / 2, bar_y + 11,
                            "Hosting:  Vercel (app)  ·  Supabase cloud (database, storage)  ·  OpenStreetMap tiles")
        c.restoreState()


def on_page(c, doc):
    c.saveState()
    c.setFont("Sans", 7.5)
    c.setFillColor(MUTED)
    if doc.page > 1:
        c.drawString(MARGIN, PAGE_H - 34, "CivicTrust — Features and Tech Stack · v2")
    c.drawRightString(PAGE_W - MARGIN, 30, f"Page {doc.page} of {doc.total_pages}")
    c.restoreState()


class Doc(BaseDocTemplate):
    total_pages = 0


def build(story, total_pages):
    doc = Doc(OUT, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=52, bottomMargin=52,
              title="CivicTrust — Features and Tech Stack (v2)",
              subject="Civic issue reporting platform, CivicSphere AI", author="CivicTrust team")
    doc.total_pages = total_pages
    frame = Frame(MARGIN, 52, CONTENT_W, PAGE_H - 104, id="f", leftPadding=0, rightPadding=0,
                  topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=on_page)])
    doc.build(story)
    return doc.page


def make_story():
    s = []
    s.append(Paragraph("CivicTrust", title))
    s.append(Paragraph("Features and tech stack · v2, 17 October 2026", subtitle))
    s.append(Paragraph(
        "CivicTrust lets citizens report potholes and garbage with a photo. AI measures the problem and scores its "
        "urgency, the city assigns it to a contractor or an NGO, and AI checks the repair photo before the job closes. "
        "Entry for the International AI Builders Congress 2026, CivicSphere AI domain, Transparent Government challenge: no payment for a repair until AI verifies it, an audit trail nobody can edit, and public contractor scorecards.", lead))

    changes = [
        "<b>One app on Supabase.</b> The prototype is a single Next.js app with Supabase (Postgres, PostGIS, pgvector, "
        "storage). FastAPI, Celery, Redis and MinIO are no longer needed.",
        "<b>AI for the preliminary.</b> Gemini reads photos and Groq writes Bangla-English text. Custom YOLO and CLIP "
        "models move to the finals, self-hosted for data sovereignty.",
        "<b>No login in the prototype.</b> Judges switch roles in one click; the database is closed to the browser. "
        "Phone-OTP sign-up moves to the roadmap.",
        "<b>New and moved up.</b> A policy knowledge base (RAG) cites the rule behind every deadline. The audit log, "
        "citizen confirm/dispute and privacy steps are now P0.",
    ]
    change_rows = [[P("<b>What changed since v1</b>", note)]] + [[P("• " + c, note)] for c in changes]
    ct = Table(change_rows, colWidths=[CONTENT_W])
    ct.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HL_FILL),
        ("BOX", (0, 0), (-1, -1), 0.8, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
    ]))
    s.append(ct)
    s.append(Spacer(1, 6))

    s.append(Paragraph("Users", h2))
    s.append(table([
        ["Role", "Screen", "What they do"],
        ["Citizen", "Phone (mobile web)", "Report issues, track status, confirm or dispute the fix"],
        ["City authority / ward officer", "Dashboard", "Work the AI-ranked queue, correct the AI, assign contractors, approve NGO claims"],
        ["Contractor", "Phone (mobile web)", "Receive work orders, upload proof of repair"],
        ["NGO / volunteer group", "Phone (mobile web)", "Claim open issues to fix for free"],
        ["Public", "Transparency portal", "See open vs. fixed issues per ward"],
    ], [130, 105, CONTENT_W - 235], bold_first=True))
    s.append(Paragraph("All five roles live in one web app. In the prototype there is no sign-up: a role switcher gives "
                       "one-click access.", small))

    s.append(Paragraph("Features", h1))
    s.append(Paragraph("<b>P0</b> = must work in the preliminary demo (31 Oct) · <b>P1</b> = before the final (26 Dec) · "
                       "<b>P2</b> = roadmap", legend))

    s.append(Paragraph("Citizen", h3))
    s.append(feature_table([
        ("Bangla + English interface (Bangla by default); one-click role, no sign-up", "P0"),
        ("Snap a photo in the app's camera (no gallery upload); GPS, time and device attached automatically", "P0"),
        ("Instant AI result: issue type, severity 1–10 with every scoring factor shown, one-line reason in Bangla and English", "P0"),
        ('"Already reported" prompt: the report is counted on the existing issue instead of a duplicate', "P0"),
        ("Track status in the app (Reported → Verified → Assigned → In progress → Fixed → Confirmed)", "P0"),
        ("Confirm or dispute the fix", "P0"),
        ("Rate the contractor", "P1"),
        ("Offline queue: report saved without network, sent later", "P1"),
        ("Push and SMS status updates", "P2"),
    ], header=True))

    s.append(Paragraph("City authority / ward officer", h3))
    s.append(feature_table([
        ("AI-ranked issue queue, filtered by ward, type and status", "P0"),
        ("Live city map of all issues with clustering", "P0"),
        ("Assign to a contractor with the agreed cost; deadline set automatically from severity, citing the policy rule used", "P0"),
        ("Correct the AI's issue type or severity, with a reason; every correction is logged", "P0"),
        ('"Ask CivicTrust" assistant: questions about rules and live issues, in Bangla or English', "P1"),
        ("Approve NGO claims", "P1"),
        ("Contractor scorecards: repairs approved vs. rejected by AI, on-time rate, disputes", "P0"),
        ("Heatmap of hotspots, overdue alerts; recurring-hotspot insights for planning", "P1"),
        ("AI weekly summary per ward", "P2"),
    ], header=False))

    s.append(Paragraph("Contractor / NGO", h3))
    s.append(feature_table([
        ("Contractor inbox of work orders", "P0"),
        ("Upload after-photo at the same spot; AI closes the job only if it is fixed; unclear cases go to an officer", "P0"),
        ("Payment counts as released only after the AI-verified repair; withheld when the AI rejects it", "P0"),
        ("NGO board of claimable issues", "P1"),
        ('Directions to the issue; mark "work started"', "P1"),
    ], header=False))

    s.append(Paragraph("Public transparency portal", h3))
    s.append(feature_table([
        ("Open vs. fixed issues and average fix time per ward", "P0"),
        ("Money released for verified repairs vs. withheld for rejected ones", "P0"),
        ("Before/after gallery of verified repairs", "P0"),
    ], header=False))

    s.append(Paragraph("Platform, privacy and governance", h3))
    s.append(feature_table([
        ("Database closed to the browser: row-level security on every table, server-only access", "P0"),
        ("Tamper-evident audit log of every action and AI correction (hash-chained, append-only)", "P0"),
        ("Photo location metadata removed after reading; public sees area-level location only", "P0"),
        ("Architecture, data, security and audit pages for judges and partners", "P0"),
        ("Face and number-plate blurring on every photo (stretch goal for the preliminary)", "P1"),
        ("Citizen trust score: verified reports raise it, fake ones lower it", "P1"),
        ("Phone-OTP sign-up and per-user permissions", "P2"),
    ], header=False))

    ai = []
    ai.append(Paragraph("AI features", h2))
    ai.append(table([
        ["Model", "What it does", "Prototype (now)", "Finals"],
        ["M1 Issue detector",
         "Finds potholes, cracks, garbage piles, open drains and waterlogging; classes each as minor, moderate or severe",
         "Gemini vision (gemini-3.8-flash) with a strict JSON answer; rejects photos that are not a civic issue",
         "YOLO segmentation fine-tuned on RDD2022, TACO and our Dhaka photos, self-hosted"],
        ["M2 Severity score",
         "Rates how urgent the issue is, from 1 to 10, showing every factor",
         "Visual class 2/4/6 + main road +2 (secondary +1) + school or hospital within 200 m +1.5 (500 m +0.5) "
         "+ extra reports +0.5 each, capped at +1 + days open +0.1/day, capped at +1. Facts from OpenStreetMap via PostGIS",
         "Same formula"],
        ["M3 Duplicate / fake filter",
         "Merges repeat reports; flags old, copied or wrong-location photos",
         "PostGIS 25 m radius + Gemini same-scene check + camera-only, time checks",
         "CLIP image similarity"],
        ["M4 Repair verifier",
         "Approves or rejects the contractor's after-photo",
         "Same GPS (±15 m) + fresh photo (≤30 min, after the work order) + Gemini before/after comparison; unsure → officer",
         "CLIP same-scene + M1 finds no defect"],
        ["Explanation",
         'One-line reason in Bangla and English, e.g. "Deep pothole on a residential road, 61 m from a school"',
         "Groq (openai/gpt-oss-120b), written only from computed facts",
         "Same"],
        ["Policy knowledge (RAG)",
         "Finds the rule behind each deadline; answers officer questions",
         "Pilot service policy in pgvector, Gemini embeddings",
         "City's official rules when a partner signs on"],
    ], [86, 125, 160, CONTENT_W - 371], bold_first=True))
    s.extend(ai)

    stack = []
    stack.append(Paragraph("Tech stack", h1))
    stack.append(Paragraph("One web app, one database and two AI APIs", h2))
    stack.append(Diagram(CONTENT_W))
    s.append(KeepTogether(stack))
    s.append(Spacer(1, 4))
    s.append(table([
        ["Layer", "Technology", "Used for"],
        ["App", "Next.js 16 + TypeScript + Tailwind, mobile-first", "All five roles' screens; camera, GPS, Bangla + English"],
        ["Maps", "Leaflet + OpenStreetMap, marker clustering", "Issue map, clustering, heatmaps"],
        ["Backend", "Next.js route handlers + server actions", "Reports, severity, duplicate check, work orders, deadlines, repair verification"],
        ["Database", "Supabase Postgres + PostGIS", "Issues, roads, schools and hospitals, distance queries"],
        ["Knowledge (RAG)", "pgvector + Gemini embeddings", "Policy rules cited for deadlines; officer assistant"],
        ["File storage", "Supabase Storage (private bucket, signed links)", "Report and repair photos"],
        ["Real-time", "Supabase Realtime", "Live dashboard updates"],
        ["Vision AI", "Gemini (gemini-3.8-flash), strict JSON", "M1 detection, M3 duplicate check, M4 repair verification"],
        ["Text AI", "Groq (openai/gpt-oss-120b), strict JSON", "Bangla-English explanations, officer assistant"],
        ["Access", "Role switcher; row-level security; server-only database access", "One-click demo roles; database closed to the browser"],
        ["Audit", "Hash-chained, append-only Postgres table", "Tamper-evident record of every action and AI correction"],
        ["Hosting", "Vercel + Supabase cloud", "Public URL for judges"],
        ["Finals ML", "YOLO + CLIP on ONNX Runtime", "Self-hosted detection; photos stay on our servers"],
    ], [92, 190, CONTENT_W - 282], bold_first=True))
    return s


# Two passes so the footer can print "Page x of y".
pages = build(make_story(), 0)
build(make_story(), pages)
print(f"wrote {OUT} ({pages} pages)")

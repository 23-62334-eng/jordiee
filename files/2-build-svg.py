import json, colorsys

grid = json.load(open('grid.json'))
ROWS = len(grid)
COLS = len(grid[0])

# ---------------------------------------------------------------- geometry
AF = 14.0                      # ascii font-size
ACW = AF * 0.60                # ascii cell width
ACH = AF * 1.14                # ascii line height
PF = 12.5                      # panel font-size
PLH = PF * 1.52                # panel line height
PAD = 26
BAR = 34                       # window title bar height
GAP = 46                       # gap between art and panel
LABEL_W = 114                  # panel label column width

MONO_ART = True   # render the portrait in greyscale
MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono','DejaVu Sans Mono',monospace"

ART_W = COLS * ACW
ART_H = ROWS * ACH

# ---------------------------------------------------------------- content
USER = "jordiee"
HOST = "macbook"
CWD = "~/github"
QUOTE = "Never stop learning; every day holds something new to discover."

PANEL = [
    ("Name",        "Mark Jordan B. Javier"),
    ("Role",        "Full Stack Web Developer  ·  Freelance"),
    ("Location",    "Batangas, Philippines (GMT+8)"),
    ("Education",   "BS Information Technology — Business Analytics"),
    ("",            "Batangas State University  ·  4th year"),
    None,
    ("Focus",       "AI Integration  ·  Web Systems  ·  Data Analytics"),
    None,
    ("Languages",   "TypeScript · JavaScript · Python · PHP · Java · C#"),
    ("Frontend",    "React · Next.js · React Native · Tailwind CSS"),
    ("Backend",     "Node.js · Express.js · Prisma · REST APIs"),
    ("Data",        "PostgreSQL · MySQL · MongoDB · Supabase"),
    ("AI / ML",     "TensorFlow Lite · XGBoost · MobileNetV2"),
    ("Automation",  "n8n · Docker · XAMPP"),
    ("Design",      "Figma · Prettier"),
    ("Tools",       "Git · GitHub · Postman · Power BI"),
    ("Editors",     "VS Code · Cursor · IntelliJ IDEA · PyCharm"),
    ("",            "NetBeans · Xcode"),
    None,
    ("Capstone",    "Integrated Payroll & Mobile Commercial System"),
    ("",            "for Tanauan City Water District"),
    ("Client work", "TWD Project Monitoring System"),
    ("Projects",    "School Evaluation System · Vehicle Rental System"),
    ("",            "Online Thrift Shop · Malvar Bat Cave Café"),
    ("",            "Time Scheduling System · Portfolio Website"),
    None,
    ("Certified",   "Claude 101 · Claude Code in Action · Agent Skills"),
    ("",            "Anthropic · 2026"),
    ("",            "Microsoft Power BI Data Analyst · 2025"),
    ("Conferences", "DataBiz 2024 · DataBiz 2025 · BITCON 2025"),
    ("",            "TechTalks S3 · CICS Student Council · 2025"),
    None,
    ("Currently",   "Capstone development · open to internships"),
    None,
    ("Portfolio",   "jordiee.me"),
    ("GitHub",      "github.com/Jordieeeee"),
    ("Email",       "javiermarkjordan@gmail.com"),
]

SWATCH = ["#484f58", "#ff7b72", "#3fb950", "#d29922",
          "#58a6ff", "#bc8cff", "#39c5cf", "#b1bac4"]
SWATCH2 = ["#6e7681", "#ffa198", "#56d364", "#e3b341",
           "#79c0ff", "#d2a8ff", "#56d4dd", "#f0f6fc"]

THEMES = {
    "dark": dict(bg="#0d1117", bar="#161b22", border="#30363d", title="#8b949e",
                 user="#7ee787", host="#7ee787", path="#79c0ff", prompt="#8b949e",
                 cmd="#c9d1d9", head_a="#7ee787", head_b="#79c0ff",
                 label="#ffa657", value="#c9d1d9", rule="#30363d",
                 cursor="#7ee787", string="#a5d6ff", quote="#8b949e", sw=SWATCH, sw2=SWATCH2, ink_lo=0.36, ink_hi=1.00),
    "light": dict(bg="#ffffff", bar="#f6f8fa", border="#d0d7de", title="#57606a",
                  user="#1a7f37", host="#1a7f37", path="#0969da", prompt="#57606a",
                  cmd="#24292f", head_a="#1a7f37", head_b="#0969da",
                  label="#bc4c00", value="#24292f", rule="#d0d7de",
                  cursor="#1a7f37", string="#0a3069", quote="#57606a",
                  sw=["#afb8c1", "#cf222e", "#1a7f37", "#9a6700",
                      "#0969da", "#8250df", "#1b7c83", "#57606a"],
                  sw2=["#8c959f", "#a40e26", "#116329", "#7d4e00",
                       "#0550ae", "#6639ba", "#155d63", "#24292f"],
                  ink_lo=0.60, ink_hi=0.04),
}


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def hex2rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))


def rgb2hex(r, g, b):
    f = lambda v: max(0, min(255, int(round(v * 255))))
    return "#%02x%02x%02x" % (f(r), f(g), f(b))


def retone(hexcol, lo, hi):
    """Re-map a cell colour onto the theme's ink range, keeping its hue."""
    r, g, b = hex2rgb(hexcol)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    target = lo + (hi - lo) * lum
    s = 0.0 if MONO_ART else min(1.0, s * (0.85 if hi > lo else 1.05))
    return rgb2hex(*colorsys.hls_to_rgb(h, target, s))


def art_runs(theme):
    """Merge same-colour horizontal spans into single <text> runs."""
    lo, hi = theme["ink_lo"], theme["ink_hi"]
    cache, out = {}, []
    for y, row in enumerate(grid):
        x = 0
        while x < COLS:
            ch, col = row[x]
            if ch == " " or col is None:
                x += 1
                continue
            if col not in cache:
                cache[col] = retone(col, lo, hi)
            fill = cache[col]
            start, buf = x, []
            while x < COLS and row[x][1] == col and row[x][0] != " ":
                buf.append(row[x][0])
                x += 1
            out.append((start, y, "".join(buf), fill))
    return out


def build(name):
    t = THEMES[name]
    runs = art_runs(t)

    panel_lines = len(PANEL)
    header_block = PLH * 2.4
    panel_h = header_block + panel_lines * PLH + PLH * 1.9
    panel_w = 512

    body_h = max(ART_H, panel_h)
    prompt_h = PLH * 1.4

    W = PAD * 2 + ART_W + GAP + panel_w
    bottom_h = prompt_h
    H = BAR + PAD + prompt_h + 12 + body_h + 14 + bottom_h + PAD
    W, H = round(W), round(H)

    art_x = PAD
    art_y = BAR + PAD + prompt_h + 12 + (body_h - ART_H) / 2
    panel_x = PAD + ART_W + GAP
    panel_y = BAR + PAD + prompt_h + 12 + (body_h - panel_h) / 2 + PF

    s = []
    a = s.append
    a(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
      f'font-family="{MONO}" role="img" '
      f'aria-label="Terminal-style profile card for Mark Jordan Javier, full stack web developer, Batangas Philippines">')
    a('<defs><clipPath id="win"><rect x="0.5" y="0.5" width="%d" height="%d" rx="11"/></clipPath></defs>'
      % (W - 1, H - 1))
    a(f'<g clip-path="url(#win)">')
    a(f'<rect x="0" y="0" width="{W}" height="{H}" fill="{t["bg"]}"/>')
    a(f'<rect x="0" y="0" width="{W}" height="{BAR}" fill="{t["bar"]}"/>')
    a(f'<line x1="0" y1="{BAR}.5" x2="{W}" y2="{BAR}.5" stroke="{t["border"]}" stroke-width="1"/>')
    for i, c in enumerate(("#ff5f57", "#febc2e", "#28c840")):
        a(f'<circle cx="{22 + i * 20}" cy="{BAR / 2}" r="6" fill="{c}"/>')
    a(f'<text x="{W/2}" y="{BAR/2 + 4.2}" text-anchor="middle" font-size="12" fill="{t["title"]}">'
      f'{esc(f"{USER}@{HOST} — {CWD}/Jordieeeee")}</text>')
    a('</g>')
    a(f'<rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" rx="11" fill="none" '
      f'stroke="{t["border"]}" stroke-width="1"/>')

    # ---- top prompt
    py = BAR + PAD + PF
    a(f'<text x="{PAD}" y="{py}" font-size="{PF}" font-weight="700">'
      f'<tspan fill="{t["user"]}">{USER}@{HOST}</tspan>'
      f'<tspan fill="{t["prompt"]}">:</tspan>'
      f'<tspan fill="{t["path"]}">{esc(CWD)}</tspan>'
      f'<tspan fill="{t["prompt"]}">$ </tspan>'
      f'<tspan fill="{t["cmd"]}" font-weight="400">fastfetch</tspan></text>')

    # ---- ascii art
    a(f'<g font-size="{AF}" font-weight="700" xml:space="preserve" '
      f'style="white-space:pre">')
    for cx, cy, txt, fill in runs:
        x = round(art_x + cx * ACW, 2)
        y = round(art_y + cy * ACH + AF, 2)
        tl = round(len(txt) * ACW, 2)
        a(f'<text x="{x}" y="{y}" fill="{fill}" textLength="{tl}" '
          f'lengthAdjust="spacing">{esc(txt)}</text>')
    a('</g>')

    # ---- panel
    a(f'<g font-size="{PF}">')
    a(f'<text x="{panel_x}" y="{panel_y}" font-weight="700">'
      f'<tspan fill="{t["head_a"]}">{USER}</tspan>'
      f'<tspan fill="{t["value"]}">@</tspan>'
      f'<tspan fill="{t["head_b"]}">{HOST}</tspan></text>')
    a(f'<line x1="{panel_x}" y1="{panel_y + 9}.5" x2="{panel_x + panel_w - 20}" '
      f'y2="{panel_y + 9}.5" stroke="{t["rule"]}" stroke-width="1"/>')

    y = panel_y + PLH * 2.0
    for row in PANEL:
        if row is None:
            y += PLH * 0.55
            continue
        label, value = row
        if label:
            a(f'<text x="{panel_x}" y="{round(y,2)}" fill="{t["label"]}" font-weight="700">{esc(label)}</text>')
        a(f'<text x="{panel_x + LABEL_W}" y="{round(y,2)}" fill="{t["value"]}">{esc(value)}</text>')
        y += PLH

    y += PLH * 0.55
    a(f'<line x1="{panel_x}" y1="{round(y - PLH * 0.85, 2)}" x2="{panel_x + panel_w - 20}" '
      f'y2="{round(y - PLH * 0.85, 2)}" stroke="{t["rule"]}" stroke-width="1"/>')
    a(f'<text x="{panel_x}" y="{round(y, 2)}" fill="{t["quote"]}" font-style="italic" '
      f'font-size="{PF}">"{esc(QUOTE)}"</text>')
    a('</g>')

    # ---- bottom prompt + cursor
    by = round(H - PAD - 2, 2)

    def prompt(y, tail):
        return (f'<text x="{PAD}" y="{y}" font-size="{PF}" font-weight="700" '
                f'xml:space="preserve" style="white-space:pre">'
                f'<tspan fill="{t["user"]}">{USER}@{HOST}</tspan>'
                f'<tspan fill="{t["prompt"]}">:</tspan>'
                f'<tspan fill="{t["path"]}">{esc(CWD)}</tspan>'
                f'<tspan fill="{t["prompt"]}">$ </tspan>' + tail + '</text>')

    a(prompt(by, f'<tspan fill="{t["cursor"]}">\u2588</tspan>'))

    a('</svg>')
    return "\n".join(s), W, H


import os
os.makedirs('assets', exist_ok=True)
for name in ("dark", "light"):
    svg, W, H = build(name)
    p = f'assets/neofetch-{name}.svg'
    open(p, 'w').write(svg)
    print(p, len(svg) // 1024, 'KB', W, 'x', H)

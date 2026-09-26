#!/usr/bin/env python3
"""Queue, ledger and detail guard for the ui-copy-humanizer agent.

The agent rewrites the words a psy_kick visitor reads (button labels, hints,
dialogs, empty states, error messages) one source file at a time with the
humanizer skill. This script picks the file, checks that the rewrite changed
only copy and kept every detail, and records the file as done.

    python3 scripts/humanize_copy.py next                  # print the next file to humanize
    python3 scripts/humanize_copy.py status                # counts per group: done, stale, remaining
    python3 scripts/humanize_copy.py next --group NAME     # next file in one group only
    python3 scripts/humanize_copy.py status --group NAME
    python3 scripts/humanize_copy.py check PATH            # compare PATH with its HEAD version
    python3 scripts/humanize_copy.py check PATH --copy 'OLD=>NEW'
    python3 scripts/humanize_copy.py record PATH           # mark PATH as humanized

Paths are relative to the repo root, e.g. "pages/session/[id]/capture.vue".

The queue walks five groups in order (see GROUPS): the screens and their
controls first, then the explainers that describe those controls, then the
server messages that surface in the UI, then the how_this_works illustrations
that mimic the real controls, then any Markdown docs. Controls go first so an
explainer that names a button uses the button's final name. A tracked file
under one of the discovery roots that is not listed joins the end of its group
automatically, and a file that puts no text on screen (by the masker's own
definition) never enters the queue. After every file is done once, a file whose
content changed since it was recorded comes back.

For a source file (.vue or .ts), `check` masks every piece of copy (template
text, static copy attributes, copy string literals) and requires the rest of
the file, the code, to be unchanged byte for byte. <style> blocks must be
unchanged too. It then compares the copy itself, old against new, and fails if
a number, a quotation or a URL was lost or added. A single lowercase word such
as 'ready_to_judge' cannot be told apart from a status code, so the masker
leaves it visible; to rename one, pass `--copy 'ready_to_judge=>ready_to_rank'`
and the check accepts that one change if the old literal appears exactly once
in the old file and the new literal exactly once in the new file.

For a Markdown file, `check` locks frontmatter, headings, code fences and
inline code, and fails if a link, number or quotation was lost or added.

Both kinds print warnings (capitalised words or emphasised spans that vanished)
for the agent to review by hand; warnings alone exit 0. Errors exit 1.
"""

from __future__ import annotations

import difflib
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / ".claude" / "humanized.json"
VERIFY_HINT = "bunx nuxi typecheck"

# ---------------------------------------------------------------- queue ---

# Sweep order. Screens follow a first-time visitor's path through the app;
# explainers come after the screens whose controls they name; illustrations
# mirror the real labels, so they go after every screen and explainer.
GROUPS: dict[str, list[str]] = {
    "screens": [
        "layouts/default.vue",
        "pages/sessions.vue",
        "components/NewSessionDialog.vue",
        "pages/session/[id]/cool-down.vue",
        "pages/session/[id]/capture.vue",
        "components/SketchCanvas.vue",
        "pages/session/[id]/judge.vue",
        "pages/session/[id]/reveal.vue",
        "pages/session/[id]/result.vue",
        "pages/history.vue",
        "pages/stats.vue",
        "pages/leaderboard.vue",
        "components/RateBar.vue",
        "pages/review_others.vue",
        "components/AuthDialog.vue",
        "components/DialogShell.vue",
        "pages/settings.vue",
        "pages/auth/confirm.vue",
        "pages/auth/reset.vue",
    ],
    "explainers": [
        "pages/index.vue",
        "app.vue",
        "components/ProtocolSteps.vue",
        "components/HowThisWorksDialog.vue",
        "components/StatsInfoModal.vue",
        "components/ScoreInfoDialog.vue",
    ],
    "messages": [
        "server/utils/auth.ts",
        "server/api/auth/login.post.ts",
        "server/api/auth/reserve-username.post.ts",
        "server/api/auth/reset.post.ts",
        "server/api/session/begin.post.ts",
    ],
    "illustrations": [
        "components/illustrations/crv/BreatheLoop.vue",
        "components/illustrations/crv/IdeogramLoop.vue",
        "components/illustrations/crv/CaptureTypingLoop.vue",
        "components/illustrations/crv/LockInLoop.vue",
        "components/illustrations/crv/JudgeDecoysLoop.vue",
        "components/illustrations/crv/RevealTargetLoop.vue",
        "components/illustrations/crv/ResultsLoop.vue",
    ],
    "docs": [],
}

# Where unlisted files are discovered. Anything outside these never enters the
# queue: scripts/ (developer CLIs), seed/ (target manifests and Pixabay
# attribution: data), supabase/ (migrations, seed.sql, config.toml), public/,
# assets/, plugins/, nuxt.config.ts, app.config.ts, lockfiles, build output.
DISCOVER = re.compile(
    r"^(app\.vue"
    r"|(pages|layouts|components)/.+\.vue"
    r"|composables/.+\.ts"
    r"|server/(api|utils)/.+\.ts"
    r"|[^/]+\.md|docs/.+\.md)$"
)
# Agent instructions, not reader copy. The vendored skill must stay unmodified.
SKIP_FILES = {"CLAUDE.md", "AGENTS.md"}
# Word lists that generate usernames: data that happens to be English.
SKIP_FILES |= {"server/utils/handles.ts"}
SKIP_PARTS = {"tests", "test", "e2e", "__tests__", ".claude", "node_modules", ".nuxt", ".output"}
SKIP_SUFFIXES = (".test.ts", ".spec.ts", ".d.ts")


def tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True,
                         capture_output=True, text=True).stdout
    return [p for p in out.split("\0") if p]


def group_of(path: str) -> str:
    for name, files in GROUPS.items():
        if path in files:
            return name
    if path.endswith(".md"):
        return "docs"
    if path.startswith("components/illustrations/"):
        return "illustrations"
    if path.startswith(("server/", "composables/")):
        return "messages"
    return "screens"


def eligible(path: str) -> bool:
    if path in SKIP_FILES or path.endswith(SKIP_SUFFIXES):
        return False
    if any(part in SKIP_PARTS for part in Path(path).parts):
        return False
    return bool(DISCOVER.match(path))


def has_copy(path: str) -> bool:
    """True when the file puts words on screen, by the masker's definition."""
    full = ROOT / path
    if not full.is_file():
        return False
    text = full.read_text(encoding="utf-8")
    if path.endswith(".md"):
        return bool(text.strip())
    return bool(Masker().mask(text, path.endswith(".vue")))


def all_items(group: str | None = None) -> list[str]:
    """Every file in sweep order: listed files first, then discovered ones."""
    tracked = [p for p in tracked_files() if eligible(p)]
    tracked_set = set(tracked)
    items: list[str] = []
    for name, files in GROUPS.items():
        if group and name != group:
            continue
        listed = [f for f in files if f in tracked_set]
        extra = sorted((p for p in tracked if group_of(p) == name and p not in files), key=str.lower)
        items += [p for p in listed + extra if has_copy(p)]
    return items


def load_ledger() -> dict:
    if LEDGER.exists():
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    return {}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def classify(group: str | None = None) -> tuple[list[str], list[str], list[str]]:
    """Split files into (never done, changed since done, done and unchanged)."""
    ledger = load_ledger()
    new, stale, done = [], [], []
    for item in all_items(group):
        entry = ledger.get(item)
        if entry is None:
            new.append(item)
        elif entry.get("sha256") != sha(ROOT / item):
            stale.append(item)
        else:
            done.append(item)
    return new, stale, done


def cmd_next(group: str | None) -> int:
    new, stale, _ = classify(group)
    queue = new + stale
    print(queue[0] if queue else "ALL DONE")
    return 0


def cmd_status(group: str | None) -> int:
    names = [group] if group else list(GROUPS)
    totals = [0, 0, 0]
    for name in names:
        new, stale, done = classify(name)
        if not (new or stale or done):
            continue
        print(f"{name:14} done: {len(done)}  never humanized: {len(new)}  changed since humanized: {len(stale)}")
        totals = [totals[0] + len(done), totals[1] + len(new), totals[2] + len(stale)]
    if not group:
        print(f"{'all':14} done: {totals[0]}  never humanized: {totals[1]}  changed since humanized: {totals[2]}")
    return 0


def cmd_record(page: Path) -> int:
    ledger = load_ledger()
    ledger[rel(page)] = {
        "humanized_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sha256": sha(page),
    }
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(dict(sorted(ledger.items())), indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
    print(f"recorded {rel(page)}")
    return 0


# ------------------------------------------------------------ copy facts ---

URL_RE = re.compile(r"\]\([^)]+\)|https?://[^\s'\"`<>)]+|[\w.+-]+@[\w-]+\.[\w.]+")
NUMBER_RE = re.compile(r"(?<![\w.])\d[\d,]*(?:\.\d+)?")
QUOTE_RE = re.compile(r"\"([^\"\n]{3,})\"|“([^”\n]{3,})”")
ITALIC_RE = re.compile(r"(?<![*\w])\*([^*\n]+)\*(?![*\w])|(?<!\w)_([^_\n]+)_(?!\w)")
EM_RE = re.compile(r"<(em|strong|b|i)>([^<]+)</\1>")
# Capitalised words mid-sentence: likely names (Ingo Swann, Google, CRV).
# Words that open a sentence are skipped because rewording moves them freely.
CAP_RE = re.compile(r"(?<=[\w,;:)\]] )[A-Z][A-Za-z0-9'’.-]*[A-Za-z0-9]\b")
INLINE_CODE_RE = re.compile(r"`[^`\n]+`")


def facts(prose: str, markdown: bool) -> dict[str, Counter]:
    bare = URL_RE.sub(" ", prose)
    out = {
        "links": Counter(URL_RE.findall(prose)),
        "numbers": Counter(n.replace(",", "") for n in NUMBER_RE.findall(bare)),
        "quotes": Counter(a or b for a, b in QUOTE_RE.findall(prose)),
        "capitalised": Counter(CAP_RE.findall(bare)),
    }
    if markdown:
        out["inline code"] = Counter(INLINE_CODE_RE.findall(prose))
        out["emphasis"] = Counter(a or b for a, b in ITALIC_RE.findall(prose))
    return out


def compare_facts(old: str, new: str, markdown: bool, errors: list[str], warnings: list[str]) -> None:
    before, after = facts(old, markdown), facts(new, markdown)
    hard = ("links", "numbers", "quotes") + (("inline code",) if markdown else ())
    for kind in hard:
        lost, gained = before[kind] - after[kind], after[kind] - before[kind]
        if lost:
            errors.append(f"{kind} lost from the copy: {show(lost)}")
        if gained:
            errors.append(f"{kind} added to the copy: {show(gained)}")
    for kind in ("capitalised", "emphasis"):
        if kind not in before:
            continue
        lost = before[kind] - after[kind]
        # A word may survive in a new position (a sentence start, a new case),
        # so warn only when it is gone entirely. Review, not failure.
        lost = Counter({k: v for k, v in lost.items() if not mentions(new, k)})
        if lost:
            warnings.append(f"{kind} no longer present: {show(lost)}")


def mentions(text: str, phrase: str) -> bool:
    """Whether `phrase` still appears as whole words ('Targ' is not in 'target')."""
    return re.search(r"(?<!\w)" + re.escape(phrase.lower()) + r"(?!\w)", text.lower()) is not None


def show(counter: Counter) -> str:
    return ", ".join(f"{k!r}" + (f" x{v}" if v > 1 else "") for k, v in sorted(counter.items()))


# ------------------------------------------------------------ the masker ---

# Comments come first so an apostrophe in a comment never opens a string.
STRING_RE = re.compile(r"//[^\n]*|/\*.*?\*/|'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`", re.S)
# Object keys whose string value is copy (a nav label, a placeholder, an error
# message, a page title), wherever the object is.
COPY_KEY_RE = re.compile(r"(?:^|[\s{,(])(?:label|placeholder|title|description|eyebrow|message|"
                         r"statusMessage|hint|caption|text|alt|ariaLabel|ogImageAlt|"
                         r"ogTitle|ogDescription|twitterTitle|twitterDescription)\s*:\s*$")
# Attributes whose value a reader sees or hears. `eyebrow` and `title` are the
# DialogShell header; `label` covers Nuxt UI props.
COPY_ATTRS = {"aria-label", "aria-description", "title", "placeholder", "alt", "label",
              "description", "eyebrow"}
STATIC_ATTR_RE = re.compile(r"(?<=\s)(" + "|".join(sorted(COPY_ATTRS, key=len, reverse=True)) + r")=\"([^\"]*)\"")
BOUND_ATTR_RE = re.compile(r"(?<=\s)((?::|v-bind:|@|v-on:|#|v-)[\w:.\[\]-]*)=\"([^\"]*)\"")
# In a mustache or a copy attribute, a string after ? : || or ?? is output.
OUTPUT_CTX_RE = re.compile(r"(?:\?|:|\|\||\?\?)\s*$")
# Single-word strings that are code, not copy: keyboard keys and the like.
CODE_WORDS = {"Enter", "Escape", "Tab", "Home", "End", "Space", "Backspace", "Delete",
              "PageUp", "PageDown", "Shift", "Control", "Alt", "Meta", "Root",
              "Bearer", "SIGNED_IN", "INITIAL_SESSION", "USER_UPDATED"}
CLASS_TOKEN_RE = re.compile(r"[!-]?[a-z0-9][a-z0-9:\[\]()/.%_#,-]*")
CLASS_MARK_RE = re.compile(r"[a-z0-9][-:\[][a-z0-9\[(]")
HTML_TAG_RE = re.compile(r"(<[A-Za-z/][^>]*>)")
# A Supabase select list ('id, user_id, sessions!inner(user_id)') is code.
COLUMN_LIST_RE = re.compile(r"[\w!.*]+(?:\([^)]*\))?(?:\s*,\s*[\w!.*]+(?:\([^)]*\))?)+")
# A log tag ('[psy_kick] Supabase init failed') marks a developer string.
DEV_TAG_RE = re.compile(r"\[[\w/-]+\]")


def looks_like_classes(bare: str) -> bool:
    """A Tailwind or BEM class list ('bg-black/60 backdrop-blur-sm') is code."""
    tokens = bare.split()
    if len(tokens) < 2 or not all(CLASS_TOKEN_RE.fullmatch(t) for t in tokens):
        return False
    return 2 * sum(1 for t in tokens if CLASS_MARK_RE.search(t)) >= len(tokens)


def protected_spans(text: str) -> list[tuple[int, int]]:
    """console.*(...) calls: developer output, so their strings stay visible."""
    spans = []
    for m in re.finditer(r"\bconsole\.\w+\(", text):
        depth, i = 1, m.end()
        while i < len(text) and depth:
            sm = STRING_RE.match(text, i)
            if sm:
                i = sm.end()
                continue
            depth += {"(": 1, ")": -1}.get(text[i], 0)
            i += 1
        spans.append((m.start(), i))
    return spans


class Masker:
    """Blank out everything a copy edit may change, so what is left is code.

    `mask()` returns the collected copy segments; `masked` holds the masked
    text. `copy_bodies` are single-word literals the caller declared as copy.
    """

    def __init__(self, copy_bodies: set[str] | None = None) -> None:
        self.copy_bodies = copy_bodies or set()
        self.segments: list[str] = []
        self.masked = ""

    # -- strings ------------------------------------------------------------

    def is_copy(self, text: str, lit: str, before: str, output_ctx: bool) -> bool:
        body = lit[1:-1]
        if body in self.copy_bodies:
            return True
        bare = text.strip()
        if not re.search(r"[A-Za-z]", text):
            return False
        if looks_like_classes(bare) or COLUMN_LIST_RE.fullmatch(bare) or DEV_TAG_RE.match(bare):
            return False
        if bare.startswith(("/", "#", "~/", "http")) and " " not in bare:
            return False
        if " " in bare or "…" in text or "(" in bare:
            return True
        if re.fullmatch(r"[A-Z][a-z]+", bare) and bare not in CODE_WORDS:
            return True
        if COPY_KEY_RE.search(before):
            return True
        return output_ctx and bool(OUTPUT_CTX_RE.search(before))

    def mask_strings(self, text: str, output_ctx: bool = False) -> str:
        spans = protected_spans(text)

        def one(m: re.Match) -> str:
            lit = m.group(0)
            if lit.startswith("/") or any(a <= m.start() < b for a, b in spans):
                return lit
            quote, body = lit[0], lit[1:-1]
            words = re.sub(r"\$\{[^}]*\}", "", body) if quote == "`" else body
            if not self.is_copy(words, lit, text[max(0, m.start() - 60):m.start()], output_ctx):
                return lit
            exprs = "§".join(re.findall(r"\$\{[^}]*\}", body)) if quote == "`" else ""
            if HTML_TAG_RE.search(words):
                # Markup in a v-html string: its tags and classes are code.
                parts = HTML_TAG_RE.split(words)
                self.segments += [p for p in parts[::2] if re.search(r"[A-Za-z]", p)]
                masked = "".join(p if i % 2 else ("§" if re.search(r"[A-Za-z]", p) else p)
                                 for i, p in enumerate(parts))
                return quote + exprs + masked + quote
            self.segments.append(words)
            return quote + exprs + "§S§" + quote
        return STRING_RE.sub(one, text)

    # -- template -----------------------------------------------------------

    def mask_text_node(self, node: str) -> str:
        """Mask the words in a text node. Its {{ }} expressions are code, so
        they must survive in the same order; the words around them may move."""
        mustaches = re.findall(r"\{\{.*?\}\}", node, flags=re.S)
        masked = [self.mask_strings(mu, output_ctx=True) for mu in mustaches]
        words = re.sub(r"\{\{.*?\}\}", " ", node, flags=re.S)
        if not re.search(r"[A-Za-z]", words):
            it = iter(masked)
            return re.sub(r"\{\{.*?\}\}", lambda _: next(it), node, flags=re.S)
        self.segments.append(words)
        return "§T§" + "".join(masked)

    def mask_tag(self, tag: str) -> str:
        def bound(m: re.Match) -> str:
            name = re.sub(r"^(?::|v-bind:)", "", m.group(1))
            ctx = name in COPY_ATTRS
            return m.group(1) + '="' + self.mask_strings(m.group(2), output_ctx=ctx) + '"'

        def static(m: re.Match) -> str:
            if not re.search(r"[A-Za-z]", m.group(2)):
                return m.group(0)
            self.segments.append(m.group(2))
            return m.group(1) + '="§A§"'
        tag = BOUND_ATTR_RE.sub(bound, tag)
        return STATIC_ATTR_RE.sub(static, tag)

    def mask_template(self, block: str) -> str:
        out, i, n = [], 0, len(block)
        while i < n:
            if block.startswith("<!--", i):
                j = block.find("-->", i)
                j = n if j < 0 else j + 3
                out.append(block[i:j])  # comments are for developers: locked
                i = j
            elif block[i] == "<" and i + 1 < n and (block[i + 1].isalpha() or block[i + 1] == "/"):
                j, quote = i + 1, ""
                while j < n and (quote or block[j] != ">"):
                    if quote and block[j] == quote:
                        quote = ""
                    elif not quote and block[j] in "\"'":
                        quote = block[j]
                    j += 1
                out.append(self.mask_tag(block[i:j + 1]))
                i = j + 1
            else:
                j = i
                while j < n:
                    if block.startswith("{{", j):
                        k = block.find("}}", j)
                        j = n if k < 0 else k + 2
                        continue
                    if block[j] == "<" and j + 1 < n and (block[j + 1].isalpha() or block[j + 1] in "/!"):
                        break
                    j += 1
                out.append(self.mask_text_node(block[i:j]))
                i = j
        return "".join(out)

    # -- files --------------------------------------------------------------

    def mask(self, text: str, vue: bool) -> list[str]:
        if not vue:
            self.masked = self.mask_strings(text)
            return self.segments
        out = []
        # Top-level SFC blocks start in column 0; nested <template #slot> lines
        # are indented, so they stay inside their parent block.
        for block in re.split(r"(?=^<(?:template|script|style)\b)", text, flags=re.M):
            if block.startswith("<script"):
                out.append(self.mask_strings(block))
            elif block.startswith("<template"):
                out.append(self.mask_template(block))
            else:
                out.append(block)
        self.masked = "".join(out)
        return self.segments


def literal_bodies(text: str) -> Counter:
    return Counter(m.group(0)[1:-1] for m in STRING_RE.finditer(text) if not m.group(0).startswith("/"))


def cmd_check_code(page: Path, old: str, new: str, pairs: list[tuple[str, str]]) -> int:
    vue = page.suffix == ".vue"
    errors: list[str] = []
    warnings: list[str] = []
    old_lits, new_lits = literal_bodies(old), literal_bodies(new)
    for before, after in pairs:
        if not (old_lits[before] == 1 and old_lits[after] == 0 and new_lits[after] == 1 and new_lits[before] == 0):
            errors.append(f"--copy '{before}=>{after}' is ambiguous: the old literal must appear exactly once in "
                          f"the old file (found {old_lits[before]}) and the new one exactly once in the new file "
                          f"(found {new_lits[after]}), with neither left over. A literal used more than once may "
                          "also be a status code or key; rename it by hand only if every use is copy.")
    bodies = {b for pair in pairs for b in pair}
    if vue:
        styles = lambda t: re.findall(r"^<style\b.*?^</style>", t, re.S | re.M)
        if styles(old) != styles(new):
            errors.append("<style> changed; only user-facing text may change")
    om, nm = Masker(bodies), Masker(bodies)
    old_copy, new_copy = om.mask(old, vue), nm.mask(new, vue)
    old_code, new_code = om.masked.splitlines(), nm.masked.splitlines()
    if old_code != new_code:
        diff = [l for l in difflib.unified_diff(old_code, new_code, lineterm="", n=0)
                if l.startswith(("+", "-")) and not l.startswith(("+++", "---"))]
        errors.append("code changed outside the copy (only user-facing text may change; § marks masked copy):"
                      + "".join(f"\n    {l}" for l in diff[:20]))
    compare_facts("\n".join(old_copy), "\n".join(new_copy), False, errors, warnings)
    if vue:
        lost = Counter(t for _, t in EM_RE.findall(old)) - Counter(t for _, t in EM_RE.findall(new))
        lost = Counter({k: v for k, v in lost.items() if not mentions(new, k)})
        if lost:
            warnings.append(f"emphasised text no longer present: {show(lost)}")
    return report(errors, warnings, f"now run the typecheck: {VERIFY_HINT}")


# -------------------------------------------------------------- markdown ---

def split_markdown(text: str) -> tuple[str, list[str], str]:
    """Return (frontmatter, locked lines, editable prose). Locked lines must
    survive byte for byte and in order: headings, code fences and their
    contents, table separator rows and HTML comments."""
    frontmatter = ""
    m = re.match(r"\A---\n.*?\n---\n", text, re.DOTALL)
    if m:
        frontmatter, text = m.group(0), text[m.end():]
    locked: list[str] = []
    prose: list[str] = []
    in_code = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(("```", "~~~")):
            in_code = not in_code
            locked.append(line)
        elif in_code or stripped.startswith(("#", "<!--")) or re.match(r"^\|?\s*:?-{3,}", stripped):
            locked.append(line)
        else:
            prose.append(line)
    return frontmatter, locked, "\n".join(prose)


def cmd_check_markdown(old: str, new: str) -> int:
    old_fm, old_locked, old_prose = split_markdown(old)
    new_fm, new_locked, new_prose = split_markdown(new)
    errors: list[str] = []
    warnings: list[str] = []
    if old_fm != new_fm:
        errors.append("frontmatter changed; it must stay byte for byte")
    if old_locked != new_locked:
        lost = [l for l in old_locked if l not in new_locked]
        added = [l for l in new_locked if l not in old_locked]
        detail = "".join(f"\n    - {l}" for l in lost[:10]) + "".join(f"\n    + {l}" for l in added[:10])
        errors.append("headings, code blocks or table structure changed:" + (detail or " order differs"))
    compare_facts(old_prose, new_prose, True, errors, warnings)
    return report(errors, warnings, "")


def report(errors: list[str], warnings: list[str], hint: str) -> int:
    for w in warnings:
        print(f"WARNING {w}")
    for e in errors:
        print(f"ERROR {e}")
    if errors:
        return 1
    notes = [n for n in ("review the warnings above" if warnings else "", hint) if n]
    print("ok" + (f" ({'; '.join(notes)})" if notes else ""))
    return 0


def cmd_check(page: Path, pairs: list[tuple[str, str]]) -> int:
    try:
        old = subprocess.run(["git", "show", f"HEAD:{rel(page)}"], cwd=ROOT, check=True,
                             capture_output=True, text=True).stdout
    except subprocess.CalledProcessError:
        print(f"{rel(page)} is not in HEAD; commit it before humanizing.")
        return 1
    new = page.read_text(encoding="utf-8")
    if old == new:
        print("unchanged")
        return 0
    if page.suffix in (".vue", ".ts"):
        return cmd_check_code(page, old, new, pairs)
    if page.suffix == ".md":
        return cmd_check_markdown(old, new)
    print(f"no check defined for {page.suffix} files")
    return 2


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in {"next", "status", "check", "record"}:
        print(__doc__)
        return 2
    cmd, args = argv[1], argv[2:]
    if cmd in ("next", "status"):
        group = None
        if args[:1] == ["--group"] and len(args) == 2 and args[1] in GROUPS:
            group = args[1]
        elif args:
            print(f"usage: {argv[0]} {cmd} [--group {'|'.join(GROUPS)}]")
            return 2
        return cmd_next(group) if cmd == "next" else cmd_status(group)
    if not args:
        print(f"usage: {argv[0]} {cmd} PATH" + (" [--copy 'OLD=>NEW' ...]" if cmd == "check" else ""))
        return 2
    page = (ROOT / args[0]).resolve()
    if not page.is_file():
        print(f"no such file: {args[0]}")
        return 2
    if cmd == "record":
        if len(args) != 1:
            print(f"usage: {argv[0]} record PATH")
            return 2
        return cmd_record(page)
    pairs: list[tuple[str, str]] = []
    rest = args[1:]
    while rest:
        if rest[0] != "--copy" or len(rest) < 2 or "=>" not in rest[1]:
            print(f"usage: {argv[0]} check PATH [--copy 'OLD=>NEW' ...]")
            return 2
        before, after = rest[1].split("=>", 1)
        pairs.append((before, after))
        rest = rest[2:]
    return cmd_check(page, pairs)


if __name__ == "__main__":
    sys.exit(main(sys.argv))

"""Count a Claude Code year from local transcripts (projects/**/*.jsonl) into the stats JSON that render.py reads.

python -I wrapped_stats.py [--root DIR ...] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--out FILE]
python -I wrapped_stats.py --selftest

Rules: a prompt is a typed user line (not a subagent's, not meta, no tool_result, not a <command>
wrapper). One API response is logged as several lines sharing message.id and usage, so tokens and
models count once per message.id, and tool calls once per tool_use id. A session is "automated"
when its entrypoint starts with "sdk" (headless or scheduled `claude -p`). Times are local.
latest_prompt is the latest time of night (04:38 beats 23:10; before 05:00 counts as after midnight), on any date.
Stdlib only; reads transcripts, never writes to them.
"""
import argparse
import collections
import datetime as dt
import json
import os
import pathlib
import re
import sys
import tempfile

WANT = (b'"assistant"', b'"user"', b'"pr-link"', b'"ai-title"', b'"custom-title"')
FIRSTS = ("mcp", "plan_mode", "subagent", "skill", "commit", "pull_request", "worktree")
EDIT_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
WORKTREE = re.compile(r"/\.claude/worktrees/.*$", re.I)
STOP = set("""the and for you that this with are was but not have from can what all its it's i'm
don't dont just get let lets let's out use see now one two how why when then them they their there
here into also any our your yours will would should could has had been more some than make made
want need like please yes okay thanks thank also about over only very each which who into via let
via new add run sure what's can't i'll it'll that's there's ive i've youre you're its doesnt isnt""".split())
NOVEL_TOKENS = 120_000  # shortcut: ~90k-word novel at ~1.33 tokens a word; good enough for a labelled estimate


def roots_from(extra):
    cands = [pathlib.Path(r) for r in extra] or [
        *([pathlib.Path(os.environ["CLAUDE_CONFIG_DIR"]) / "projects"] if os.environ.get("CLAUDE_CONFIG_DIR") else []),
        pathlib.Path.home() / ".claude" / "projects"]
    out = []
    for c in cands:
        if c.is_dir() and c.resolve() not in [o.resolve() for o in out]:
            out.append(c)
    return out


def local(ts):
    try:
        return dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00")).astimezone()
    except ValueError:
        return None


def project(cwd):
    p = WORKTREE.sub("", str(cwd or "").replace("\\", "/")).rstrip("/")
    return p.rsplit("/", 1)[-1] or p or "unknown"


def prompt_text(msg):
    c = msg.get("content") if isinstance(msg, dict) else None
    if isinstance(c, str):
        text = c
    elif isinstance(c, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in c):
            return None
        text = " ".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")
    else:
        return None
    text = text.strip()
    return text if text and not text.startswith("<") else None


def collect(roots, since=None, until=None, ignore=None):
    seen_u, seen_m, seen_t, prs = set(), set(), set(), set()
    C = collections.Counter
    day_tok, day_pr, mon_tok, mon_pr, tools, models, proj, words, edits = C(), C(), C(), C(), C(), C(), C(), C(), C()
    hours = [0] * 24
    sess = {}
    titles, custom = {}, {}
    firsts = {}
    latest = None
    out_tok = total = files = unread = 0

    def first(key, when):
        d = when.date().isoformat()
        if key not in firsts or d < firsts[key]:
            firsts[key] = d

    for root in roots:
        for f in root.rglob("*.jsonl"):
            files += 1
            try:
                fh = open(f, "rb")
            except OSError:  # e.g. a Windows path past 260 characters
                unread += 1
                continue
            with fh:
                for raw in fh:
                    if not any(w in raw for w in WANT):
                        continue
                    try:
                        d = json.loads(raw)
                    except ValueError:
                        continue
                    if not isinstance(d, dict):
                        continue
                    t, sid = d.get("type"), d.get("sessionId")
                    if t == "ai-title":
                        titles[sid] = d.get("aiTitle")
                        continue
                    if t == "custom-title":
                        custom[sid] = d.get("customTitle")
                        continue
                    when = local(d.get("timestamp"))
                    if not when or (since and when.date() < since) or (until and when.date() > until):
                        continue
                    day, mon = when.date().isoformat(), when.strftime("%Y-%m")
                    if t == "pr-link":
                        if d.get("prUrl") and d["prUrl"] not in prs:
                            prs.add(d["prUrl"])
                            first("pull_request", when)
                        continue
                    msg = d.get("message") if isinstance(d.get("message"), dict) else {}
                    s = sess.setdefault(sid, {"start": when, "end": when, "tok": 0, "entry": d.get("entrypoint"), "cwd": d.get("cwd")})
                    if when < s["start"]:
                        s["start"], s["entry"] = when, d.get("entrypoint")
                    s["end"] = max(s["end"], when)
                    if t == "user":
                        if d.get("isSidechain") or d.get("isMeta") or d.get("uuid") in seen_u:
                            continue
                        seen_u.add(d.get("uuid"))
                        text = prompt_text(msg)
                        if not text:
                            continue
                        day_pr[day] += 1
                        mon_pr[mon] += 1
                        hours[when.hour] += 1
                        typed = re.sub(r"https?://\S+|\S+@\S+|\S+\.\w{2,4}\b", " ", text.lower())
                        if len(typed) <= 280 and not (ignore and ignore.search(text)):  # longer is mostly pasted text, not words the person typed
                            words.update(w for w in re.findall(r"[a-z][a-z']+", typed) if len(w) >= 3 and w not in STOP)
                        # "Latest night" spotlight: the latest clock time anyone was still prompting, on any date
                        # (before 05:00 counts as after midnight), not the newest timestamp of the year
                        night = ((when.hour + 24) if when.hour < 5 else when.hour) * 3600 + when.minute * 60 + when.second
                        if latest is None or night > latest[0]:
                            latest = (night, when)
                        continue
                    if t != "assistant":
                        continue
                    for b in msg.get("content") or []:
                        if not isinstance(b, dict) or b.get("type") != "tool_use" or b.get("id") in seen_t:
                            continue
                        seen_t.add(b.get("id"))
                        name, inp = str(b.get("name")), b.get("input") if isinstance(b.get("input"), dict) else {}
                        tools[name] += 1
                        cmd = str(inp.get("command", ""))
                        if name.startswith("mcp__"):
                            first("mcp", when)
                        if name == "ExitPlanMode":
                            first("plan_mode", when)
                        if name in ("Task", "Agent"):
                            first("subagent", when)
                        if name == "Skill":
                            first("skill", when)
                        if name == "Bash" and re.search(r"\bgit\s+commit\b", cmd):
                            first("commit", when)
                        if name == "EnterWorktree" or (name == "Bash" and "git worktree add" in cmd):
                            first("worktree", when)
                        if name in EDIT_TOOLS:
                            path = inp.get("file_path") or inp.get("notebook_path")
                            if path:
                                edits[re.split(r"[\\/]", str(path))[-1]] += 1
                    mid, u = msg.get("id"), msg.get("usage")
                    if not mid or mid in seen_m or not isinstance(u, dict) or msg.get("model") == "<synthetic>":
                        continue
                    seen_m.add(mid)
                    n = sum(int(u.get(k) or 0) for k in ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"))
                    total += n
                    out_tok += int(u.get("output_tokens") or 0)
                    day_tok[day] += n
                    mon_tok[mon] += n
                    models[msg.get("model") or "unknown"] += 1
                    proj[project(d.get("cwd"))] += n
                    s["tok"] += n
    print(f"read {files - unread} transcript files" + (f", {unread} unreadable (skipped)" if unread else ""), file=sys.stderr)
    return locals()


def streak(days):
    best, run, end, prev = 0, 0, None, None
    for d in sorted(dt.date.fromisoformat(x) for x in days):
        run = run + 1 if prev and (d - prev).days == 1 else 1
        if run > best:
            best, end = run, d
        prev = d
    return {"days": best, "end": end.isoformat()} if best else None


def build(c):
    sess = c["sess"]
    title = {**c["titles"], **{k: v for k, v in c["custom"].items() if v}}
    name = lambda sid: title.get(sid) or project(sess[sid]["cwd"])  # noqa: E731
    days = sorted(set(c["day_tok"]) | set(c["day_pr"]))
    months = sorted(set(c["mon_tok"]) | set(c["mon_pr"]))
    words = [w for w, _ in c["words"].most_common(3)]
    tw = collections.Counter(w for t in title.values() if t for w in re.findall(r"[a-z]+", t.lower()) if len(w) >= 3 and w not in STOP)
    edits = c["edits"].most_common(2)
    prompts = sum(c["day_pr"].values())
    growth = None
    ok = [m for m in months if c["mon_pr"][m] >= 20]
    if len(ok) >= 2 and c["mon_tok"][ok[0]]:
        a, z = c["mon_tok"][ok[0]] / c["mon_pr"][ok[0]], c["mon_tok"][ok[-1]] / c["mon_pr"][ok[-1]]
        growth = round(z / a, 1) if a and z > a else None  # the page says "more work per prompt": only when true
    long_sid = max(sess, key=lambda k: sess[k]["end"] - sess[k]["start"], default=None)
    big_sid = max(sess, key=lambda k: sess[k]["tok"], default=None)
    busy = max(c["day_tok"], key=c["day_tok"].get, default=None)
    lp = c["latest"]
    top3 = c["proj"].most_common(3)
    return {
        "range": {"start": days[0], "end": days[-1]} if days else None,
        "first_session": days[0] if days else None,
        "sessions": len(sess),
        "automated_sessions": sum(1 for v in sess.values() if str(v["entry"] or "").startswith("sdk")),
        "prompts": prompts,
        "tokens_total": c["total"],
        "output_tokens": c["out_tok"],
        "months": [{"month": m, "tokens": c["mon_tok"][m], "prompts": c["mon_pr"][m]} for m in months],
        "busiest_day": {"date": busy, "tokens": c["day_tok"][busy], "prompts": c["day_pr"][busy]} if busy else None,
        "streak": streak(c["day_pr"]),
        "hours": c["hours"],
        "tools": [{"name": k, "calls": v} for k, v in c["tools"].most_common(5)],
        "models": [{"name": k, "requests": v} for k, v in c["models"].most_common(3)],
        "projects": [{"name": k, "tokens": v} for k, v in top3],
        "projects_share": round(sum(v for _, v in top3) / c["total"], 2) if c["total"] else None,
        "title_words": [{"word": k, "count": v} for k, v in tw.most_common(8)],
        "top_word": {"word": words[0], "count": c["words"][words[0]],
                     "runners": [{"word": w, "count": c["words"][w]} for w in words[1:]]} if words else None,
        "latest_prompt": {"date": lp[1].date().isoformat(), "time": lp[1].strftime("%I:%M %p").lstrip("0")} if lp else None,
        "longest_session": {"hours": round((sess[long_sid]["end"] - sess[long_sid]["start"]).total_seconds() / 3600, 1),
                            "title": name(long_sid)} if long_sid else None,
        "biggest_session": {"tokens": sess[big_sid]["tok"], "title": name(big_sid)} if big_sid and sess[big_sid]["tok"] else None,
        "most_edited_file": {"name": edits[0][0], "edits": edits[0][1],
                             "runner": {"name": edits[1][0], "edits": edits[1][1]} if len(edits) > 1 else None} if edits else None,
        "pull_requests": len(c["prs"]),
        "firsts": {k: c["firsts"].get(k) for k in FIRSTS},
        "work_per_prompt_growth": growth,
        "novels": c["out_tok"] // NOVEL_TOKENS,
    }


def selftest():
    tmp = pathlib.Path(tempfile.mkdtemp())
    rows = []
    for i, day in enumerate(("2026-03-01", "2026-03-02", "2026-03-03")):
        ts = f"{day}T18:00:00Z"
        rows += [
            {"type": "user", "uuid": f"u{i}", "sessionId": "s1", "timestamp": ts, "cwd": "/w/demo/.claude/worktrees/x", "entrypoint": "cli",
             "message": {"content": "merge the thing"}},
            {"type": "user", "uuid": f"r{i}", "sessionId": "s1", "timestamp": ts, "message": {"content": [{"type": "tool_result"}]}},
            {"type": "user", "uuid": f"c{i}", "sessionId": "s1", "timestamp": ts, "message": {"content": "<command-name>/x</command-name>"}},
        ]
        for part in (0, 1):  # one response split over two lines: usage must count once
            rows.append({"type": "assistant", "sessionId": "s1", "timestamp": ts, "cwd": "/w/demo",
                         "message": {"id": f"m{i}", "model": "claude-opus-5-5",
                                     "usage": {"input_tokens": 10, "output_tokens": 60, "cache_read_input_tokens": 0},
                                     "content": [{"type": "tool_use", "id": f"t{i}{part}", "name": "Edit", "input": {"file_path": "/a/b/index.html"}}]}})
    rows += [{"type": "pr-link", "sessionId": "s1", "timestamp": "2026-03-02T18:00:00Z", "prUrl": "https://x/pr/1"},
             {"type": "ai-title", "sessionId": "s1", "aiTitle": "ship demo board"}]
    for r in ("a", "b"):  # the same file under two roots counts once
        p = tmp / r / "proj"
        p.mkdir(parents=True)
        (p / "s1.jsonl").write_text("\n".join(json.dumps(x) for x in rows) + "\nnot json\n", encoding="utf-8")
    s = build(collect([tmp / "a", tmp / "b"]))
    assert s["prompts"] == 3, s["prompts"]
    assert s["tokens_total"] == 210 and s["output_tokens"] == 180, s["tokens_total"]
    assert s["streak"]["days"] == 3 and s["pull_requests"] == 1
    assert s["projects"] == [{"name": "demo", "tokens": 210}], s["projects"]
    assert s["top_word"]["word"] == "merge" and s["most_edited_file"]["edits"] == 6
    assert s["firsts"]["pull_request"] and s["title_words"][0]["word"] in ("ship", "demo", "board")
    assert len(s["hours"]) == 24 and set(s["firsts"]) == set(FIRSTS)
    print("stats selftest PASS")


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", action="append", default=[])
    ap.add_argument("--since", type=dt.date.fromisoformat)
    ap.add_argument("--until", type=dt.date.fromisoformat)
    ap.add_argument("--out")
    ap.add_argument("--ignore-prompt", action="append", default=[], metavar="REGEX",
                    help="leave prompts matching this out of the word count (hook-injected text); repeatable")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    ignore = re.compile("|".join(f"(?:{r})" for r in a.ignore_prompt), re.I) if a.ignore_prompt else None
    if a.selftest:
        selftest()
        return 0
    roots = roots_from(a.root)
    if not roots:
        ap.error("no projects folder found; pass --root <dir>/projects")
    text = json.dumps(build(collect(roots, a.since, a.until, ignore)), indent=1, ensure_ascii=False)
    if a.out:
        pathlib.Path(a.out).write_text(text, encoding="utf-8")
        print(f"wrote {a.out}", file=sys.stderr)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

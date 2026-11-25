"""Count my own commits and code lines across all my repositories (incl. private).

Writes stats.md (tables) and stats.json (headline totals); index.js puts both into README.md.
Only totals are written or logged; private repository names never appear anywhere.

Usage (Action):  GH_TOKEN=... python3 stats.py --out stats.md
Usage (local):   GH_TOKEN=$(gh auth token) python3 stats.py --out stats.md --cache /some/dir
"""
import argparse, base64, hashlib, collections, datetime as dt, json, os, re, subprocess, sys, tempfile, urllib.request

OWNER = "7ihin"

# Commit e-mails that are me, as sha256 (first 16 hex) so the addresses stay out of this
# public file. Bots and agents (README Action, my agent accounts, Claude co-author commits)
# are not in the list, so their commits are not counted.
MY_EMAIL_HASHES = {
    "a3197ca9d792f6f3", "cebc4e3bfb8464a6", "96ad5e6bd6b24b8a",
    "854981083f760cde", "bebd0980c6880034", "c081160ffa82fad4",
}


def is_me(email):
    return hashlib.sha256(email.lower().encode()).hexdigest()[:16] in MY_EMAIL_HASHES

LANG = {
    ".py": "Python", ".ts": "TypeScript", ".tsx": "TypeScript", ".mts": "TypeScript",
    ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".java": "Java", ".kt": "Kotlin", ".swift": "Swift",
    ".c": "C/C++", ".h": "C/C++", ".cpp": "C/C++", ".cc": "C/C++", ".cxx": "C/C++", ".hpp": "C/C++",
    ".hh": "C/C++", ".ino": "C/C++", ".cu": "CUDA", ".cuh": "CUDA", ".rs": "Rust", ".go": "Go", ".lua": "Lua", ".m": "MATLAB",
    ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
    ".html": "HTML", ".css": "CSS", ".scss": "CSS",
}
# Folders and files that are generated, copied in, or data rather than code
# (content/ = blog post bodies). SQL (seed data) and TeX (paper text) are not counted at all.
SKIP = re.compile(
    r"(^|/)(node_modules|vendor|third_party|external|dist|build|\.venv|venv|site-packages|__pycache__"
    r"|fixtures?|snapshots?|meta|results|logs|content)/"
    r"|\.min\.(js|css)$|\.(lock)$|-lock\.json$"
)
TOP_LANGS = 8


def api(path, token):
    out, url = [], f"https://api.github.com{path}"
    while url:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}",
                                                   "Accept": "application/vnd.github+json"})
        with urllib.request.urlopen(req) as r:
            out += json.load(r)
            m = re.search(r'<([^>]+)>; rel="next"', r.headers.get("Link", ""))
            url = m.group(1) if m else None
    return out


def git(path, *args, stdin=None, env=None):
    return subprocess.run(["git", "-C", path, *args], input=stdin, capture_output=True, text=True,
                          check=True, env=env).stdout


def auth_env(token):
    # Token goes to git through the environment, so it reaches lazy fetches too and is never
    # written into a URL or a config file.
    auth = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    return os.environ | {"GIT_CONFIG_COUNT": "1",
                         "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
                         "GIT_CONFIG_VALUE_0": f"AUTHORIZATION: basic {auth}"}


def fetch(repo, env, cache):
    path = os.path.abspath(os.path.join(cache, repo["name"] + ".git"))
    url = f"https://github.com/{repo['full_name']}.git"
    if os.path.isdir(path):
        git(path, "fetch", "-q", "--prune", "origin", "+refs/heads/*:refs/heads/*", env=env)
    else:
        # History only; file contents are fetched later just for my own commits.
        git(cache, "clone", "-q", "--bare", "--filter=blob:none", url, path, env=env)
    return path


CODE = [f"*{ext}" for ext in LANG]  # pathspec: only code files are diffed


def my_code_numstat(path, shas, env):
    """numstat of my commits, code files only. Fetches the needed file versions in one request."""
    shas_in = "\n".join(shas) + "\n"
    raw = git(path, "log", "--no-walk=unsorted", "--stdin", "--no-renames", "--raw", "--no-abbrev",
              "--format=", "--", *CODE, stdin=shas_in, env=env)
    want = set()
    for line in raw.splitlines():
        if not line.startswith(":"):
            continue
        meta, f = line.split("\t", 1)
        if SKIP.search(f):
            continue
        for oid in meta.split()[2:4]:
            if set(oid) != {"0"}:
                want.add(oid)
    if want:
        git(path, "-c", "fetch.negotiationAlgorithm=noop", "fetch", "-q", "--no-tags", "--no-write-fetch-head",
            "--recurse-submodules=no", "--filter=blob:none", "--stdin", "origin",
            stdin="\n".join(sorted(want)) + "\n", env=env)
    return git(path, "log", "--no-walk=unsorted", "--stdin", "--no-renames", "--numstat",
               "--format=@@%H\t%ad", "--date=short", "--", *CODE, stdin=shas_in, env=env)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="stats.md")
    ap.add_argument("--json", default="stats.json", help="totals for the README headline")
    ap.add_argument("--cache", default=None)
    a = ap.parse_args()
    token = os.environ["GH_TOKEN"]
    cache = a.cache or tempfile.mkdtemp()
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()  # KST

    repos = [r for r in api("/user/repos?affiliation=owner&per_page=100", token)
             if r["owner"]["login"] == OWNER and not r["fork"]]

    seen = set()
    by_year = collections.defaultdict(lambda: {"commits": 0, "days": set(), "repos": set(), "add": 0, "del": 0})
    by_month = collections.Counter()
    lang_add, lang_del, lang_repos = collections.Counter(), collections.Counter(), collections.defaultdict(set)
    touched, private_touched, failed = set(), set(), 0

    env = auth_env(token)
    for repo in repos:
        try:
            path = fetch(repo, env, cache)
            mine = []
            for line in git(path, "log", "--all", "--no-merges", "--format=%H\t%ae\t%ad", "--date=short").splitlines():
                sha, email, day = line.split("\t")
                if is_me(email) and sha not in seen:
                    seen.add(sha)
                    mine.append((sha, dt.date.fromisoformat(day)))
            if not mine:
                continue
            numstat = my_code_numstat(path, [m[0] for m in mine], env)
        except subprocess.CalledProcessError as e:
            # Logs of a public repository are public: git's error text names the repository,
            # so only the exit code is printed.
            failed += 1
            print(f"one repository failed (git exit {e.returncode})", file=sys.stderr)
            continue

        touched.add(repo["name"])
        if repo["private"]:
            private_touched.add(repo["name"])
        for _, d in mine:
            for k in (str(d.year), "total"):
                y = by_year[k]
                y["commits"] += 1; y["days"].add(d); y["repos"].add(repo["name"])
            by_month[f"{d:%Y-%m}"] += 1

        keys = []
        for line in numstat.splitlines():
            if line.startswith("@@"):
                keys = [line.split("\t")[1][:4], "total"]
                continue
            if not line.strip():
                continue
            add, rem, f = line.split("\t", 2)
            lang = LANG.get(os.path.splitext(f)[1].lower())
            if add == "-" or lang is None or SKIP.search(f):
                continue
            add, rem = int(add), int(rem)
            lang_add[lang] += add; lang_del[lang] += rem; lang_repos[lang].add(repo["name"])
            for k in keys:
                by_year[k]["add"] += add; by_year[k]["del"] += rem

    if failed or not touched:
        # Never publish partial numbers; the README keeps the last good stats.md.
        sys.exit(f"stopped: {failed} of {len(repos)} repositories failed")

    n = lambda x: f"{x:,}"
    years = sorted(k for k in by_year if k != "total")
    cols = years + ["total"]
    head = years + ["Total"]
    L = []
    L.append("| | " + " | ".join(head) + " |")
    L.append("|:--|" + "--:|" * len(cols))
    rows = [("Commits", lambda y: n(y["commits"])),
            ("Days with a commit", lambda y: n(len(y["days"]))),
            ("Repositories", lambda y: n(len(y["repos"]))),
            ("Code lines added", lambda y: n(y["add"])),
            ("Code lines deleted", lambda y: n(y["del"]))]
    for name, f in rows:
        L.append(f"| {name} | " + " | ".join(f(by_year[c]) for c in cols) + " |")
    L.append("")

    months = []
    y, m = today.year, today.month
    for _ in range(12):
        months.append(f"{y:04d}-{m:02d}")
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    months.reverse()
    L.append("**Commits per month**")
    L.append("")
    L.append("| " + " | ".join(dt.date.fromisoformat(x + "-01").strftime("%b<br>%y") for x in months) + " |")
    L.append("|" + "--:|" * len(months))
    L.append("| " + " | ".join(n(by_month[x]) for x in months) + " |")
    L.append("")

    total = sum(lang_add.values()) or 1
    L.append("**Code by language**")
    L.append("")
    L.append("| Language | Lines added | Lines deleted | Share | Repositories |")
    L.append("|:--|--:|--:|--:|--:|")
    langs = [k for k, _ in lang_add.most_common()]
    for k in langs[:TOP_LANGS]:
        L.append(f"| {k} | {n(lang_add[k])} | {n(lang_del[k])} | {100 * lang_add[k] / total:.1f} % | {len(lang_repos[k])} |")
    rest = langs[TOP_LANGS:]
    if rest:
        ra, rd = sum(lang_add[k] for k in rest), sum(lang_del[k] for k in rest)
        rr = set().union(*(lang_repos[k] for k in rest))
        L.append(f"| Other ({', '.join(rest)}) | {n(ra)} | {n(rd)} | {100 * ra / total:.1f} % | {len(rr)} |")

    t = by_year["total"]
    top = langs[0] if langs else ""
    if os.path.exists(a.json):
        # A token that lost access to private repositories would make the numbers shrink
        # without any error. Refuse a sudden drop; delete stats.json to accept one on purpose.
        before = json.load(open(a.json, encoding="utf-8")).get("commits", 0)
        if t["commits"] < 0.9 * before:
            sys.exit(f"stopped: commits fell from {before} to {t['commits']}")
    with open(a.json, "w", encoding="utf-8") as fh:
        json.dump({"updated": f"{today:%Y-%m-%d}", "commits": t["commits"], "days": len(t["days"]),
                   "repos": len(touched), "private": len(private_touched), "added": t["add"], "deleted": t["del"],
                   "first": f"{min(t['days']):%Y-%m}", "top_lang": top,
                   "top_share": round(100 * lang_add[top] / total, 1) if top else 0}, fh, indent=1)
    with open(a.out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
    print(f"repos listed {len(repos)}, with my commits {len(touched)}, failed {failed}, "
          f"commits {len(seen)}", file=sys.stderr)


if __name__ == "__main__":
    main()

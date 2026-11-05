#!/usr/bin/env python3
"""Build the static Course Learning Atlas from one explicit resource manifest."""
import argparse
import hashlib
import json
import html
import re
import shutil
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path, PurePosixPath
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parent
DEMO = ROOT / "examples/networking/course.json"
SOURCE = ROOT / "src"
MARKER = ".atlas-build"
ALL_TOPICS = "全部主題"
AREAS = {"study", "assignments"}
FILE_TYPES = set(".pdf .pptx .md .html .htm .css .js .mjs .json .txt .csv .ipynb .svg .png .jpg .jpeg .webp .gif .mp4 .webm .vtt .zip .py".split())
DEFAULT_KINDS = {
    "answers": "講義解答", "interactive": "互動圖", "lecture": "課堂講義",
    "notes": "學習筆記", "diagram": "圖解教材", "assignment": "作業與習題",
    "data": "數據與重現", "reference": "參考資料",
}
DEFAULT_THEME = {"accent": "#147d6e", "ink": "#183e3a", "paper": "#fafaf5", "highlight": "#c56b44"}


def text(value, field):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")
    return value.strip()


def slug(value, field):
    value = text(value, field)
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError(f"{field} must use lowercase letters, digits and single hyphens")
    return value


def strings(value, field):
    if not isinstance(value, list):
        raise ValueError(f"{field} must be a list")
    return [text(item, field) for item in value]


def material_path(root, name):
    name = text(name, "asset path")
    path = PurePosixPath(name)
    if (path.is_absolute() or "\\" in name or not path.parts or path.parts[0] == "atlas-previews"
            or any(part.startswith(".") for part in path.parts)):
        raise ValueError(f"Expected a visible, relative material path: {name}")
    file = (root / path).resolve()
    if not file.is_relative_to(root) or not file.is_file():
        raise ValueError(f"Material is missing or outside the material folder: {name}")
    if path.suffix.lower() not in FILE_TYPES:
        raise ValueError(f"Unsupported material extension: {name}")
    return path, file


def copy_material(root, target, name):
    relative, source = material_path(root, name)
    destination = target / "resources" / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copy2(source, destination)
    return relative, destination, "resources/" + quote(relative.as_posix(), safe="/")


def convert_deck(source, target):
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="atlas-impress-") as directory:
        temporary = Path(directory)
        subprocess.run([
            "soffice", "-env:UserInstallation=" + (temporary / "profile").as_uri(),
            "--headless", "--convert-to", "pdf", "--outdir", directory, str(source),
        ], check=True)
        converted = temporary / (source.stem + ".pdf")
        if not converted.is_file():
            raise ValueError(f"Could not render PowerPoint: {source.name}")
        shutil.move(converted, target)


def file_record(entry, materials, target, convert):
    name = entry["path"] if isinstance(entry, dict) else entry
    path, destination, url = copy_material(materials, target, name)
    record = {"label": path.suffix[1:].upper(), "url": url, "bytes": destination.stat().st_size}
    supplied = entry.get("preview") if isinstance(entry, dict) else None
    if supplied:
        if record["label"] != "PPTX" or PurePosixPath(supplied).suffix.lower() != ".pdf":
            raise ValueError(f"A supplied preview must be a PDF for a PPTX: {name}")
        record["preview"] = copy_material(materials, target, supplied)[2]
    elif convert and record["label"] == "PPTX":
        source = material_path(materials, name)[1]
        key = hashlib.sha256(source.read_bytes()).hexdigest()[:20] + ".pdf"
        relative = Path("resources/atlas-previews") / key
        convert_deck(source, target / relative)
        record["preview"] = relative.as_posix()
    return path.as_posix(), record


def read_catalog(config, materials, target, convert=False):
    data = json.loads(config.read_text(encoding="utf-8"))
    course = data["course"]
    settings = {
        "id": slug(course["id"], "course.id"),
        "code": text(course["code"], "course.code"),
        "title": text(course["title"], "course.title"),
        "description": text(course.get("description", "集中閱讀與複習課程資料。"), "course.description"),
        "studyLabel": text(course.get("study_label", "學習教材"), "course.study_label"),
        "assignmentsLabel": text(course.get("assignments_label", "作業與習題"), "course.assignments_label"),
    }
    if course.get("updated"):
        settings["updated"] = text(course["updated"], "course.updated")

    topics = strings(data.get("topics", []), "topics")
    if len(set(topics)) != len(topics) or ALL_TOPICS in topics:
        raise ValueError("Topics must be unique and cannot reuse the all-topics label")
    kinds = dict(DEFAULT_KINDS)
    for key, label in data.get("kinds", {}).items():
        kinds[slug(key, "kind ID")] = text(label, "kind label")
    theme = dict(DEFAULT_THEME)
    for key, color in data.get("theme", {}).items():
        if key not in theme or not re.fullmatch(r"#[0-9a-fA-F]{6}", str(color)):
            raise ValueError(f"Expected a six-digit hex color for a supported theme field: {key}")
        theme[key] = color

    resources = []
    used_ids = set()
    for item in data.get("resources", []):
        rid = slug(item["id"], "resource.id")
        kind = slug(item["kind"], f"{rid}.kind")
        labels = strings(item.get("topics", []), f"{rid}.topics")
        area = item.get("area", "study")
        if rid in used_ids or kind not in kinds or area not in AREAS or any(label not in topics for label in labels):
            raise ValueError(f"Duplicate ID, unknown kind/topic, or invalid area: {rid}")
        used_ids.add(rid)
        pairs = [file_record(entry, materials, target, convert) for entry in item.get("files", [])]
        for asset in strings(item.get("assets", []), f"{rid}.assets"):
            copy_material(materials, target, asset)
        external = item.get("external")
        if external:
            url = urlsplit(external)
            if url.scheme != "https" or not url.hostname or url.username or url.password:
                raise ValueError(f"External links must use HTTPS without credentials: {rid}")
        if not pairs and not external:
            raise ValueError(f"Provide a file or an external URL for {rid}")
        record = {
            "id": rid, "title": text(item["title"], f"{rid}.title"), "description": item.get("description", ""),
            "area": area, "kindId": kind, "kind": kinds[kind], "topics": labels,
            "topic": labels[0] if labels else "", "source": [path for path, _ in pairs],
            "files": [file for _, file in pairs],
            "keywords": strings(item.get("keywords", []), f"{rid}.keywords"),
            "synthetic": bool(item.get("synthetic")), "historical": bool(item.get("historical")),
        }
        if item.get("thumbnail"):
            thumbnail = item["thumbnail"]
            if PurePosixPath(thumbnail).suffix.lower() not in {".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"}:
                raise ValueError(f"Expected an image thumbnail: {rid}")
            record["preview"] = copy_material(materials, target, thumbnail)[2]
        if external:
            record["external"] = external
        resources.append(record)
    return {"course": settings, "topics": [ALL_TOPICS, *topics], "kinds": kinds, "resources": resources}, theme


def fingerprint(*inputs):
    digest = hashlib.sha256()
    for path in inputs:
        files = sorted(item for item in path.rglob("*") if item.is_file()) if path.is_dir() else [path]
        for file in files:
            name = file.relative_to(path).as_posix() if path.is_dir() else file.name
            digest.update(name.encode("utf-8") + b"\0")
            with file.open("rb") as content:
                for block in iter(lambda: content.read(1024 * 1024), b""):
                    digest.update(block)
            digest.update(b"\0")
    return digest.hexdigest()[:24]


def write_version(target, version):
    serialized = json.dumps(version, separators=(",", ":"))
    meta = '<meta name="atlas-version" content="' + html.escape(serialized, quote=True) + '">'
    for name in ("index.html", "pdf.html"):
        page = target / name
        content = page.read_text(encoding="utf-8")
        if "<!-- atlas-version -->" not in content:
            raise ValueError(f"Missing version placeholder: {page}")
        page.write_text(content.replace("<!-- atlas-version -->", meta, 1), encoding="utf-8")
    (target / "version.json").write_text(serialized + "\n", encoding="utf-8")


def prepare_course(config, materials, target, convert, links, shared_version):
    shutil.copytree(SOURCE, target)
    (target / "resources").mkdir()
    catalog, theme = read_catalog(config, materials.resolve(), target, convert)
    catalog["courses"] = links
    manifest = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    (target / "catalog.json").write_text(manifest, encoding="utf-8")
    css_names = {"accent": "green", "ink": "ink", "paper": "paper", "highlight": "orange"}
    declarations = " ".join(f"--{css_names[key]}: {color};" for key, color in theme.items())
    (target / "theme.css").write_text(f":root {{ {declarations} }}\n", encoding="utf-8")

    # Course content is independent of links and changes in other courses.
    course_manifest = target / ".course-content"
    course_manifest.write_text(json.dumps({k: v for k, v in catalog.items() if k != "courses"}, ensure_ascii=False))
    version = {
        "course": fingerprint(course_manifest, target / "theme.css", target / "resources"),
        "shared": shared_version,
        "directory": hashlib.sha256(json.dumps(links, sort_keys=True).encode()).hexdigest()[:24],
    }
    course_manifest.unlink()
    (target / "data.js").write_text("window.ATLAS = " + manifest, encoding="utf-8")
    write_version(target, version)
    return catalog


@contextmanager
def staged_output(output):
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    lock = output.parent / f".{output.name}.atlas-lock"
    try:
        with lock.open("x", encoding="utf-8") as marker:
            marker.write("Atlas build in progress\n")
    except FileExistsError as error:
        raise ValueError(f"Another Atlas build owns this destination: {output}") from error
    try:
        if output.exists() and (not output.is_dir() or (any(output.iterdir()) and not (output / MARKER).is_file())):
            raise ValueError(f"Refusing to replace a folder not managed by Atlas: {output}")
        with tempfile.TemporaryDirectory(prefix=".atlas-", dir=output.parent) as work:
            candidate = Path(work) / "site"
            yield candidate
            (candidate / ".nojekyll").touch()
            (candidate / MARKER).touch()
            backup = Path(work) / "previous"
            if output.exists():
                output.rename(backup)
            try:
                candidate.rename(output)
            except OSError:
                if backup.exists():
                    backup.rename(output)
                raise
    finally:
        lock.unlink(missing_ok=True)


def build(config, materials, output, convert=False):
    with staged_output(output) as candidate:
        return prepare_course(config, materials, candidate, convert, [], fingerprint(SOURCE))


def build_site(site_config, output, convert=False):
    site = json.loads(site_config.read_text(encoding="utf-8"))
    parent = site_config.resolve().parent
    courses = {}
    for entry in site["courses"]:
        config = (parent / text(entry["config"], "course config path")).resolve()
        details = json.loads(config.read_text(encoding="utf-8"))["course"]
        course_id = slug(details["id"], "course.id")
        if course_id in courses:
            raise ValueError(f"Duplicate course ID: {course_id}")
        materials = (parent / entry["materials"]).resolve() if entry.get("materials") else config.parent / "materials"
        courses[course_id] = (config, materials, text(details["code"], "course.code"))
    if not courses:
        raise ValueError("A combined site needs at least one course")
    default = site.get("default", next(iter(courses)))
    if default not in courses:
        raise ValueError("The default course must be in the site catalog")
    links = [{"id": course_id, "label": code, "url": f"../{course_id}/"} for course_id, (_, _, code) in courses.items()]
    shared_version = fingerprint(SOURCE)
    with staged_output(output) as candidate:
        catalogs = [
            prepare_course(config, materials, candidate / course_id, convert, links, shared_version)
            for course_id, (config, materials, _) in courses.items()
        ]
        options = "".join(f'<li><a href="./{item["id"]}/">{html.escape(item["label"])}</a></li>' for item in links)
        (candidate / "index.html").write_text(
            f'<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>課程學習圖鑑</title>'
            f'<meta http-equiv="refresh" content="0; url=./{default}/"><h1>選擇課程</h1><ul>{options}</ul>',
            encoding="utf-8",
        )
    return catalogs


def init(path, course_id, title, code):
    path.mkdir(parents=True, exist_ok=True)
    target = path / "course.json"
    data = {"course": {"id": slug(course_id, "course.id"), "code": code, "title": title},
            "topics": [], "resources": []}
    with target.open("x", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")
    (path / "materials").mkdir(exist_ok=True)
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    new = commands.add_parser("init", help="create an empty, separate course configuration")
    new.add_argument("directory", type=Path)
    new.add_argument("--id", required=True)
    new.add_argument("--title", required=True)
    new.add_argument("--code", required=True)
    make = commands.add_parser("build", help="validate and build a course")
    scope = make.add_mutually_exclusive_group()
    scope.add_argument("--config", type=Path, help="single course configuration")
    scope.add_argument("--site", type=Path, help="site configuration with one or more courses")
    make.add_argument("--materials", type=Path, help="existing materials root (defaults to materials/ beside config)")
    make.add_argument("--output", type=Path, default=ROOT / "dist")
    make.add_argument("--convert-pptx", action="store_true", help="export listed PowerPoints with LibreOffice")
    args = parser.parse_args()
    try:
        if args.command == "init":
            print(init(args.directory, args.id, args.title, args.code))
        elif args.site:
            if args.materials:
                raise ValueError("List material roots per course in the site configuration")
            catalogs = build_site(args.site, args.output, args.convert_pptx)
            print(f"{len(catalogs)} courses → {args.output.resolve()}")
        else:
            config = args.config or DEMO
            materials = args.materials or config.parent / "materials"
            catalog = build(config, materials, args.output, args.convert_pptx)
            print(f"{catalog['course']['code']}: {len(catalog['resources'])} resources → {args.output.resolve()}")
    except (OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as error:
        print(f"Atlas: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

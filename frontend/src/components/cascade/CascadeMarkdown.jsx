import PropTypes from "prop-types";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineMarkdown(line) {
  return line
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code class=\"rounded bg-white\\/10 px-1 py-0.5 text-sky-200\">$1</code>");
}

function renderMarkdown(markdown) {
  const lines = escapeHtml(markdown).split("\n");
  const blocks = [];
  let listBuffer = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push(
      `<ul class="ml-5 list-disc space-y-1 text-sm leading-7 text-slate-200">${listBuffer
        .map((item) => `<li>${inlineMarkdown(item)}</li>`)
        .join("")}</ul>`
    );
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
      continue;
    }
    flushList();
    if (line.startsWith("### ")) {
      blocks.push(`<h3 class="mt-4 text-base font-semibold tracking-wide text-white">${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(`<h2 class="mt-4 text-lg font-semibold tracking-wide text-white">${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    blocks.push(`<p class="text-sm leading-7 text-slate-200">${inlineMarkdown(line)}</p>`);
  }
  flushList();
  return blocks.join("");
}

export default function CascadeMarkdown({ markdown }) {
  return (
    <div
      className="space-y-3 [&_strong]:font-semibold [&_strong]:text-white"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
    />
  );
}

CascadeMarkdown.propTypes = {
  markdown: PropTypes.string.isRequired,
};

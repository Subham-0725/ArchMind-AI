// client/src/components/project/FileTreeExplorer.jsx
import { useState, useMemo } from "react";

// Convert flat RIE tree items into a nested tree hierarchy
const buildNestedTree = (flatTree = []) => {
  const root = { name: "root", type: "dir", children: {} };

  for (const item of flatTree) {
    if (!item || !item.path) continue;
    const parts = item.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const itemType = isLast ? item.type || "file" : "dir";

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          type: itemType,
          size: isLast ? item.size || 0 : 0,
          children: {},
        };
      }
      current = current.children[part];
    }
  }

  const convertToArray = (node) => {
    const list = Object.values(node.children);
    list.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
    });
    return list.map((child) => ({
      ...child,
      children: convertToArray(child),
    }));
  };

  return convertToArray(root);
};

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

// Recursive Tree Node Item
function TreeNodeItem({ node, depth = 0, searchTerm = "" }) {
  const [isOpen, setIsOpen] = useState(depth < 1); // Expand top-level by default

  const isDir = node.type === "dir";
  const hasChildren = isDir && node.children && node.children.length > 0;

  // Filter check
  const matchesSearch =
    !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase());

  if (!matchesSearch && isDir && !node.children.some((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))) {
    return null;
  }

  return (
    <div className="select-none text-xs">
      <div
        onClick={() => isDir && setIsOpen(!isOpen)}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className={[
          "flex items-center justify-between py-1 px-2 rounded-md transition-colors cursor-pointer",
          isDir ? "hover:bg-white/[0.04] text-slate-300 font-medium" : "hover:bg-white/[0.03] text-slate-400 font-mono",
        ].join(" ")}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Arrow / Bullet */}
          {isDir ? (
            <span className="text-[10px] text-slate-500 w-3 shrink-0">
              {isOpen ? "▼" : "▶"}
            </span>
          ) : (
            <span className="w-3 shrink-0" />
          )}

          {/* Icon */}
          {isDir ? (
            <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )}

          <span className="truncate">{node.name}</span>
        </div>

        {!isDir && node.size > 0 && (
          <span className="text-[9px] text-slate-600 font-mono shrink-0 ml-2">
            {formatSize(node.size)}
          </span>
        )}
      </div>

      {isDir && isOpen && hasChildren && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTreeExplorer({ tree = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const nestedTree = useMemo(() => buildNestedTree(tree), [tree]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 backdrop-blur-md flex flex-col gap-3 max-h-[500px]">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          File Tree Explorer
        </h3>
        <span className="text-[10px] font-mono text-slate-500">{tree.length} items</span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter files..."
          className="w-full px-3 py-1.5 rounded-lg bg-[#04070d] border border-white/[0.08] text-xs font-mono text-slate-200 outline-none focus:border-cyan-500/40 placeholder:text-slate-600"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1.5 text-xs text-slate-600 hover:text-slate-400"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tree Content */}
      <div className="overflow-y-auto pr-1 flex flex-col gap-0.5 custom-scrollbar min-h-[150px]">
        {nestedTree.length === 0 ? (
          <p className="text-xs text-slate-600 font-mono italic p-2">Empty file tree</p>
        ) : (
          nestedTree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              depth={0}
              searchTerm={searchTerm}
            />
          ))
        )}
      </div>
    </div>
  );
}

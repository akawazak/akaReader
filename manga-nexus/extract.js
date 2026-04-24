const fs = require("fs");
const path = require("path");
let appCode = fs.readFileSync("src/App.jsx", "utf8");

const componentsToExtract = [
  { name: "UpdatesTab", dir: "tabs" },
  { name: "DownloadsTab", dir: "tabs" },
  { name: "BrowseFilterBar", dir: "tabs" },
  { name: "DiscoverTab", dir: "tabs" },
  { name: "SettingsPage", dir: "tabs" },
  { name: "GlobalSearch", dir: "tabs" },
  { name: "Onboarding", dir: "modals" },
  { name: "ServiceErrorModal", dir: "modals" },
  { name: "StartupScreen", dir: "modals" },
  { name: "CatchUpModal", dir: "modals" },
  { name: "ShareCardModal", dir: "modals" },
  { name: "MangaNotes", dir: "manga" },
  { name: "DuplicateBanner", dir: "ui" },
  { name: "ReadingReceipt", dir: "reader" },
  { name: "MoodDiscovery", dir: "tabs" },
  { name: "DiscoverRow", dir: "tabs" },
  { name: "StatsStrip", dir: "ui" }
];

const importsObj = {
  "tabs": [], "modals": [], "manga": [], "ui": [], "reader": []
};

function findCompBounds(name) {
  const marker = "const " + name + " = memo(";
  const start = appCode.indexOf(marker);
  if (start === -1) return null;

  // Find the opening paren of memo( and track depth
  let depth = 0;
  let i = start + marker.length - 1; // points at '(' of memo(
  // We need to find where memo(...) ends
  // memo( opens at this paren, we need to find the matching )
  while (i < appCode.length) {
    if (appCode[i] === "(") depth++;
    else if (appCode[i] === ")") {
      depth--;
      if (depth === 0) {
        // end is the semicolon or just after )
        let end = i + 1;
        if (appCode[end] === ";") end++;
        return { start, end };
      }
    }
    // Skip strings to avoid false bracket counts
    if (appCode[i] === '"' || appCode[i] === "'" || appCode[i] === "`") {
      const q = appCode[i];
      i++;
      while (i < appCode.length && appCode[i] !== q) {
        if (appCode[i] === "\\") i++; // skip escape
        i++;
      }
    }
    i++;
  }
  return null;
}

for (const c of componentsToExtract) {
  const bounds = findCompBounds(c.name);
  if (bounds) {
    const code = appCode.substring(bounds.start, bounds.end);
    // Remove from appCode
    appCode = appCode.substring(0, bounds.start) + appCode.substring(bounds.end);
    importsObj[c.dir].push(c.name);
    const dirPath = path.join("src/components", c.dir);
    fs.mkdirSync(dirPath, { recursive: true });
    const fileContent = [
      'import React, { memo, useState, useEffect, useMemo, useRef, useCallback } from "react";',
      'import { useData } from "../../App";',
      'import { Btn } from "../ui/Btn";',
      'import { Badge } from "../ui/Badge";',
      'import { Spin } from "../ui/Spin";',
      'import { EmptyState } from "../ui/EmptyState";',
      'import { MangaCard } from "../manga/MangaCard";',
      "import {",
      "  Play, Clock, Check, ChevronDown, ChevronRight, ChevronLeft, X, Search, Settings, Download,",
      "  Trash2, BookOpen, AlertCircle, Share2, Flame, Award, Bookmark, ExternalLink, RotateCcw,",
      "  Library, Globe, Puzzle, ArrowRight, Plus, Minus, Info, Star, Filter, Loader2, Image,",
      "  BellRing, ChevronUp, SlidersHorizontal, Sparkles, CheckCircle2, Heart, Eye, EyeOff,",
      '  Grid, List, LayoutGrid, FileText, Moon, Sun, Monitor, Type, AlignLeft, Maximize2',
      '} from "lucide-react";',
      "",
      "export " + code,
      ""
    ].join("\n");
    fs.writeFileSync(path.join(dirPath, c.name + ".jsx"), fileContent);
    console.log("Extracted " + c.name);
  } else {
    console.log("NOT FOUND: " + c.name);
  }
}

// Save the cleaned App.jsx
fs.writeFileSync("src/App.jsx", appCode);

// Now add import lines to App.jsx
let importLines = [];
for (const dir of Object.keys(importsObj)) {
  for (const c of importsObj[dir]) {
    importLines.push('import { ' + c + ' } from "./components/' + dir + '/' + c + '";');
  }
}

let finalCode = fs.readFileSync("src/App.jsx", "utf8");
const lines = finalCode.split("\n");
// Insert after the last existing import line from components/
const newReaderImportIdx = lines.findIndex(l => l.includes("from './components/reader/Reader'"));
if (newReaderImportIdx !== -1) {
  lines.splice(newReaderImportIdx + 1, 0, ...importLines);
} else {
  const reactIdx = lines.findIndex(l => l.startsWith("import React"));
  lines.splice(reactIdx + 1, 0, ...importLines);
}
fs.writeFileSync("src/App.jsx", lines.join("\n"));

console.log("\nDone! Added " + importLines.length + " import lines to App.jsx.");
console.log("New App.jsx line count:", fs.readFileSync("src/App.jsx", "utf8").split("\n").length);

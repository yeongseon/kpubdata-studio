document$.subscribe(function () {
  document.querySelectorAll("pre code.language-mermaid").forEach(function (codeBlock) {
    var pre = codeBlock.parentElement;
    if (!pre || pre.dataset.mermaidProcessed === "true") {
      return;
    }

    var mermaidBlock = document.createElement("div");
    mermaidBlock.className = "mermaid";
    mermaidBlock.textContent = codeBlock.textContent || "";
    pre.replaceWith(mermaidBlock);
  });

  mermaid.initialize({ startOnLoad: false });
  mermaid.run({ querySelector: ".mermaid" });
});
